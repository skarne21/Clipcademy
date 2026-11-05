"""Answer checking and transition rules for POST /attempts (Member2_SPEC.md, "Grading and transition rules")."""
import copy
import glob
import json
import os
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
MAX_CYCLES = 2
STATUSES = ("in_progress", "complete", "needs_review")
STATE_FIELD = "remediation_state"


def _load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


KEY = _load(os.path.join(HERE, "data", "answer_key.json"))
QUESTIONS = {q["question_id"]: q for q in _load(os.path.join(HERE, "data", "questions.json"))["questions"]}
PACKETS = {p["objective_id"]: p for p in map(_load, glob.glob(os.path.join(HERE, "packets", "*.json")))}


def intro_variant_ids(packet):
    """intro_1, intro_2, … in play order."""
    return sorted((v for v in packet["variants"] if v.startswith("intro_")), key=lambda v: int(v.split("_")[1]))


class GradingError(Exception):
    """status is the HTTP code to return; field names the offending request field."""

    def __init__(self, status, field, message):
        super().__init__(message)
        self.status, self.field, self.message = status, field, message


def _bad(field, message, status=400):
    raise GradingError(status, field, message)


def is_uuid(value):
    """IDs are UUIDs so two browsers (or one browser after Reset demo) can never collide."""
    try:
        return isinstance(value, str) and str(uuid.UUID(value)) == value.lower()
    except ValueError:
        return False


def _read_state(raw, packet):
    """Validate the client-held state; {} is a fresh start (Member2_SPEC, rule 6)."""
    if not isinstance(raw, dict):
        _bad(STATE_FIELD, "must be an object")
    required = packet["required_question_ids"]
    retries = {r for m in packet["misconceptions"].values() for r in m["retry_question_ids"]}
    state = {"objective_status": raw.get("objective_status", "in_progress"),
             "expected_question_id": raw.get("expected_question_id", required[0]),
             "remediation_count": raw.get("remediation_count", 0),
             "satisfied_question_ids": raw.get("satisfied_question_ids", []),
             "asked_retry_ids": raw.get("asked_retry_ids", [])}
    checks = [
        ("objective_status", state["objective_status"] in STATUSES, f"must be one of {', '.join(STATUSES)}"),
        ("expected_question_id", state["expected_question_id"] is None or state["expected_question_id"] in set(required) | retries,
         "is not a question in this objective"),
        ("remediation_count", type(state["remediation_count"]) is int and 0 <= state["remediation_count"] <= MAX_CYCLES,
         f"must be an integer from 0 to {MAX_CYCLES}"),
        ("satisfied_question_ids", isinstance(state["satisfied_question_ids"], list)
         and set(state["satisfied_question_ids"]) <= set(required) | retries, "has a question outside this objective"),
        ("asked_retry_ids", isinstance(state["asked_retry_ids"], list) and set(state["asked_retry_ids"]) <= retries,
         "has a question that is not a retry for this objective"),
    ]
    for name, ok, message in checks:
        if not ok:
            _bad(f"{STATE_FIELD}.{name}", message)
    state["satisfied_question_ids"] = list(state["satisfied_question_ids"])
    state["asked_retry_ids"] = list(state["asked_retry_ids"])
    return state


def grade(req, attempts):
    """Grade one attempt. attempts maps attempt_id -> (request, result) and is updated in place."""
    if not isinstance(req, dict):
        _bad("body", "must be a JSON object")
    attempt_id = req.get("attempt_id")
    if not is_uuid(attempt_id):
        _bad("attempt_id", "must be a UUID, e.g. from crypto.randomUUID()")
    if attempt_id in attempts:
        seen_req, seen_result = attempts[attempt_id]
        if seen_req != req:
            _bad("attempt_id", "already used for a different submission", 409)
        return copy.deepcopy(seen_result)

    packet = PACKETS.get(req.get("objective_id"))
    if packet is None:
        _bad("objective_id", "unknown objective")
    qid = req.get("question_id")
    if qid not in KEY:
        _bad("question_id", "unknown question")
    if QUESTIONS[qid]["objective_id"] != packet["objective_id"]:
        _bad("question_id", f"does not belong to objective {packet['objective_id']}")
    key = KEY[qid]
    choice = key["choices"].get(req.get("selected_choice_id"))
    if choice is None:
        _bad("selected_choice_id", f"unknown choice for {qid}")
    state = _read_state(req.get(STATE_FIELD), packet)
    if state["objective_status"] != "in_progress":
        _bad(f"{STATE_FIELD}.objective_status", f"objective is already {state['objective_status']}; restart first", 409)
    if qid != state["expected_question_id"]:
        _bad("question_id", f"expected {state['expected_question_id']}", 409)

    correct = req["selected_choice_id"] == key["correct_choice_id"]
    result = {"attempt_id": attempt_id, "question_id": qid, "correct": correct, "action": None,
              "feedback": choice["feedback"], "misconception_id": None, "next_video_request": None,
              "next_question_id": None, STATE_FIELD: state, "review_points": None, "source_refs": key["source_refs"]}

    if correct:
        if key["counts_for"] not in state["satisfied_question_ids"]:
            state["satisfied_question_ids"].append(key["counts_for"])
        remaining = [q for q in packet["required_question_ids"] if q not in state["satisfied_question_ids"]]
        if remaining:
            result.update(action="continue_questions", next_question_id=remaining[0])
        else:
            state["objective_status"] = "complete"
            result["action"] = "complete"
    else:
        misconception = packet["misconceptions"][choice["misconception_id"]]
        retries = misconception["retry_question_ids"]
        seen = sum(r in state["asked_retry_ids"] for r in retries)
        # ponytail: out of retries before the cycle limit can't happen with 2 retries per misconception; treat it as the limit
        if state["remediation_count"] >= MAX_CYCLES or seen == len(retries):
            state["objective_status"] = "needs_review"
            result.update(action="needs_review", review_points=packet["review_points"])
        else:
            # first miss on this misconception: v1 clip + first retry; second miss: v2 (explained differently) + second retry
            retry = retries[seen]
            variant_id = misconception["variant_ids"][seen]
            variant = packet["variants"][variant_id]
            state["remediation_count"] += 1
            state["asked_retry_ids"].append(retry)
            result.update(action="review_again", misconception_id=choice["misconception_id"], next_question_id=retry,
                          next_video_request={"topic_id": packet["topic_id"], "objective_id": packet["objective_id"],
                                              "variant_id": variant_id, "teaching_goal": variant["teaching_goal"],
                                              "source_refs": variant["source_refs"]})

    state["expected_question_id"] = result["next_question_id"]
    attempts[attempt_id] = (copy.deepcopy(req), copy.deepcopy(result))
    return result
