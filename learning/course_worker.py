"""Background worker for the course platform (US-31): turns uploaded notes into clips and questions.

A generate request only queues a job; this worker thread runs it, one job at a time:
Gemini clip scripts (video/course/generate.py) → Gemini quiz questions (video/course/questions.py)
→ one ElevenLabs + Remotion render per clip (video/course/render_course.py). Progress and errors are
written to the job row, so the teacher page can show them. A failing job never crashes the server.
"""
import json
import sys
import threading
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
COURSE_CODE = HERE.parent / 'video' / 'course'
sys.path.insert(0, str(COURSE_CODE))

from courses import now  # noqa: E402


class RealPipeline:
    """Gemini + ElevenLabs + Remotion. The keys come from the environment or video/.env."""

    def __init__(self, env=None, env_file=None):
        self.env, self.env_file = env, env_file
        self._client = None

    def client(self):
        import gemini
        if self._client is None:
            kwargs = {'env': self.env} if self.env is not None else {}
            if self.env_file is not None:
                kwargs['env_file'] = self.env_file
            self._client = gemini.Gemini(gemini.load_key(**kwargs))
        return self._client

    def generate(self, course_id, title, materials, courses_root):
        import generate
        return generate.generate(course_id, materials, client=self.client(), root=courses_root, title=title)

    def questions(self, course_id, breakdown):
        import questions
        return questions.generate_questions(self.client(), breakdown, course_id)

    def render(self, script, courses_root):
        import render_course
        return render_course.render(script, root=courses_root)


def _message(err):
    text = str(err).strip() or type(err).__name__
    return text if len(text) < 600 else text[:600] + '…'


class Worker:
    def __init__(self, store, data_dir, pipeline=None, autostart=True, poll_seconds=2.0):
        self.store, self.root = store, Path(data_dir) / 'courses'
        self.pipeline = pipeline or RealPipeline()
        self.poll_seconds = poll_seconds
        self.wake, self.stopping = threading.Event(), threading.Event()
        self.thread = None
        store.fail_interrupted()
        if autostart:
            self.thread = threading.Thread(target=self._loop, name='clipcademy-course-worker', daemon=True)
            self.thread.start()

    def submit(self, job_id):
        self.wake.set()

    def stop(self):
        self.stopping.set()
        self.wake.set()
        if self.thread:
            self.thread.join(timeout=5)

    def _loop(self):
        while not self.stopping.is_set():
            try:
                ran = self.run_next()
            except Exception:  # never let the thread die
                traceback.print_exc()
                ran = False
            if not ran:
                self.wake.wait(self.poll_seconds)
                self.wake.clear()

    def run_next(self):
        job = self.store.next_queued()
        if not job:
            return False
        self.run(job)
        return True

    def run(self, job):
        jid, cid = job['job_id'], job['course_id']
        stage = lambda text: self.store.update_job(jid, stage=text)  # noqa: E731
        self.store.update_job(jid, status='running', stage='Starting')
        try:
            course = self.store.course(cid)
            uploads = sorted((self.root / cid / 'uploads').glob('*'))
            if not uploads:
                raise RuntimeError('No uploaded files found for this course.')
            stage('Gemini is breaking your notes into clips')
            report = self.pipeline.generate(cid, course['title'], uploads, self.root)
            breakdown = json.loads((self.root / cid / 'breakdown.json').read_text(encoding='utf-8'))
            labels = {o.get('objective_id'): o.get('label', '') for o in breakdown.get('objectives') or []}
            stage('Gemini is writing quiz questions')
            qs = self.pipeline.questions(cid, breakdown)
            scripts = [json.loads(Path(p).read_text(encoding='utf-8')) for p in report.get('written', [])]
            if not scripts:
                raise RuntimeError('Gemini made no usable clips. ' + '; '.join(
                    s.get('reason', '') for s in report.get('skipped', []))[:400])
            self.store.replace_unapproved(cid)
            for q in qs.get('questions', []):
                self.store.add_question(cid, {**q, 'objective_label': q.get('objective_label') or labels.get(q['objective_id'], '')})
            made, errors = 0, []
            for n, script in enumerate(scripts, 1):
                stage(f'Rendering clip {n} of {len(scripts)}')
                try:
                    record = self.pipeline.render(script, self.root)
                except Exception as err:
                    errors.append({'variant_id': script.get('variant_id'), 'reason': _message(err)})
                    continue
                self.store.add_clip(cid, script, record, labels.get(script['objective_id'], ''))
                made += 1
            summary = {'clips': made, 'questions': len(qs.get('questions', [])),
                       'skipped': report.get('skipped', []) + qs.get('skipped', []) + errors}
            if made == 0:
                self.store.update_job(jid, status='failed', stage='Rendering failed', report=summary, finished_at=now(),
                                      message='No clip could be rendered: ' + errors[0]['reason'])
            else:
                self.store.update_job(jid, status='done', stage='Ready for review', report=summary, finished_at=now(),
                                      message=f'{made} clips and {summary["questions"]} questions are ready for review.')
        except Exception as err:
            self.store.update_job(jid, status='failed', stage='Stopped', message=_message(err), finished_at=now())
