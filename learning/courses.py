"""The course platform API (US-30, US-31, US-34, US-44): teachers create courses, upload notes and start
generation; students join with a class code and practise.

Teacher routes need `Authorization: Bearer <CLIPCADEMY_TEACHER_TOKEN>`. Generated clips and questions are
live for the class as soon as the job finishes; a teacher can delete a bad one. Everything lives in one
SQLite file and one folder per course under the data directory (a mounted disk in production).
"""
import hmac
import importlib.util
import json
import re
import secrets
import sqlite3
import threading
from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path
from urllib.parse import unquote

import grading

HERE = Path(__file__).resolve().parent
MAX_UPLOAD = 18 * 1024 * 1024
MAX_JSON = 64 * 1024
SUPPORTED = {'.pdf': 'application/pdf', '.txt': 'text/plain', '.md': 'text/markdown'}
CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
COURSE_ID = re.compile(r'^[a-z][a-z0-9_]{1,39}$')
MEDIA_NAME = re.compile(r'^[a-z0-9_.-]+\.(mp4|vtt)$')
# ponytail: clips/questions keep their old status, note and preview_key columns so existing course databases still
# open; every new row is 'live'. Drop the columns with a migration if the schema ever needs another change.
LIVE = 'live'


def _media_module():
    spec = importlib.util.spec_from_file_location('clipcademy_media', HERE.parent / 'video' / 'media.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


media = _media_module()


def now():
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


class HttpError(Exception):
    def __init__(self, status, field, message):
        super().__init__(message)
        self.status, self.field, self.message = status, field, message


def handles(path):
    return path.startswith(('/teacher/', '/courses/', '/course-media/')) or path == '/teacher'


def variant_order(variant_id):
    m = re.search(r'(\d+)$', variant_id)
    return (0 if variant_id.startswith('intro') else 1, int(m.group(1)) if m else 0, variant_id)


class CourseStore:
    """SQLite storage shared by the API and the worker thread (one connection, one lock)."""

    def __init__(self, path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(str(path), check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.lock = threading.RLock()
        with self.lock, self.db:
            self.db.executescript("""
                CREATE TABLE IF NOT EXISTS courses (course_id TEXT PRIMARY KEY, title TEXT NOT NULL,
                    join_code TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS materials (course_id TEXT NOT NULL, name TEXT NOT NULL, size INTEGER,
                    uploaded_at TEXT, PRIMARY KEY (course_id, name));
                CREATE TABLE IF NOT EXISTS jobs (job_id TEXT PRIMARY KEY, course_id TEXT NOT NULL, status TEXT NOT NULL,
                    stage TEXT, message TEXT, report TEXT, created_at TEXT NOT NULL, finished_at TEXT);
                CREATE TABLE IF NOT EXISTS clips (clip_id TEXT PRIMARY KEY, course_id TEXT NOT NULL, topic_id TEXT,
                    objective_id TEXT, objective_label TEXT, variant_id TEXT, script TEXT, record TEXT,
                    status TEXT NOT NULL, note TEXT, preview_key TEXT UNIQUE, created_at TEXT, reviewed_at TEXT);
                CREATE TABLE IF NOT EXISTS questions (question_id TEXT PRIMARY KEY, course_id TEXT NOT NULL,
                    objective_id TEXT, objective_label TEXT, data TEXT NOT NULL, status TEXT NOT NULL, note TEXT,
                    created_at TEXT, reviewed_at TEXT);
            """)

    def q(self, sql, args=()):
        with self.lock:
            return [dict(r) for r in self.db.execute(sql, args)]

    def x(self, sql, args=()):
        with self.lock, self.db:
            return self.db.execute(sql, args)

    # courses
    def create_course(self, title):
        slug = re.sub(r'[^a-z0-9]+', '_', title.lower()).strip('_')[:28] or 'course'
        if not slug[0].isalpha():
            slug = 'c_' + slug
        with self.lock:
            for _ in range(20):
                course_id = f'{slug}_{secrets.token_hex(2)}'
                code = ''.join(secrets.choice(CODE_ALPHABET) for _ in range(6))
                try:
                    self.x('INSERT INTO courses VALUES (?, ?, ?, ?)', (course_id, title, code, now()))
                    return self.course(course_id)
                except sqlite3.IntegrityError:
                    continue
        raise HttpError(500, 'course', 'could not create a unique course')

    def course(self, course_id):
        rows = self.q('SELECT * FROM courses WHERE course_id = ?', (course_id,))
        return rows[0] if rows else None

    def course_by_code(self, code):
        rows = self.q('SELECT * FROM courses WHERE join_code = ?', (code.upper(),))
        return rows[0] if rows else None

    def courses(self):
        return self.q('SELECT * FROM courses ORDER BY created_at DESC, course_id')

    def add_material(self, course_id, name, size):
        self.x('INSERT OR REPLACE INTO materials VALUES (?, ?, ?, ?)', (course_id, name, size, now()))

    def materials(self, course_id):
        return self.q('SELECT name, size, uploaded_at FROM materials WHERE course_id = ? ORDER BY name', (course_id,))

    # jobs
    def create_job(self, course_id):
        with self.lock:
            busy = self.q("SELECT 1 FROM jobs WHERE course_id = ? AND status IN ('queued', 'running')", (course_id,))
            if busy:
                raise HttpError(409, 'job', 'clips are already being made for this course')
            job_id = secrets.token_hex(8)
            self.x('INSERT INTO jobs (job_id, course_id, status, stage, created_at) VALUES (?, ?, ?, ?, ?)',
                   (job_id, course_id, 'queued', 'Waiting to start', now()))
            return self.job(job_id)

    def job(self, job_id):
        rows = self.q('SELECT * FROM jobs WHERE job_id = ?', (job_id,))
        return rows[0] if rows else None

    def latest_job(self, course_id):
        rows = self.q('SELECT * FROM jobs WHERE course_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1', (course_id,))
        return rows[0] if rows else None

    def next_queued(self):
        rows = self.q("SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at, rowid LIMIT 1")
        return rows[0] if rows else None

    def update_job(self, job_id, **fields):
        if 'report' in fields and not isinstance(fields['report'], str):
            fields['report'] = json.dumps(fields['report'], ensure_ascii=False)
        sets = ', '.join(f'{k} = ?' for k in fields)
        self.x(f'UPDATE jobs SET {sets} WHERE job_id = ?', (*fields.values(), job_id))

    def fail_interrupted(self):
        self.x("UPDATE jobs SET status = 'failed', message = ?, finished_at = ? WHERE status = 'running'",
               ('The server restarted during this job. Press Generate again.', now()))

    # clips and questions
    def replace_all(self, course_id):
        self.x('DELETE FROM clips WHERE course_id = ?', (course_id,))
        self.x('DELETE FROM questions WHERE course_id = ?', (course_id,))

    def add_clip(self, course_id, script, record, label):
        clip_id = secrets.token_hex(8)
        self.x('INSERT INTO clips (clip_id, course_id, topic_id, objective_id, objective_label, variant_id, script, '
               'record, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
               (clip_id, course_id, script['topic_id'], script['objective_id'], label, script['variant_id'],
                json.dumps(script, ensure_ascii=False), json.dumps(record, ensure_ascii=False), LIVE, now()))
        return clip_id

    def add_question(self, course_id, q):
        qid = q['question_id']
        if self.q('SELECT 1 FROM questions WHERE question_id = ?', (qid,)):
            qid = f'{qid}-{secrets.token_hex(3)}'
        self.x('INSERT INTO questions (question_id, course_id, objective_id, objective_label, data, status, created_at) '
               'VALUES (?, ?, ?, ?, ?, ?, ?)', (qid, course_id, q['objective_id'], q.get('objective_label', ''),
                                                json.dumps({**q, 'question_id': qid}, ensure_ascii=False), LIVE, now()))

    def clips(self, course_id):
        return self.q('SELECT * FROM clips WHERE course_id = ? ORDER BY created_at, rowid', (course_id,))

    def questions(self, course_id):
        return self.q('SELECT * FROM questions WHERE course_id = ? ORDER BY created_at, rowid', (course_id,))

    def delete(self, kind, item_id):
        table, key = ('clips', 'clip_id') if kind == 'clips' else ('questions', 'question_id')
        if not self.x(f'DELETE FROM {table} WHERE {key} = ?', (item_id,)).rowcount:
            raise HttpError(404, key, 'no such item')

    def clip_file(self, course_id, name):
        for c in self.clips(course_id):
            record = json.loads(c['record'])
            if name in (record.get('video_file'), record.get('captions_file')):
                return True
        return False


def clip_view(row, teacher=True):
    script, record = json.loads(row['script']), json.loads(row['record'])
    scene = script['scenes'][0]
    base = f"/course-media/{row['course_id']}/"
    out = {'clip_id': row['clip_id'], 'topic_id': row['topic_id'], 'objective_id': row['objective_id'],
           'variant_id': row['variant_id'], 'title': scene['title'], 'duration_seconds': record.get('duration_seconds'),
           'video_url': base + record['video_file'], 'captions_url': base + record['captions_file'],
           'transcript': record.get('transcript', scene['narration'])}
    if teacher:
        out.update(template=scene['template'], kind=script.get('kind'), teaching_goal=script.get('teaching_goal'),
                   source_refs=script.get('source_refs', []))
    return out


def question_view(row, teacher=True):
    data = json.loads(row['data'])
    out = {'question_id': row['question_id'], 'objective_id': row['objective_id'], 'prompt': data['prompt'],
           'choices': data['choices']}
    if teacher:
        out.update(correct_choice_id=data['correct_choice_id'], feedback=data['feedback'],
                   source_refs=data.get('source_refs', []), objective_label=row['objective_label'] or '')
    return out


def _question_data(row):
    """A stored question with the US-41 fields; courses made before then have plain required questions."""
    data = json.loads(row['data'])
    data.setdefault('role', 'required')
    data.setdefault('counts_for', row['question_id'])
    data.setdefault('misconceptions', {})
    return data


def lesson(store, course_id, objective_id):
    """(packet, answer key, questions) in learning/grading.py's shapes, so a course is graded by the MVP's rules.

    Follow-up variants are named <misconception>_followup and _followup_2 (US-40). A wrong choice with no misconception
    (an older course) maps to an empty one, which grading turns into needs_review instead of a loop."""
    clips = [r for r in store.clips(course_id) if r['objective_id'] == objective_id]
    rows = [r for r in store.questions(course_id) if r['objective_id'] == objective_id]
    data = {r['question_id']: _question_data(r) for r in rows}
    required = [q for q, d in data.items() if d['role'] == 'required']
    if not clips or not required:
        return None
    misconceptions = {None: {'variant_ids': [], 'retry_question_ids': []}}
    for d in data.values():
        for m in filter(None, d['misconceptions'].values()):
            misconceptions[m] = {'variant_ids': [f'{m}_followup', f'{m}_followup_2'],
                                 'retry_question_ids': [q for q, r in data.items()
                                                        if r['role'] == 'retry' and r.get('misconception_id') == m]}
    scripts = {r['variant_id']: json.loads(r['script']) for r in clips}
    variants = {v: {'teaching_goal': '', 'source_refs': []} for m in misconceptions.values() for v in m['variant_ids']}
    variants.update({v: {'teaching_goal': s.get('teaching_goal', ''), 'source_refs': s.get('source_refs', [])}
                     for v, s in scripts.items()})
    intros = sorted((v for v in scripts if v.startswith('intro')), key=variant_order)
    packet = {'topic_id': clips[0]['topic_id'], 'objective_id': objective_id, 'required_question_ids': required,
              'misconceptions': misconceptions, 'variants': variants,
              'review_points': [scripts[v]['teaching_goal'] for v in intros if scripts[v].get('teaching_goal')]}
    key = {q: {'correct_choice_id': d['correct_choice_id'], 'counts_for': d['counts_for'] if d['counts_for'] in data else q,
               'source_refs': d.get('source_refs', []),
               'choices': {c['choice_id']: {'feedback': d['feedback'].get(c['choice_id'], ''),
                                            'misconception_id': None if c['choice_id'] == d['correct_choice_id']
                                            else d['misconceptions'].get(c['choice_id'])}
                           for c in d['choices']}}
           for q, d in data.items()}
    return packet, key, {q: {'objective_id': objective_id} for q in data}


def topics_view(path):
    """US-47: how the notes were split into topics, from breakdown.json ([] until Gemini has returned it)."""
    try:
        breakdown = json.loads(Path(path).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return []
    return [{'objective_id': o.get('objective_id'), 'label': o.get('label', ''),
             'excerpts': [{'ref': e.get('ref'), 'text': e.get('text')} for e in o.get('source_excerpts') or []],
             'clips': [{'variant_id': c.get('variant_id'), 'teaching_goal': c.get('teaching_goal')} for c in o.get('clips') or []],
             'misconceptions': [{'misconception_id': m.get('misconception_id'), 'label': m.get('label')}
                                for m in o.get('misconceptions') or []]}
            for o in breakdown.get('objectives') or [] if isinstance(o, dict)]


BIOLOGY_CODE = 'BIO101'
VIDEO = HERE.parent / 'video'


def biology_class():
    """US-49: the MVP biology lessons as a class, from the same packets, questions and rendered clips as the study app.

    Only the topics the study app marks available. No review gate here (the study app keeps its own)."""
    topics = json.loads((HERE / 'data' / 'topics.json').read_text(encoding='utf-8'))['topics']

    def clip(topic_id, variant_id):
        # ponytail: one rendered record per clip in video/media, found by name; matching by fingerprint would break on
        # Windows checkouts (path sort order). Switch to jobs.VideoService.asset if several renders ever coexist.
        records = sorted((VIDEO / 'media').glob(f'{topic_id}.{variant_id}.*.json'))
        if not records:
            return None
        record = json.loads(records[-1].read_text(encoding='utf-8'))
        script = json.loads((VIDEO / 'scripts' / f'{topic_id}.{variant_id}.json').read_text(encoding='utf-8'))
        return {'clip_id': f'{topic_id}.{variant_id}', 'topic_id': topic_id, 'variant_id': variant_id,
                'title': script['scenes'][0].get('title', ''), 'duration_seconds': record.get('duration_seconds'),
                'video_url': '/media/' + record['video_file'], 'captions_url': '/media/' + record['captions_file'],
                'transcript': record.get('transcript', '')}

    def question(qid):
        q = grading.QUESTIONS[qid]
        return {k: q[k] for k in ('question_id', 'objective_id', 'prompt', 'choices')}

    objectives = []
    for topic in (t for t in topics if t.get('availability') == 'available'):
        for o in topic['objectives']:
            packet = grading.PACKETS[o['objective_id']]
            intros = grading.intro_variant_ids(packet)
            followups = {v: clip(topic['topic_id'], v) for v in packet['variants'] if v not in intros}
            objectives.append({'objective_id': o['objective_id'], 'topic_id': topic['topic_id'], 'label': topic['label'],
                               'clips': [c for c in (clip(topic['topic_id'], v) for v in intros) if c],
                               'followups': {v: c for v, c in followups.items() if c},
                               'questions': [question(q) for q in packet['required_question_ids']],
                               'retries': {r: question(r) for m in packet['misconceptions'].values()
                                           for r in m['retry_question_ids']}})
    return {'title': 'Biology: DNA replication and repair', 'join_code': BIOLOGY_CODE, 'objectives': objectives}


def make_courses_app(store, data_dir, teacher_token, worker=None):
    data_dir = Path(data_dir)
    courses_root = data_dir / 'courses'
    # ponytail: attempt results kept in memory only to answer a re-sent attempt the same way; lost on restart, which
    # just means a re-send after a restart is graded again. Persist them if that ever matters.
    attempts = {}

    def read_json(environ):
        try:
            length = int(environ.get('CONTENT_LENGTH') or 0)
        except ValueError:
            length = 0
        if length > MAX_JSON:
            raise HttpError(413, 'body', f'must be at most {MAX_JSON} bytes')
        try:
            body = json.loads(environ['wsgi.input'].read(length) or b'{}')
        except ValueError:
            raise HttpError(400, 'body', 'must be valid JSON')
        if not isinstance(body, dict):
            raise HttpError(400, 'body', 'must be a JSON object')
        return body

    def require_teacher(environ):
        if not teacher_token:
            raise HttpError(401, 'Authorization', 'teacher pages are off: set CLIPCADEMY_TEACHER_TOKEN on the server')
        given = environ.get('HTTP_AUTHORIZATION', '')
        if not hmac.compare_digest(given.encode(), f'Bearer {teacher_token}'.encode()):
            raise HttpError(401, 'Authorization', 'wrong or missing teacher password')

    def course_or_404(course_id):
        course = store.course(course_id) if COURSE_ID.match(course_id or '') else None
        if not course:
            raise HttpError(404, 'course_id', 'no such course')
        return course

    def upload(environ, course_id, raw_name):
        course = course_or_404(course_id)
        name = Path(unquote(raw_name).replace('\\', '/')).name
        stem, suffix = Path(name).stem, Path(name).suffix.lower()
        if suffix not in SUPPORTED:
            raise HttpError(400, 'file', 'only PDF, .txt and .md files are supported (export slides as PDF)')
        try:
            length = int(environ.get('CONTENT_LENGTH') or 0)
        except ValueError:
            length = 0
        if length > MAX_UPLOAD:
            raise HttpError(413, 'file', f'files must be at most {MAX_UPLOAD // (1024 * 1024)} MB')
        if length <= 0:
            raise HttpError(400, 'file', 'the file is empty')
        safe = (re.sub(r'[^a-z0-9_-]+', '_', stem.lower()).strip('_') or 'material')[:60] + suffix
        folder = courses_root / course['course_id'] / 'uploads'
        folder.mkdir(parents=True, exist_ok=True)
        data = environ['wsgi.input'].read(length)
        (folder / safe).write_bytes(data)
        store.add_material(course['course_id'], safe, len(data))
        return 201, {'name': safe, 'size': len(data)}

    def generate(course_id):
        course = course_or_404(course_id)
        if not store.materials(course['course_id']):
            raise HttpError(400, 'materials', 'upload at least one file first')
        job = store.create_job(course['course_id'])
        if worker is not None:
            worker.submit(job['job_id'])
        return 202, job_view(job)

    def job_view(job):
        if not job:
            return None
        out = {k: job[k] for k in ('job_id', 'status', 'stage', 'message', 'created_at', 'finished_at')}
        out['report'] = json.loads(job['report']) if job.get('report') else None
        return out

    def teacher_course(course_id):
        course = course_or_404(course_id)
        cid = course['course_id']
        return 200, {'course': course, 'share_path': f"/class.html#{course['join_code']}",
                     'materials': store.materials(cid), 'job': job_view(store.latest_job(cid)),
                     'topics': topics_view(courses_root / cid / 'breakdown.json'),
                     'clips': [clip_view(r) for r in store.clips(cid)],
                     'questions': [question_view(r) for r in store.questions(cid)]}

    def student_course(code):
        if (code or '').upper() == BIOLOGY_CODE:
            return 200, biology_class()
        course = store.course_by_code(code or '')
        if not course:
            raise HttpError(404, 'code', 'no class with that code')
        cid = course['course_id']
        objectives = {}
        for row in store.clips(cid):
            obj = objectives.setdefault(row['objective_id'], {'objective_id': row['objective_id'], 'topic_id': row['topic_id'],
                                                              'label': row['objective_label'] or row['objective_id'],
                                                              'clips': [], 'followups': {}, 'questions': [], 'retries': {}})
            view = clip_view(row, teacher=False)
            if row['variant_id'].startswith('intro'):
                obj['clips'].append(view)
            else:
                obj['followups'][row['variant_id']] = view
        for row in store.questions(cid):
            if row['objective_id'] in objectives:
                obj = objectives[row['objective_id']]
                if _question_data(row)['role'] == 'retry':
                    obj['retries'][row['question_id']] = question_view(row, teacher=False)
                else:
                    obj['questions'].append(question_view(row, teacher=False))
        for obj in objectives.values():
            obj['clips'].sort(key=lambda c: variant_order(c['variant_id']))
        return 200, {'title': course['title'], 'join_code': course['join_code'], 'objectives': list(objectives.values())}

    def attempt(environ, code):
        """US-42: POST /attempts as in the MVP (Member2_SPEC), for a course's objective."""
        if (code or '').upper() == BIOLOGY_CODE:  # US-49: the biology answer key and packets, grading's defaults
            try:
                return 200, grading.grade(read_json(environ), attempts)
            except grading.GradingError as e:
                raise HttpError(e.status, e.field, e.message)
        course = store.course_by_code(code or '')
        if not course:
            raise HttpError(404, 'code', 'no class with that code')
        body = read_json(environ)
        found = lesson(store, course['course_id'], str(body.get('objective_id') or ''))
        if not found:
            raise HttpError(400, 'objective_id', 'unknown objective in this class')
        packet, key, questions = found
        try:
            result = grading.grade(body, attempts, {packet['objective_id']: packet}, key, questions)
        except grading.GradingError as e:
            raise HttpError(e.status, e.field, e.message)
        return 200, result

    def serve_media(environ, start_response, path):
        parts = path.split('/')
        if len(parts) == 4 and COURSE_ID.match(parts[2]) and MEDIA_NAME.match(parts[3]) \
                and store.clip_file(parts[2], parts[3]):
            return media.serve({**environ, 'PATH_INFO': '/media/' + parts[3]}, start_response,
                               courses_root / parts[2] / 'media')
        start_response('404 Not Found', [('Content-Type', 'text/plain')])
        return [b'not found']

    def route(method, path, environ):
        parts = [p for p in path.split('/') if p]
        if parts[:1] == ['teacher']:
            require_teacher(environ)
            rest = parts[1:]
            if rest == ['courses'] and method == 'GET':
                return 200, {'courses': store.courses()}
            if rest == ['courses'] and method == 'POST':
                title = str(read_json(environ).get('title') or '').strip()
                if not title:
                    raise HttpError(400, 'title', 'give the course a title')
                return 201, store.create_course(title[:120])
            if len(rest) == 2 and rest[0] == 'courses' and method == 'GET':
                return teacher_course(rest[1])
            if len(rest) == 4 and rest[0] == 'courses' and rest[2] == 'materials' and method == 'PUT':
                return upload(environ, rest[1], rest[3])
            if len(rest) == 3 and rest[0] == 'courses' and rest[2] == 'generate' and method == 'POST':
                return generate(rest[1])
            if len(rest) == 2 and rest[0] in ('clips', 'questions') and method == 'DELETE':
                store.delete(rest[0], rest[1])
                return 200, {'deleted': rest[1]}
        elif parts[:1] == ['courses']:
            if len(parts) == 2 and method == 'GET':
                return student_course(parts[1])
            if len(parts) == 3 and parts[2] == 'attempts' and method == 'POST':
                return attempt(environ, parts[1])
        raise HttpError(404, 'path', f'no endpoint at {method} {path}')

    def application(environ, start_response):
        method, path = environ['REQUEST_METHOD'], environ.get('PATH_INFO', '/')
        if path.startswith('/course-media/'):
            if method not in ('GET', 'HEAD') or '..' in path:
                start_response('404 Not Found', [('Content-Type', 'text/plain')])
                return [b'not found']
            return serve_media(environ, start_response, path)
        try:
            status, body = route(method, path, environ)
        except HttpError as e:
            status, body = e.status, {'error': {'field': e.field, 'message': e.message}}
        payload = json.dumps(body, ensure_ascii=False).encode()
        start_response(f'{status} {HTTPStatus(status).phrase}',
                       [('Content-Type', 'application/json; charset=utf-8'), ('Content-Length', str(len(payload))),
                        ('Cache-Control', 'no-store')])
        return [payload]

    return application
