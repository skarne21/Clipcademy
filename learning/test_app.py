"""HTTP tests for app.py (Member2_SPEC "Service"). Run: python learning/test_app.py
Regenerate learning/samples/ after a contract change: python learning/test_app.py --write-samples"""
import csv
import io
import json
import os
import sys
import tempfile
import unittest
from wsgiref.util import setup_testing_defaults

os.environ.setdefault("CLIPCADEMY_DB", ":memory:")  # importing app must not create a real database
from app import make_app  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLES = os.path.join(HERE, "samples")
OBJ = "synthesis_direction_and_primer"
TOKEN = "test-token"


def new_app(db=":memory:", **kw):
    return make_app(db_path=db, **{"allowed_origins": ["*"], "build_ids": ["build-1"], "admin_token": TOKEN, **kw})


def call(app, method, path, body=None, headers=None):
    """Run one request through the WSGI app. Returns (status_code, headers, parsed_body)."""
    raw = b"" if body is None else (body if isinstance(body, bytes) else json.dumps(body).encode())
    env = {"REQUEST_METHOD": method, "PATH_INFO": path, "CONTENT_LENGTH": str(len(raw)),
           "CONTENT_TYPE": "application/json", "wsgi.input": io.BytesIO(raw)}
    env.update({"HTTP_" + k.upper().replace("-", "_"): v for k, v in (headers or {}).items()})
    setup_testing_defaults(env)
    out = {}
    chunks = app(env, lambda status, hdrs: out.update(status=int(status.split()[0]), headers=dict(hdrs)))
    text = b"".join(chunks).decode()
    is_json = out["headers"].get("Content-Type", "").startswith("application/json")
    return out["status"], out["headers"], json.loads(text) if is_json and text else text


def event(**overrides):
    return {"event_id": "e1", "participant_id": "P01", "session_id": "s1", "event_name": "app_opened",
            "client_timestamp_utc": "2026-11-03T15:00:00Z", "build_id": "build-1", **overrides}


def attempt(qid, choice, state, attempt_id):
    return {"attempt_id": attempt_id, "question_id": qid, "selected_choice_id": choice, "objective_id": OBJ,
            "remediation_state": state}


class Content(unittest.TestCase):
    def test_topics(self):
        status, _, body = call(new_app(), "GET", "/topics")
        self.assertEqual(status, 200)
        self.assertEqual([t["topic_id"] for t in body["topics"]],
                         ["dna_replication", "dna_repair", "transcription", "translation"])

    def test_11_question_has_no_answer_fields(self):
        status, _, body = call(new_app(), "GET", "/questions/rep-q2")
        self.assertEqual(status, 200)
        self.assertEqual(set(body), {"question_id", "objective_id", "prompt", "choices"})
        self.assertNotIn("correct", json.dumps(body))
        self.assertNotIn("misconception", json.dumps(body))

    def test_unknown_question_is_404(self):
        status, _, body = call(new_app(), "GET", "/questions/nope")
        self.assertEqual((status, body["error"]["field"]), (404, "question_id"))

    def test_unknown_path_and_wrong_method(self):
        self.assertEqual(call(new_app(), "GET", "/nope")[0], 404)
        self.assertEqual(call(new_app(), "GET", "/attempts")[0], 405)


