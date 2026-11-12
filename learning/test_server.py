"""US-35: one server for the web pages, the biology API and video, and the course platform.

Written before the implementation (TDD red).
"""
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
os.environ.setdefault('CLIPCADEMY_DB', ':memory:')  # importing app must not create a real database

from test_courses import AUTH, TOKEN, FakePipeline, call  # noqa: E402


class OneServer(unittest.TestCase):
    def setUp(self):
        import server
        self.tmp = Path(tempfile.mkdtemp(prefix='clipcademy-server-'))
        self.addCleanup(shutil.rmtree, self.tmp, True)
        dist = self.tmp / 'dist'
        (dist / 'assets').mkdir(parents=True)
        (dist / 'index.html').write_text('<main id="app"></main>', encoding='utf-8')
        (dist / 'teach.html').write_text('<h1>Teacher</h1>', encoding='utf-8')
        (dist / 'class.html').write_text('<h1>Class</h1>', encoding='utf-8')
        (dist / 'assets' / 'app.js').write_text('console.log(1)', encoding='utf-8')
        self.app = server.make_server_app(data_dir=self.tmp / 'data', web_dist=dist, teacher_token=TOKEN,
                                          pipeline=FakePipeline(), start_worker=False)

    def test_pages_and_assets(self):
        status, headers, body = call(self.app, 'GET', '/')
        self.assertEqual((status, headers['Content-Type'].split(';')[0]), (200, 'text/html'))
        self.assertIn(b'id="app"', body)
        self.assertEqual(call(self.app, 'GET', '/teach.html')[2], b'<h1>Teacher</h1>')
        self.assertEqual(call(self.app, 'GET', '/class.html')[2], b'<h1>Class</h1>')
        status, headers, _ = call(self.app, 'GET', '/assets/app.js')
        self.assertEqual((status, headers['Content-Type'].split(';')[0]), (200, 'text/javascript'))

    def test_static_paths_cannot_escape_dist(self):
        (self.tmp / 'secret.txt').write_text('no', encoding='utf-8')
        for path in ('/../secret.txt', '/assets/../../secret.txt', '/missing.js'):
            self.assertEqual(call(self.app, 'GET', path)[0], 404, path)

    def test_biology_api_still_answers(self):
        status, _, body = call(self.app, 'GET', '/topics')
        self.assertEqual(status, 200)
        self.assertEqual(len(body['topics']), 4)

    def test_course_api_is_mounted(self):
        self.assertEqual(call(self.app, 'GET', '/teacher/courses')[0], 401)
        self.assertEqual(call(self.app, 'GET', '/teacher/courses', headers=AUTH)[0], 200)
        self.assertEqual(call(self.app, 'GET', '/courses/ZZZZZZ')[0], 404)

    def test_data_lives_under_the_data_dir(self):
        call(self.app, 'POST', '/teacher/courses', {'title': 'Physics'}, AUTH)
        self.assertTrue((self.tmp / 'data' / 'courses.db').is_file())


class EnvFileQuotes(unittest.TestCase):
    """US-37: `docker run --env-file video/.env` keeps the quotes from KEY="...". The server strips them once at
    startup, so video/tts.py (part of every clip's fingerprint) never has to change."""

    def test_quotes_are_stripped_from_the_three_settings(self):
        import server
        env = {'GEMINI_API_KEY': '"g-key"', 'ELEVENLABS_API_KEY': "'e-key'", 'CLIPCADEMY_TEACHER_TOKEN': ' "pw" ',
               'OTHER': '"left alone"'}
        server.unquote_env(env)
        self.assertEqual(env, {'GEMINI_API_KEY': 'g-key', 'ELEVENLABS_API_KEY': 'e-key', 'CLIPCADEMY_TEACHER_TOKEN': 'pw',
                               'OTHER': '"left alone"'})

    def test_missing_settings_stay_missing(self):
        import server
        env = {}
        server.unquote_env(env)
        self.assertEqual(env, {})


if __name__ == '__main__':
    unittest.main()
