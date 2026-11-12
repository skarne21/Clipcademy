"""US-30, US-31, US-33 and US-34: the course platform API, background worker, review and class code.

The pipeline (Gemini, ElevenLabs, Remotion) is replaced by a fake, so these tests are fast and free.
Written before the implementation (TDD red). Run: python3 -m pytest learning/test_courses.py
"""
import io
import json
import shutil
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from wsgiref.util import setup_testing_defaults

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / 'video' / 'course'))

import fixtures  # noqa: E402  (video/course/fixtures.py)

TOKEN = 'teacher-secret'
AUTH = {'Authorization': f'Bearer {TOKEN}'}


def call(app, method, path, body=None, headers=None, raw=None, length=None):
    data = raw if raw is not None else (b'' if body is None else json.dumps(body).encode())
    env = {'REQUEST_METHOD': method, 'PATH_INFO': path, 'CONTENT_LENGTH': str(len(data) if length is None else length),
           'CONTENT_TYPE': 'application/json', 'wsgi.input': io.BytesIO(data)}
    env.update({'HTTP_' + k.upper().replace('-', '_'): v for k, v in (headers or {}).items()})
    setup_testing_defaults(env)
    out = {}
    chunks = app(env, lambda status, hdrs: out.update(status=int(status.split()[0]), headers=dict(hdrs)))
    payload = b''.join(chunks)
    ctype = out['headers'].get('Content-Type', '')
    return out['status'], out['headers'], (json.loads(payload) if 'json' in ctype and payload else payload)


class FakePipeline:
    """Stands in for Gemini + ElevenLabs + Remotion: writes tiny media files and returns what the real one would."""

    def __init__(self, fail=None):
        self.fail = fail
        self.runs = 0

    def generate(self, course_id, title, materials, courses_root):
        if self.fail:
            raise self.fail
        self.runs += 1
        base = Path(courses_root) / course_id / 'scripts'
        base.mkdir(parents=True, exist_ok=True)
        written = []
        for clip in (fixtures.CLIP, fixtures.last_intro_clip()):
            clip = {**clip, 'course_id': course_id}
            path = base / f"{clip['topic_id']}.{clip['variant_id']}.json"
            path.write_text(json.dumps(clip), encoding='utf-8')
            written.append(str(path))
        breakdown = {**fixtures.BREAKDOWN, 'course_id': course_id}
        (Path(courses_root) / course_id / 'breakdown.json').write_text(json.dumps(breakdown), encoding='utf-8')
        return {'course_id': course_id, 'written': written, 'skipped': []}

    def questions(self, course_id, breakdown):
        return {'questions': [{
            'question_id': f'{course_id}-price_changes-q1', 'topic_id': 'supply_and_demand',
            'objective_id': 'price_changes', 'prompt': 'What happens to the price when demand rises?',
            'choices': [{'choice_id': 'A', 'text': 'It rises'}, {'choice_id': 'B', 'text': 'It falls'}],
            'correct_choice_id': 'A', 'feedback': {'A': 'Correct. It rises.', 'B': 'It falls when supply rises.'},
            'source_refs': ['econ101-lecture3-p1']}], 'skipped': []}

    def render(self, script, courses_root):
        media = Path(courses_root) / script['course_id'] / 'media'
        media.mkdir(parents=True, exist_ok=True)
        stem = f"{script['topic_id']}.{script['variant_id']}.run{self.runs}"
        (media / f'{stem}.mp4').write_bytes(b'\x00\x00\x00\x18ftypmp42' + bytes(200))
        (media / f'{stem}.vtt').write_text('WEBVTT\n', encoding='utf-8')
        return {'video_file': f'{stem}.mp4', 'captions_file': f'{stem}.vtt',
                'transcript': script['scenes'][0]['narration'], 'fingerprint': f'run{self.runs}',
                'duration_seconds': 20.0, 'source_refs': script['source_refs']}


