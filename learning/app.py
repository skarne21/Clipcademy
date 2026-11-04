"""Member 2 WSGI service: topics, questions, attempts, events (Member2_SPEC.md, "Service").
Local: python learning/app.py   Hosted: point the PythonAnywhere WSGI file at `application`."""
import csv
import hmac
import importlib.util
import io
import json
import os
import sqlite3
from datetime import datetime, timezone
from http import HTTPStatus

import grading

TOPICS = grading._load(os.path.join(grading.HERE, "data", "topics.json"))
for _objective in (o for t in TOPICS["topics"] for o in t["objectives"]):
    # notes.md shared contract: the intro clips, in order. Member 3 sends each to /video-jobs as its slide comes up
    _packet = grading.PACKETS[_objective["objective_id"]]
    _objective["intro_video_requests"] = [
        {"topic_id": _packet["topic_id"], "objective_id": _packet["objective_id"], "variant_id": v,
         "teaching_goal": _packet["variants"][v]["teaching_goal"], "source_refs": _packet["variants"][v]["source_refs"]}
        for v in grading.intro_variant_ids(_packet)]
MAX_BODY = 64 * 1024
EVENT_COLUMNS = ["event_id", "participant_id", "session_id", "event_name", "topic_id", "objective_id", "question_id",
                 "variant_id", "correct", "direction", "seconds_watched", "client_timestamp_utc", "timestamp_utc",
                 "build_id", "build_id_status"]
EVENT_REQUIRED = ["event_id", "participant_id", "session_id", "event_name", "client_timestamp_utc"]
EVENT_OPTIONAL = ["topic_id", "objective_id", "question_id", "variant_id", "direction", "build_id"]
EVENT_EXTRAS = {  # Team_Spec "Activity events": the extra fields each event must carry
    "app_opened": [], "topic_selected": ["topic_id"], "video_started": ["variant_id"],
    "video_completed": ["variant_id"], "question_answered": ["question_id", "correct"],
    "followup_requested": ["variant_id"], "objective_completed": ["objective_id"],
    "objective_needs_review": ["objective_id"], "demo_reset": [],
    "heartbeat": [],  # every 30 s while the app is visible, for time on app (validation-plan.md)
    "clip_swiped": ["variant_id", "direction", "seconds_watched"],  # drop-off per clip and position (notes.md)
}
SWIPE_DIRECTIONS = ("up", "down")


class HttpError(Exception):
    def __init__(self, status, field, message):
        super().__init__(message)
        self.status, self.field, self.message = status, field, message


def _utc_iso(dt):
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


class AttemptStore:
    """The attempts mapping grading.grade() expects, persisted in SQLite."""

    def __init__(self, db):
        self.db = db

    def __contains__(self, attempt_id):
        return self.db.execute("SELECT 1 FROM attempts WHERE attempt_id = ?", (attempt_id,)).fetchone() is not None

    def __getitem__(self, attempt_id):
        req, result = self.db.execute("SELECT request, result FROM attempts WHERE attempt_id = ?", (attempt_id,)).fetchone()
        return json.loads(req), json.loads(result)

    def __setitem__(self, attempt_id, value):
        with self.db:
            self.db.execute("INSERT INTO attempts VALUES (?, ?, ?)", (attempt_id, *map(json.dumps, value)))


def _validate_event(ev):
    if not isinstance(ev, dict):
        raise HttpError(400, "body", "must be a JSON object")
    for field in EVENT_REQUIRED:
        if not isinstance(ev.get(field), str) or not ev[field]:
            raise HttpError(400, field, "is required and must be a non-empty string")
    if not grading.is_uuid(ev["event_id"]):
        raise HttpError(400, "event_id", "must be a UUID, e.g. from crypto.randomUUID()")
    if ev["event_name"] not in EVENT_EXTRAS:
        raise HttpError(400, "event_name", f"must be one of {', '.join(EVENT_EXTRAS)}")
    for field in EVENT_OPTIONAL:
        if ev.get(field) is not None and (not isinstance(ev[field], str) or not ev[field]):
            raise HttpError(400, field, "must be a non-empty string when present")
    for field in EVENT_EXTRAS[ev["event_name"]]:
        if ev.get(field) is None:
            raise HttpError(400, field, f"is required for {ev['event_name']}")
    if ev.get("correct") is not None and not isinstance(ev["correct"], bool):
        raise HttpError(400, "correct", "must be true or false")
    if ev.get("direction") is not None and ev["direction"] not in SWIPE_DIRECTIONS:
        raise HttpError(400, "direction", f"must be one of {', '.join(SWIPE_DIRECTIONS)}")
    seconds = ev.get("seconds_watched")
    if seconds is not None and (isinstance(seconds, bool) or not isinstance(seconds, (int, float)) or seconds < 0):
        raise HttpError(400, "seconds_watched", "must be a number of seconds, 0 or more")
    try:
        client_time = datetime.fromisoformat(ev["client_timestamp_utc"])
    except ValueError:
        client_time = None
    if client_time is None or client_time.tzinfo is None:
        raise HttpError(400, "client_timestamp_utc", "must be an ISO 8601 time with a time zone, e.g. 2026-11-03T15:00:00Z")
    return _utc_iso(client_time)