class Attempts(unittest.TestCase):
    def test_demo_walkthrough_over_http(self):
        app, state = new_app(), {}
        for i, (q, c) in enumerate([("rep-q1", "B"), ("rep-q2", "B"), ("rep-r2", "B")]):
            status, _, body = call(app, "POST", "/attempts", attempt(q, c, state, f"a{i}"))
            self.assertEqual(status, 200)
            state = body["remediation_state"]
        self.assertEqual(body["action"], "complete")

    def test_idempotency_survives_restart(self):
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as d:
            db = os.path.join(d, "t.db")
            first = call(new_app(db), "POST", "/attempts", attempt("rep-q1", "A", {}, "x"))
            second = call(new_app(db), "POST", "/attempts", attempt("rep-q1", "A", {}, "x"))
            self.assertEqual(first[2], second[2])
            self.assertEqual(call(new_app(db), "POST", "/attempts", attempt("rep-q1", "B", {}, "x"))[0], 409)

    def test_errors_use_contract_shape(self):
        status, _, body = call(new_app(), "POST", "/attempts", attempt("rep-q2", "A", {}, "x"))
        self.assertEqual(status, 409)
        self.assertEqual(set(body["error"]), {"field", "message"})
        self.assertEqual(call(new_app(), "POST", "/attempts", b"{not json")[2]["error"]["field"], "body")

    def test_oversized_body_is_413(self):
        self.assertEqual(call(new_app(), "POST", "/attempts", b"x" * 70_000)[0], 413)


class Events(unittest.TestCase):
    def export(self, app, token=TOKEN):
        status, headers, text = call(app, "GET", "/events.csv", headers={"Authorization": f"Bearer {token}"})
        return status, headers, list(csv.DictReader(io.StringIO(text))) if status == 200 else text

    def test_8d_repeated_event_id_stored_once(self):
        app = new_app()
        self.assertEqual(call(app, "POST", "/events", event())[0], 201)
        status, _, body = call(app, "POST", "/events", event())
        self.assertEqual((status, body), (200, {"duplicate": True}))
        self.assertEqual(len(self.export(app)[2]), 1)

    def test_8e_build_id_status(self):
        app = new_app()
        call(app, "POST", "/events", event(event_id="ok"))
        call(app, "POST", "/events", {k: v for k, v in event(event_id="missing").items() if k != "build_id"})
        call(app, "POST", "/events", event(event_id="unknown", build_id="old-build"))
        rows = self.export(app)[2]
        self.assertEqual({r["event_id"]: r["build_id_status"] for r in rows},
                         {"ok": "ok", "missing": "missing", "unknown": "unknown"})

    def test_export_columns_match_context_events_csv(self):
        with open(os.path.join(HERE, "..", "Context", "events.csv"), encoding="utf-8") as f:
            header = f.readline().strip()
        app = new_app()
        call(app, "POST", "/events", event(event_name="question_answered", question_id="rep-q1", correct=False,
                                           topic_id="dna_replication", objective_id=OBJ))
        status, headers, text = call(app, "GET", "/events.csv", headers={"Authorization": f"Bearer {TOKEN}"})
        self.assertEqual((status, text.splitlines()[0]), (200, header))
        self.assertTrue(headers["Content-Type"].startswith("text/csv"))
        row = next(csv.DictReader(io.StringIO(text)))
        self.assertEqual((row["correct"], row["client_timestamp_utc"]), ("false", "2026-11-03T15:00:00Z"))
        self.assertTrue(row["timestamp_utc"].endswith("Z"))

    def test_export_needs_token(self):
        app = new_app()
        self.assertEqual(self.export(app, token="wrong")[0], 401)
        self.assertEqual(call(app, "GET", "/events.csv")[0], 401)
        self.assertEqual(self.export(new_app(admin_token=None), token="None")[0], 401)

    def test_invalid_events_are_400_naming_the_field(self):
        cases = [("event_name", event(event_name="clicked")),
                 ("participant_id", event(participant_id="")),
                 ("client_timestamp_utc", event(client_timestamp_utc="yesterday")),
                 ("client_timestamp_utc", event(client_timestamp_utc="2026-11-03T15:00:00")),  # no time zone
                 ("topic_id", event(event_name="topic_selected")),
                 ("variant_id", event(event_name="video_started")),
                 ("correct", event(event_name="question_answered", question_id="rep-q1", correct="yes")),
                 ("objective_id", event(event_name="objective_completed")),
                 ("build_id", event(build_id=7))]
        for field, body in cases:
            status, _, resp = call(new_app(), "POST", "/events", body)
            self.assertEqual((status, resp["error"]["field"]), (400, field), body)

    def test_client_time_is_normalized_to_utc(self):
        app = new_app()
        call(app, "POST", "/events", event(client_timestamp_utc="2026-11-03T10:00:00-05:00"))
        self.assertEqual(self.export(app)[2][0]["client_timestamp_utc"], "2026-11-03T15:00:00Z")


