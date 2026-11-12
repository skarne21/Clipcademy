"""The course platform API (US-30, US-31, US-33, US-34): teachers create courses, upload notes, start
generation and review every clip and question; students join with a class code and practise.

Teacher routes need `Authorization: Bearer <CLIPCADEMY_TEACHER_TOKEN>`. Students see only approved
items. Pending clips play only through an unguessable preview link. Everything lives in one SQLite
file and one folder per course under the data directory (a mounted disk in production).
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

HERE = Path(__file__).resolve().parent
MAX_UPLOAD = 18 * 1024 * 1024
MAX_JSON = 64 * 1024
SUPPORTED = {'.pdf': 'application/pdf', '.txt': 'text/plain', '.md': 'text/markdown'}
CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
COURSE_ID = re.compile(r'^[a-z][a-z0-9_]{1,39}$')
MEDIA_NAME = re.compile(r'^[a-z0-9_.-]+\.(mp4|vtt)$')
PREVIEW = re.compile(r'^/course-media/preview/([0-9a-f]{32})\.(mp4|vtt)$')
DECISIONS = {'approve': 'approved', 'reject': 'rejected'}


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
    def replace_unapproved(self, course_id):
        self.x("DELETE FROM clips WHERE course_id = ? AND status IN ('pending', 'rejected')", (course_id,))
        self.x("DELETE FROM questions WHERE course_id = ? AND status IN ('pending', 'rejected')", (course_id,))

    def add_clip(self, course_id, script, record, label):
        clip_id = secrets.token_hex(8)
        self.x('INSERT INTO clips (clip_id, course_id, topic_id, objective_id, objective_label, variant_id, script, '
               'record, status, preview_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
               (clip_id, course_id, script['topic_id'], script['objective_id'], label, script['variant_id'],
                json.dumps(script, ensure_ascii=False), json.dumps(record, ensure_ascii=False), 'pending',
                secrets.token_hex(16), now()))
        return clip_id

    def add_question(self, course_id, q):
        qid = q['question_id']
        if self.q('SELECT 1 FROM questions WHERE question_id = ?', (qid,)):
            qid = f'{qid}-{secrets.token_hex(3)}'
        self.x('INSERT INTO questions (question_id, course_id, objective_id, objective_label, data, status, created_at) '
               'VALUES (?, ?, ?, ?, ?, ?, ?)', (qid, course_id, q['objective_id'], q.get('objective_label', ''),
                                                json.dumps({**q, 'question_id': qid}, ensure_ascii=False), 'pending', now()))

    def clips(self, course_id, status=None):
        sql, args = 'SELECT * FROM clips WHERE course_id = ?', [course_id]
        if status:
            sql, args = sql + ' AND status = ?', args + [status]
        return self.q(sql + ' ORDER BY created_at, rowid', args)

    def questions(self, course_id, status=None):
        sql, args = 'SELECT * FROM questions WHERE course_id = ?', [course_id]
        if status:
            sql, args = sql + ' AND status = ?', args + [status]
        return self.q(sql + ' ORDER BY created_at, rowid', args)

    def review(self, kind, item_id, decision, note):
        table, key = ('clips', 'clip_id') if kind == 'clips' else ('questions', 'question_id')
        with self.lock:
            rows = self.q(f'SELECT * FROM {table} WHERE {key} = ?', (item_id,))
            if not rows:
                raise HttpError(404, key, 'no such item')
            status = DECISIONS[decision]
            if kind == 'clips' and status == 'approved':
                row = rows[0]
                self.x("UPDATE clips SET status = 'replaced' WHERE course_id = ? AND topic_id = ? AND variant_id = ? "
                       "AND status = 'approved' AND clip_id != ?", (row['course_id'], row['topic_id'], row['variant_id'], item_id))
            self.x(f'UPDATE {table} SET status = ?, note = ?, reviewed_at = ? WHERE {key} = ?', (status, note, now(), item_id))

    def clip_by_preview(self, key):
        rows = self.q('SELECT * FROM clips WHERE preview_key = ?', (key,))
        return rows[0] if rows else None

    def approved_file(self, course_id, name):
        for c in self.clips(course_id, 'approved'):
            record = json.loads(c['record'])
            if name in (record.get('video_file'), record.get('captions_file')):
                return True
        return False


def clip_view(row, teacher=True):
    script, record = json.loads(row['script']), json.loads(row['record'])
    scene = script['scenes'][0]
    out = {'clip_id': row['clip_id'], 'topic_id': row['topic_id'], 'objective_id': row['objective_id'],
           'variant_id': row['variant_id'], 'title': scene['title'], 'duration_seconds': record.get('duration_seconds')}
    if teacher:
        out.update(status=row['status'], note=row['note'] or '', template=scene['template'], kind=script.get('kind'),
                   teaching_goal=script.get('teaching_goal'), transcript=record.get('transcript', scene['narration']),
                   review_notes=script.get('review_notes', {}), source_refs=script.get('source_refs', []),
                   video_file=record['video_file'],
                   preview_url=f"/course-media/preview/{row['preview_key']}.mp4",
                   preview_captions_url=f"/course-media/preview/{row['preview_key']}.vtt")
    else:
        base = f"/course-media/{row['course_id']}/"
        out.update(video_url=base + record['video_file'], captions_url=base + record['captions_file'],
                   transcript=record.get('transcript', scene['narration']))
    return out


def question_view(row, teacher=True):
    data = json.loads(row['data'])
    out = {'question_id': row['question_id'], 'objective_id': row['objective_id'], 'prompt': data['prompt'],
           'choices': data['choices']}
    if teacher:
        out.update(status=row['status'], note=row['note'] or '', correct_choice_id=data['correct_choice_id'],
                   feedback=data['feedback'], source_refs=data.get('source_refs', []),
                   objective_label=row['objective_label'] or '')
    return out


def make_courses_app(store, data_dir, teacher_token, worker=None):
    data_dir = Path(data_dir)
    courses_root = data_dir / 'courses'

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
                     'clips': [clip_view(r) for r in store.clips(cid)],
                     'questions': [question_view(r) for r in store.questions(cid)]}

    def review(environ, kind, item_id):
        body = read_json(environ)
        if body.get('decision') not in DECISIONS:
            raise HttpError(400, 'decision', 'must be "approve" or "reject"')
        note = str(body.get('note') or '')[:500]
        store.review(kind, item_id, body['decision'], note)
        return 200, {'status': DECISIONS[body['decision']]}

    def student_course(code):
        course = store.course_by_code(code or '')
        if not course:
            raise HttpError(404, 'code', 'no class with that code')
        cid = course['course_id']
        objectives = {}
        for row in store.clips(cid, 'approved'):
            obj = objectives.setdefault(row['objective_id'], {'objective_id': row['objective_id'], 'topic_id': row['topic_id'],
                                                              'label': row['objective_label'] or row['objective_id'],
                                                              'clips': [], 'questions': []})
            obj['clips'].append(clip_view(row, teacher=False))
        for row in store.questions(cid, 'approved'):
            if row['objective_id'] in objectives:
                objectives[row['objective_id']]['questions'].append(question_view(row, teacher=False))
        for obj in objectives.values():
            obj['clips'].sort(key=lambda c: variant_order(c['variant_id']))
        return 200, {'title': course['title'], 'join_code': course['join_code'], 'objectives': list(objectives.values())}

    def answer(environ, code):
        course = store.course_by_code(code or '')
        if not course:
            raise HttpError(404, 'code', 'no class with that code')
        body = read_json(environ)
        rows = [r for r in store.questions(course['course_id'], 'approved') if r['question_id'] == body.get('question_id')]
        if not rows:
            raise HttpError(404, 'question_id', 'no such question in this class')
        data = json.loads(rows[0]['data'])
        choice = body.get('choice_id')
        if choice not in {c['choice_id'] for c in data['choices']}:
            raise HttpError(400, 'choice_id', 'not one of this question\'s choices')
        return 200, {'correct': choice == data['correct_choice_id'], 'correct_choice_id': data['correct_choice_id'],
                     'feedback': data['feedback'][choice]}

    def serve_media(environ, start_response, path):
        m = PREVIEW.match(path)
        if m:
            clip = store.clip_by_preview(m.group(1))
            if clip:
                record = json.loads(clip['record'])
                name = record['video_file'] if m.group(2) == 'mp4' else record['captions_file']
                return media.serve({**environ, 'PATH_INFO': '/media/' + name}, start_response,
                                   courses_root / clip['course_id'] / 'media')
        else:
            parts = path.split('/')
            if len(parts) == 4 and COURSE_ID.match(parts[2]) and MEDIA_NAME.match(parts[3]) \
                    and store.approved_file(parts[2], parts[3]):
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
            if len(rest) == 3 and rest[0] in ('clips', 'questions') and rest[2] == 'review' and method == 'POST':
                return review(environ, rest[0], rest[1])
        elif parts[:1] == ['courses']:
            if len(parts) == 2 and method == 'GET':
                return student_course(parts[1])
            if len(parts) == 3 and parts[2] == 'answers' and method == 'POST':
                return answer(environ, parts[1])
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
