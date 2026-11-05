"""Shared setup for the Python tests: import learning/ from $REPO and call the WSGI app in-process."""
import io
import json
import os
import sys
import uuid
from wsgiref.util import setup_testing_defaults

REPO = os.path.abspath(os.environ.get("REPO", os.path.join(os.path.dirname(__file__), "..")))
LEARNING = os.path.join(REPO, "learning")
sys.path.insert(0, LEARNING)
os.environ["CLIPCADEMY_DB"] = ":memory:"  # importing app.py must not create a real database


def uid():
    return str(uuid.uuid4())


def read(*parts):
    with open(os.path.join(REPO, *parts), encoding="utf-8") as f:
        return f.read()


def call(app, method, path, body=None, headers=None):
    """One request through the WSGI app -> (status, parsed JSON body, or text for anything else)."""
    raw = b"" if body is None else json.dumps(body).encode()
    env = {"REQUEST_METHOD": method, "PATH_INFO": path, "CONTENT_LENGTH": str(len(raw)),
           "CONTENT_TYPE": "application/json", "wsgi.input": io.BytesIO(raw)}
    env.update({"HTTP_" + k.upper().replace("-", "_"): v for k, v in (headers or {}).items()})
    setup_testing_defaults(env)
    out = {}
    chunks = app(env, lambda status, headers: out.update(status=int(status.split()[0])))
    data = b"".join(chunks)
    return out["status"], (json.loads(data) if data.strip().startswith((b"{", b"[")) else data.decode("utf-8"))


def new_app(**kw):
    from app import make_app
    return make_app(db_path=":memory:", allowed_origins=["*"], build_ids=["build-1"], admin_token="t", **kw)


def event(name, **fields):
    return {"event_id": uid(), "participant_id": "P01", "session_id": uid(), "event_name": name,
            "client_timestamp_utc": "2026-11-03T12:00:00Z", "build_id": "build-1", **fields}