class Platform(unittest.TestCase):
    def setUp(self):
        import course_worker
        import courses
        self.data = Path(tempfile.mkdtemp(prefix='clipcademy-platform-'))
        self.addCleanup(shutil.rmtree, self.data, True)
        self.pipeline = FakePipeline()
        self.store = courses.CourseStore(self.data / 'courses.db')
        self.worker = course_worker.Worker(self.store, self.data, self.pipeline, autostart=False)
        self.app = courses.make_courses_app(self.store, self.data, TOKEN, self.worker)

    # helpers
    def new_course(self, title='Intro Economics'):
        status, _, body = call(self.app, 'POST', '/teacher/courses', {'title': title}, AUTH)
        self.assertEqual(status, 201, body)
        return body

    def upload(self, course_id, name='lecture3.pdf', data=b'%PDF-1.4 notes'):
        return call(self.app, 'PUT', f'/teacher/courses/{course_id}/materials/{name}', raw=data,
                    headers={**AUTH, 'Content-Type': 'application/pdf'})

    def generated(self):
        course = self.new_course()
        self.upload(course['course_id'])
        status, _, job = call(self.app, 'POST', f"/teacher/courses/{course['course_id']}/generate", {}, AUTH)
        self.assertEqual(status, 202, job)
        self.worker.run_next()
        return course

    def view(self, course_id):
        status, _, body = call(self.app, 'GET', f'/teacher/courses/{course_id}', headers=AUTH)
        self.assertEqual(status, 200, body)
        return body

    def review(self, kind, item_id, decision, note=''):
        return call(self.app, 'POST', f'/teacher/{kind}/{item_id}/review', {'decision': decision, 'note': note}, AUTH)


class TeacherAuth(Platform):
    def test_teacher_requests_need_the_password(self):
        self.assertEqual(call(self.app, 'GET', '/teacher/courses')[0], 401)
        self.assertEqual(call(self.app, 'GET', '/teacher/courses', headers={'Authorization': 'Bearer nope'})[0], 401)
        self.assertEqual(call(self.app, 'GET', '/teacher/courses', headers=AUTH)[0], 200)

    def test_no_password_configured_locks_teacher_pages(self):
        import courses
        app = courses.make_courses_app(self.store, self.data, None, self.worker)
        status, _, body = call(app, 'GET', '/teacher/courses', headers={'Authorization': 'Bearer '})
        self.assertEqual(status, 401)
        self.assertIn('CLIPCADEMY_TEACHER_TOKEN', body['error']['message'])


class Courses(Platform):
    def test_create_course_makes_id_and_class_code(self):
        import templates
        course = self.new_course('Intro Economics!')
        self.assertTrue(templates.COURSE_ID.match(course['course_id']))
        self.assertTrue(course['course_id'].startswith('intro_economics'))
        self.assertRegex(course['join_code'], r'^[A-HJ-NP-Z2-9]{6}$')
        _, _, listing = call(self.app, 'GET', '/teacher/courses', headers=AUTH)
        self.assertEqual([c['course_id'] for c in listing['courses']], [course['course_id']])

    def test_title_required(self):
        self.assertEqual(call(self.app, 'POST', '/teacher/courses', {'title': '  '}, AUTH)[0], 400)


class Uploads(Platform):
    def test_pdf_upload_is_stored_in_the_course(self):
        course = self.new_course()
        status, _, body = self.upload(course['course_id'])
        self.assertEqual(status, 201, body)
        self.assertTrue((self.data / 'courses' / course['course_id'] / 'uploads' / 'lecture3.pdf').is_file())
        self.assertEqual([m['name'] for m in self.view(course['course_id'])['materials']], ['lecture3.pdf'])

    def test_unsupported_type_is_refused(self):
        course = self.new_course()
        status, _, body = self.upload(course['course_id'], 'slides.pptx', b'x')
        self.assertEqual(status, 400)
        self.assertIn('PDF', body['error']['message'])

    def test_too_large_is_refused_before_reading(self):
        import courses
        course = self.new_course()
        status, _, _ = call(self.app, 'PUT', f"/teacher/courses/{course['course_id']}/materials/big.pdf", raw=b'x',
                            headers=AUTH, length=courses.MAX_UPLOAD + 1)
        self.assertEqual(status, 413)

    def test_unsafe_names_stay_inside_the_course(self):
        course = self.new_course()
        status, _, body = self.upload(course['course_id'], '..%2F..%2Fescape.pdf')
        self.assertEqual(status, 201, body)
        stored = list((self.data / 'courses' / course['course_id'] / 'uploads').iterdir())
        self.assertEqual(len(stored), 1)
        self.assertNotIn('/', body['name'])
        self.assertFalse((self.data / 'escape.pdf').exists())

    def test_unknown_course(self):
        self.assertEqual(self.upload('no_such_course')[0], 404)