class Cors(unittest.TestCase):
    def test_preflight_and_origin_list(self):
        app = new_app(allowed_origins=["https://app.example"])
        status, headers, _ = call(app, "OPTIONS", "/attempts", headers={"Origin": "https://app.example"})
        self.assertEqual((status, headers["Access-Control-Allow-Origin"]), (204, "https://app.example"))
        _, headers, _ = call(app, "GET", "/topics", headers={"Origin": "https://evil.example"})
        self.assertNotIn("Access-Control-Allow-Origin", headers)
        _, headers, _ = call(new_app(), "GET", "/topics", headers={"Origin": "https://any.example"})
        self.assertEqual(headers["Access-Control-Allow-Origin"], "*")


# Sample responses for Member 3 (task 7): real outputs of the app, so they can't drift from the contract.
def sample_exchanges():
    app, out = new_app(), {}

    def record(name, method, path, body=None):
        status, _, resp = call(app, method, path, body)
        out[name] = {"request": {"method": method, "path": path, "body": body}, "status": status, "response": resp}
        return resp

    record("topics", "GET", "/topics")
    record("question.rep-q2", "GET", "/questions/rep-q2")
    s = record("attempt.continue_questions", "POST", "/attempts", attempt("rep-q1", "B", {}, "attempt-001"))
    s = record("attempt.review_again", "POST", "/attempts", attempt("rep-q2", "B", s["remediation_state"], "attempt-002"))
    record("attempt.complete", "POST", "/attempts", attempt("rep-r2", "B", s["remediation_state"], "attempt-003"))
    s = {}
    for i, (q, c) in enumerate([("rep-q1", "A"), ("rep-r1", "B")]):
        s = call(app, "POST", "/attempts", attempt(q, c, s.get("remediation_state", {}), f"nr-{i}"))[2]
    record("attempt.needs_review", "POST", "/attempts", attempt("rep-r3", "B", s["remediation_state"], "attempt-004"))
    record("error.400_unknown_choice", "POST", "/attempts", attempt("rep-q1", "Z", {}, "attempt-005"))
    record("error.409_out_of_order", "POST", "/attempts", attempt("rep-q2", "A", {}, "attempt-006"))
    ev = event(event_id="evt-001", event_name="question_answered", topic_id="dna_replication", objective_id=OBJ,
               question_id="rep-q1", correct=True)
    record("event.201_stored", "POST", "/events", ev)
    record("event.200_duplicate", "POST", "/events", ev)
    record("error.400_event_missing_field", "POST", "/events", event(event_id="evt-002", event_name="topic_selected"))
    return out


class Samples(unittest.TestCase):
    def test_committed_samples_match_app(self):
        for name, exchange in sample_exchanges().items():
            with open(os.path.join(SAMPLES, f"{name}.json"), encoding="utf-8") as f:
                self.assertEqual(json.load(f), exchange, f"{name}.json is stale; run with --write-samples")


if __name__ == "__main__":
    if "--write-samples" in sys.argv:
        os.makedirs(SAMPLES, exist_ok=True)
        for name, exchange in sample_exchanges().items():
            with open(os.path.join(SAMPLES, f"{name}.json"), "w", encoding="utf-8", newline="\n") as f:
                json.dump(exchange, f, ensure_ascii=False, indent=2)
                f.write("\n")
        print(f"wrote {len(sample_exchanges())} samples to {SAMPLES}")
    else:
        unittest.main()
