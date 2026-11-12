"""One server for everything (US-35): the built web pages, the existing biology API and clips, and the
course platform (teacher API, background worker, review, class codes, course videos).

    python3 learning/server.py            # http://localhost:8000  (build the pages first: cd web && npm run build)

Configuration is environment variables only (see DEPLOY.md):
  GEMINI_API_KEY, ELEVENLABS_API_KEY   the two AI keys (or put them in video/.env)
  CLIPCADEMY_TEACHER_TOKEN             the teacher password for teach.html
  CLIPCADEMY_DATA                      where databases, uploads and course videos live (a mounted disk)
  PORT                                 default 8000
The existing biology app keeps its own settings (CLIPCADEMY_BUILD_IDS, CLIPCADEMY_ADMIN_TOKEN, ...).
"""
import mimetypes
import os
import sys
from pathlib import Path
from socketserver import ThreadingMixIn
from wsgiref.simple_server import WSGIServer, make_server

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))

import course_worker  # noqa: E402
import courses  # noqa: E402

TYPES = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html',
         '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png',
         '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json'}


def teacher_token(env=os.environ):
    """The teacher password, without the quotes docker --env-file keeps from .env; None when unset."""
    return (env.get('CLIPCADEMY_TEACHER_TOKEN') or '').strip().strip('"\'') or None


def _env_list(name, default=''):
    return [v.strip() for v in os.environ.get(name, default).split(',') if v.strip()]


def static_app(web_dist):
    web_dist = Path(web_dist).resolve()

    def find(path):
        rel = 'index.html' if path in ('', '/') else path.lstrip('/')
        target = (web_dist / rel).resolve()
        if web_dist not in target.parents or not target.is_file():
            return None
        return target

    def serve(environ, start_response, target):
        data = target.read_bytes()
        ctype = TYPES.get(target.suffix.lower()) or mimetypes.guess_type(target.name)[0] or 'application/octet-stream'
        cache = 'public, max-age=31536000, immutable' if '/assets/' in environ.get('PATH_INFO', '') else 'no-cache'
        start_response('200 OK', [('Content-Type', f'{ctype}; charset=utf-8' if ctype.startswith('text/') else ctype),
                                  ('Content-Length', str(len(data))), ('Cache-Control', cache)])
        return [b''] if environ['REQUEST_METHOD'] == 'HEAD' else [data]

    return find, serve


def make_server_app(data_dir, web_dist, teacher_token, pipeline=None, start_worker=True):
    import app as biology
    data_dir = Path(data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)
    study = biology.make_app(db_path=os.environ.get('CLIPCADEMY_DB') or str(data_dir / 'study.db'),
                             allowed_origins=_env_list('CLIPCADEMY_ALLOWED_ORIGINS', '*'),
                             build_ids=_env_list('CLIPCADEMY_BUILD_IDS'),
                             admin_token=os.environ.get('CLIPCADEMY_ADMIN_TOKEN'),
                             video_app=biology._load_video_app())
    store = courses.CourseStore(data_dir / 'courses.db')
    worker = course_worker.Worker(store, data_dir, pipeline, autostart=start_worker)
    platform = courses.make_courses_app(store, data_dir, teacher_token, worker)
    find, serve = static_app(web_dist)

    def application(environ, start_response):
        path = environ.get('PATH_INFO', '/')
        if courses.handles(path):
            return platform(environ, start_response)
        if environ['REQUEST_METHOD'] in ('GET', 'HEAD'):
            target = find(path)
            if target:
                return serve(environ, start_response, target)
        return study(environ, start_response)

    application.worker = worker
    return application


_app = None


def application(environ, start_response):
    """WSGI entry for hosts that import a module-level app; built on the first request."""
    global _app
    if _app is None:
        _app = make_server_app(os.environ.get('CLIPCADEMY_DATA', str(ROOT / 'data')),
                               os.environ.get('CLIPCADEMY_WEB_DIST', str(ROOT / 'web' / 'dist')),
                               teacher_token())
    return _app(environ, start_response)


class ThreadingServer(ThreadingMixIn, WSGIServer):
    daemon_threads = True


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '8000'))
    host = os.environ.get('HOST', '0.0.0.0')
    app = make_server_app(os.environ.get('CLIPCADEMY_DATA', str(ROOT / 'data')),
                          os.environ.get('CLIPCADEMY_WEB_DIST', str(ROOT / 'web' / 'dist')),
                          teacher_token())
    if not teacher_token():
        print('Note: CLIPCADEMY_TEACHER_TOKEN is not set, so teach.html is locked.', flush=True)
    print(f'ClipCademy on http://localhost:{port}  (teachers: /teach.html, students: /class.html)', flush=True)
    make_server(host, port, app, server_class=ThreadingServer).serve_forever()