class Jobs(Platform):
    def test_generate_needs_material(self):
        course = self.new_course()
        self.assertEqual(call(self.app, 'POST', f"/teacher/courses/{course['course_id']}/generate", {}, AUTH)[0], 400)

    def test_one_job_at_a_time(self):
        course = self.new_course()
        self.upload(course['course_id'])
        path = f"/teacher/courses/{course['course_id']}/generate"
        self.assertEqual(call(self.app, 'POST', path, {}, AUTH)[0], 202)
        self.assertEqual(call(self.app, 'POST', path, {}, AUTH)[0], 409)

    def test_job_makes_pending_clips_and_questions(self):
        course = self.generated()
        view = self.view(course['course_id'])
        self.assertEqual(view['job']['status'], 'done')
        self.assertEqual(len(view['clips']), 2)
        self.assertEqual({c['status'] for c in view['clips']}, {'pending'})
        self.assertTrue(all(c['preview_url'].startswith('/course-media/preview/') for c in view['clips']))
        self.assertEqual(len(view['questions']), 1)
        self.assertEqual(view['questions'][0]['status'], 'pending')
        self.assertEqual(view['questions'][0]['correct_choice_id'], 'A')  # teachers see the answer

    def test_failure_is_reported_not_raised(self):
        import gemini
        self.pipeline.fail = gemini.MissingKey('GEMINI_API_KEY is not set.')
        course = self.new_course()
        self.upload(course['course_id'])
        call(self.app, 'POST', f"/teacher/courses/{course['course_id']}/generate", {}, AUTH)
        self.worker.run_next()
        job = self.view(course['course_id'])['job']
        self.assertEqual(job['status'], 'failed')
        self.assertIn('GEMINI_API_KEY', job['message'])

    def test_regenerating_keeps_approved_items_and_replaces_the_rest(self):
        course = self.generated()
        view = self.view(course['course_id'])
        keep = view['clips'][0]['clip_id']
        self.review('clips', keep, 'approve')
        call(self.app, 'POST', f"/teacher/courses/{course['course_id']}/generate", {}, AUTH)
        self.worker.run_next()
        clips = self.view(course['course_id'])['clips']
        self.assertIn(keep, [c['clip_id'] for c in clips if c['status'] == 'approved'])
        self.assertEqual(len([c for c in clips if c['status'] == 'pending']), 2)
        self.assertEqual(len(clips), 3)

    def test_real_pipeline_without_a_key_fails_with_the_key_name(self):
        import course_worker
        course = self.new_course()
        self.upload(course['course_id'], 'notes.txt', fixtures.MATERIAL_TEXT.encode())
        worker = course_worker.Worker(self.store, self.data,
                                      course_worker.RealPipeline(env={}, env_file=self.data / 'none.env'), autostart=False)
        app = __import__('courses').make_courses_app(self.store, self.data, TOKEN, worker)
        call(app, 'POST', f"/teacher/courses/{course['course_id']}/generate", {}, AUTH)
        worker.run_next()
        job = self.view(course['course_id'])['job']
        self.assertEqual(job['status'], 'failed')
        self.assertIn('GEMINI_API_KEY', job['message'])

    def test_worker_thread_runs_queued_jobs(self):
        import course_worker
        import courses
        worker = course_worker.Worker(self.store, self.data, self.pipeline, autostart=True, poll_seconds=0.05)
        self.addCleanup(worker.stop)
        app = courses.make_courses_app(self.store, self.data, TOKEN, worker)
        course = self.new_course()
        self.upload(course['course_id'])
        call(app, 'POST', f"/teacher/courses/{course['course_id']}/generate", {}, AUTH)
        deadline = time.time() + 5
        while time.time() < deadline and self.view(course['course_id'])['job']['status'] != 'done':
            time.sleep(0.05)
        self.assertEqual(self.view(course['course_id'])['job']['status'], 'done')


class Review(Platform):
    def test_approve_and_reject(self):
        course = self.generated()
        a, b = (c['clip_id'] for c in self.view(course['course_id'])['clips'])
        self.assertEqual(self.review('clips', a, 'approve')[0], 200)
        self.assertEqual(self.review('clips', b, 'reject', 'Analogy is misleading')[0], 200)
        clips = {c['clip_id']: c for c in self.view(course['course_id'])['clips']}
        self.assertEqual((clips[a]['status'], clips[b]['status'], clips[b]['note']), ('approved', 'rejected', 'Analogy is misleading'))

    def test_bad_decision_and_unknown_item(self):
        course = self.generated()
        clip = self.view(course['course_id'])['clips'][0]['clip_id']
        self.assertEqual(self.review('clips', clip, 'maybe')[0], 400)
        self.assertEqual(self.review('clips', 'nope', 'approve')[0], 404)
        self.assertEqual(call(self.app, 'POST', f'/teacher/clips/{clip}/review', {'decision': 'approve'})[0], 401)

    def test_approving_a_new_version_replaces_the_old_one(self):
        course = self.generated()
        first = {c['variant_id']: c['clip_id'] for c in self.view(course['course_id'])['clips']}
        self.review('clips', first['intro_1'], 'approve')
        call(self.app, 'POST', f"/teacher/courses/{course['course_id']}/generate", {}, AUTH)
        self.worker.run_next()
        newer = [c for c in self.view(course['course_id'])['clips'] if c['variant_id'] == 'intro_1' and c['status'] == 'pending'][0]
        self.review('clips', newer['clip_id'], 'approve')
        status = {c['clip_id']: c['status'] for c in self.view(course['course_id'])['clips']}
        self.assertEqual((status[first['intro_1']], status[newer['clip_id']]), ('replaced', 'approved'))