def _is_video_path(path):
    return path == "/video-jobs" or path.startswith("/video-jobs/")


def make_app(db_path, allowed_origins, build_ids, admin_token, video_app=None):
    # ponytail: one shared connection, fine for wsgiref and PythonAnywhere's single free worker; open one per request if workers > 1
    db = sqlite3.connect(db_path, check_same_thread=False)
    db.executescript("""
        CREATE TABLE IF NOT EXISTS attempts (attempt_id TEXT PRIMARY KEY, request TEXT NOT NULL, result TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS events (event_id TEXT PRIMARY KEY, participant_id TEXT, session_id TEXT,
            event_name TEXT, topic_id TEXT, objective_id TEXT, question_id TEXT, variant_id TEXT, correct INTEGER,
            client_timestamp_utc TEXT, timestamp_utc TEXT, build_id TEXT);
    """)
    have = {row[1] for row in db.execute("PRAGMA table_info(events)")}
    for column, kind in (("direction", "TEXT"), ("seconds_watched", "REAL")):
        if column not in have:  # a database made before clip_swiped existed (the hosted one)
            db.execute(f"ALTER TABLE events ADD COLUMN {column} {kind}")
    attempts = AttemptStore(db)

    def read_json(environ):
        try:
            length = int(environ.get("CONTENT_LENGTH") or 0)
        except ValueError:
            length = 0
        if length > MAX_BODY:
            raise HttpError(413, "body", f"must be at most {MAX_BODY} bytes")
        try:
            return json.loads(environ["wsgi.input"].read(length) or b"null")
        except ValueError:
            raise HttpError(400, "body", "must be valid JSON")

    def post_event(environ):
        ev = read_json(environ)
        client_time = _validate_event(ev)
        row = {c: ev.get(c) for c in EVENT_COLUMNS[:-1]}
        if ev["event_name"] == "question_answered":
            # the H3 lesson split reads topic_id, so fill it from the question instead of trusting the client
            if ev["question_id"] not in grading.QUESTIONS:
                raise HttpError(400, "question_id", "unknown question")
            row["objective_id"] = grading.QUESTIONS[ev["question_id"]]["objective_id"]
            row["topic_id"] = grading.PACKETS[row["objective_id"]]["topic_id"]
        row.update(client_timestamp_utc=client_time, timestamp_utc=_utc_iso(datetime.now(timezone.utc)))
        with db:
            cur = db.execute(f"INSERT OR IGNORE INTO events ({', '.join(row)}) VALUES ({', '.join('?' * len(row))})",
                             list(row.values()))
        return (201, {"event_id": ev["event_id"], "duplicate": False}) if cur.rowcount else (200, {"duplicate": True})

    def export_events(environ):
        given = environ.get("HTTP_AUTHORIZATION", "")
        if not admin_token or not hmac.compare_digest(given.encode(), f"Bearer {admin_token}".encode()):
            raise HttpError(401, "Authorization", "export needs 'Authorization: Bearer <CLIPCADEMY_ADMIN_TOKEN>'")
        out = io.StringIO()
        writer = csv.writer(out, lineterminator="\n")
        writer.writerow(EVENT_COLUMNS)
        for row in db.execute(f"SELECT {', '.join(EVENT_COLUMNS[:-1])} FROM events ORDER BY rowid"):
            row = list(row)
            correct = row[EVENT_COLUMNS.index("correct")]
            row[EVENT_COLUMNS.index("correct")] = "" if correct is None else ("true" if correct else "false")
            build_id = row[-1]
            writer.writerow(row + ["missing" if build_id is None else "ok" if build_id in build_ids else "unknown"])
        return 200, out.getvalue()

    def route(method, path, environ):
        if path == "/topics":
            allowed, handler = "GET", lambda: (200, TOPICS)
        elif path.startswith("/questions/"):
            qid = path[len("/questions/"):]
            if qid not in grading.QUESTIONS:
                raise HttpError(404, "question_id", "unknown question")
            allowed, handler = "GET", lambda: (200, grading.QUESTIONS[qid])
        elif path == "/attempts":
            allowed, handler = "POST", lambda: (200, grading.grade(read_json(environ), attempts))
        elif path == "/events":
            allowed, handler = "POST", lambda: post_event(environ)
        elif path == "/events.csv":
            allowed, handler = "GET", lambda: export_events(environ)
        elif _is_video_path(path):
            raise HttpError(503, "path", "video service not installed yet (Member 1's video/jobs.py)")
        else:
            raise HttpError(404, "path", f"no endpoint at {path}")
        if method != allowed:
            raise HttpError(405, "method", f"{path} accepts {allowed}")
        return handler()

    def application(environ, start_response):
        method, path = environ["REQUEST_METHOD"], environ.get("PATH_INFO", "/")
        headers = []
        origin = environ.get("HTTP_ORIGIN")
        if "*" in allowed_origins:
            headers.append(("Access-Control-Allow-Origin", "*"))
        elif origin in allowed_origins:
            headers += [("Access-Control-Allow-Origin", origin), ("Vary", "Origin")]
        if method == "OPTIONS":
            headers += [("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
                        ("Access-Control-Allow-Headers", "Content-Type, Authorization")]
            start_response("204 No Content", headers)
            return [b""]
        if video_app is not None and (_is_video_path(path) or path.startswith("/media/")):
            return video_app(environ, start_response)  # Member 1's handler owns these responses (Team_Spec, Hosting)
        try:
            status, body = route(method, path, environ)
        except (HttpError, grading.GradingError) as e:
            status, body = e.status, {"error": {"field": e.field, "message": e.message}}
        if isinstance(body, str):
            payload, ctype = body.encode(), "text/csv; charset=utf-8"
        else:
            payload, ctype = json.dumps(body, ensure_ascii=False).encode(), "application/json; charset=utf-8"
        headers += [("Content-Type", ctype), ("Content-Length", str(len(payload)))]
        start_response(f"{status} {HTTPStatus(status).phrase}", headers)
        return [payload]

    return application


def _load_video_app():
    """Member 1's WSGI handler from video/jobs.py, or None until it exists."""
    path = os.path.join(grading.HERE, "..", "video", "jobs.py")
    if not os.path.exists(path):
        return None
    spec = importlib.util.spec_from_file_location("video_jobs", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    media_spec = importlib.util.spec_from_file_location("video_media", os.path.join(os.path.dirname(path), "media.py"))
    media = importlib.util.module_from_spec(media_spec)
    media_spec.loader.exec_module(media)

    def mounted(environ, start_response):
        if environ.get("PATH_INFO", "").startswith("/media/"):
            return media.serve(environ, start_response, module.application.media)
        return module.application(environ, start_response)
    return mounted


def _env_list(name, default=""):
    return [v.strip() for v in os.environ.get(name, default).split(",") if v.strip()]


application = make_app(
    db_path=os.environ.get("CLIPCADEMY_DB", os.path.join(grading.HERE, "clipcademy.db")),
    allowed_origins=_env_list("CLIPCADEMY_ALLOWED_ORIGINS", "*"),
    build_ids=_env_list("CLIPCADEMY_BUILD_IDS"),
    admin_token=os.environ.get("CLIPCADEMY_ADMIN_TOKEN"),
    video_app=_load_video_app(),
)

if __name__ == "__main__":
    from wsgiref.simple_server import make_server

    port = int(os.environ.get("PORT", "8000"))
    print(f"Clipcademy learning service on http://localhost:{port}")
    make_server("", port, application).serve_forever()