class Students(Platform):
    def approved_course(self):
        course = self.generated()
        view = self.view(course['course_id'])
        for c in view['clips']:
            if c['variant_id'] == 'intro_1':
                self.review('clips', c['clip_id'], 'approve')
        self.review('questions', view['questions'][0]['question_id'], 'approve')
        return course

    def test_unknown_code(self):
        self.assertEqual(call(self.app, 'GET', '/courses/ZZZZZZ')[0], 404)

    def test_students_see_only_approved_items_without_answers(self):
        course = self.approved_course()
        status, _, body = call(self.app, 'GET', f"/courses/{course['join_code'].lower()}")
        self.assertEqual(status, 200, body)
        self.assertEqual(body['title'], 'Intro Economics')
        [obj] = body['objectives']
        self.assertEqual([c['variant_id'] for c in obj['clips']], ['intro_1'])
        self.assertTrue(obj['clips'][0]['video_url'].startswith(f"/course-media/{course['course_id']}/"))
        [q] = obj['questions']
        self.assertNotIn('correct_choice_id', q)
        self.assertNotIn('feedback', q)

    def test_course_with_nothing_approved_has_no_objectives(self):
        course = self.generated()
        _, _, body = call(self.app, 'GET', f"/courses/{course['join_code']}")
        self.assertEqual(body['objectives'], [])

    def test_answers_are_graded_with_feedback(self):
        course = self.approved_course()
        qid = f"{course['course_id']}-price_changes-q1"
        path = f"/courses/{course['join_code']}/answers"
        _, _, right = call(self.app, 'POST', path, {'question_id': qid, 'choice_id': 'A'})
        _, _, wrong = call(self.app, 'POST', path, {'question_id': qid, 'choice_id': 'B'})
        self.assertEqual((right['correct'], wrong['correct']), (True, False))
        self.assertEqual(wrong['feedback'], 'It falls when supply rises.')
        self.assertEqual(wrong['correct_choice_id'], 'A')
        self.assertEqual(call(self.app, 'POST', path, {'question_id': qid, 'choice_id': 'Q'})[0], 400)

    def test_unapproved_question_cannot_be_answered(self):
        course = self.generated()
        qid = f"{course['course_id']}-price_changes-q1"
        status = call(self.app, 'POST', f"/courses/{course['join_code']}/answers", {'question_id': qid, 'choice_id': 'A'})[0]
        self.assertEqual(status, 404)


class Media(Platform):
    def test_approved_clips_stream_with_ranges(self):
        course = Students.approved_course(self)
        _, _, body = call(self.app, 'GET', f"/courses/{course['join_code']}")
        url = body['objectives'][0]['clips'][0]['video_url']
        status, headers, data = call(self.app, 'GET', url)
        self.assertEqual(status, 200)
        self.assertEqual(headers['Content-Type'], 'video/mp4')
        status, headers, data = call(self.app, 'GET', url, headers={'Range': 'bytes=0-9'})
        self.assertEqual((status, len(data)), (206, 10))

    def test_pending_clips_only_through_their_preview_link(self):
        course = self.generated()
        clip = self.view(course['course_id'])['clips'][0]
        direct = f"/course-media/{course['course_id']}/{clip['video_file']}"
        self.assertEqual(call(self.app, 'GET', direct)[0], 404)
        self.assertEqual(call(self.app, 'GET', clip['preview_url'])[0], 200)
        self.assertEqual(call(self.app, 'GET', '/course-media/preview/' + '0' * 32 + '.mp4')[0], 404)

    def test_bad_media_paths(self):
        for path in ('/course-media/../courses.db', '/course-media/x/../../courses.db', '/course-media/preview/abc.mp4'):
            self.assertEqual(call(self.app, 'GET', path)[0], 404, path)


if __name__ == '__main__':
    unittest.main()
