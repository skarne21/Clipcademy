"""Task 11 content check: sources, answer key, stopping rules, and (with --freeze) review status.
  python learning/check_content.py               consistency only (run any time; exit 1 on problems)
  python learning/check_content.py --freeze      also require reviewed packets and approved audit rows for available topics
  python learning/check_content.py --write-audit add a pending content-audit.csv row for every item still missing one"""
import csv
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIT = os.path.join(HERE, "..", "Context", "content-audit.csv")
AUDIT_COLUMNS = ["item_id", "item_type", "source_refs", "reviewer", "review_status", "overlaps_app_question",
                 "error_severity", "correction", "approved_version"]
MAX_CYCLES = 2
# assessment.md items: every one is audited, including whether it overlaps an app question
TEST_ITEMS = {"test:A1": "L19-p1;L19-p2", "test:A2": "L19-p1", "test:A3": "L19-p1;L19-p2",
              "test:B1": "L19-p1;L19-p2", "test:B2": "L19-p1", "test:B3": "L19-p1;L19-p2"}


def _json(*parts):
    with open(os.path.join(HERE, *parts), encoding="utf-8") as f:
        return json.load(f)


def load():
    audit = {}
    if os.path.exists(AUDIT):
        with open(AUDIT, encoding="utf-8", newline="") as f:
            audit = {row["item_id"]: row for row in csv.DictReader(f)}
    return {"topics": _json("data", "topics.json")["topics"],
            "questions": {q["question_id"]: q for q in _json("data", "questions.json")["questions"]},
            "key": _json("data", "answer_key.json"),
            "packets": {p["objective_id"]: p for p in (_json("packets", os.path.basename(f))
                                                        for f in glob.glob(os.path.join(HERE, "packets", "*.json")))},
            "audit": audit}


def audit_items(data, objective_id):
    """(item_id, item_type, source_refs) for everything a reviewer must approve before an objective is released."""
    packet = data["packets"][objective_id]
    yield f"packet:{objective_id}", "lesson_packet", ";".join(sorted({e["ref"] for e in packet["source_excerpts"]}))
    for variant_id, variant in packet["variants"].items():
        yield f"clip:{objective_id}:{variant_id}", "clip_transcript", ";".join(variant["source_refs"])
    for qid, q in data["questions"].items():
        if q["objective_id"] == objective_id:
            refs = ";".join(data["key"][qid]["source_refs"])
            yield qid, "question", refs
            for choice_id in data["key"][qid]["choices"]:
                yield f"{qid}:{choice_id}", "feedback", refs


def check(data, freeze=False):
    problems = []
    key, questions, packets = data["key"], data["questions"], data["packets"]
    for qid in sorted(set(questions) ^ set(key)):
        problems.append(f"{qid}: in only one of questions.json and answer_key.json")

    for qid in sorted(set(questions) & set(key)):
        q, k = questions[qid], key[qid]
        packet = packets.get(q["objective_id"])
        if packet is None:
            problems.append(f"{qid}: objective {q['objective_id']} has no packet")
            continue
        refs = {e["ref"] for e in packet["source_excerpts"]}
        if {c["choice_id"] for c in q["choices"]} != set(k["choices"]):
            problems.append(f"{qid}: choice IDs differ between questions.json and answer_key.json")
        if k["correct_choice_id"] not in k["choices"]:
            problems.append(f"{qid}: correct_choice_id {k['correct_choice_id']} is not a choice")
        if not k["source_refs"] or not set(k["source_refs"]) <= refs:
            problems.append(f"{qid}: source_refs {k['source_refs']} must be non-empty and in the packet's excerpts {sorted(refs)}")
        if k["counts_for"] not in packet["required_question_ids"]:
            problems.append(f"{qid}: counts_for {k['counts_for']} is not a required question of {q['objective_id']}")
        for choice_id, choice in k["choices"].items():
            if not choice["feedback"].strip():
                problems.append(f"{qid}:{choice_id}: feedback is empty")
            m = choice["misconception_id"]
            if choice_id == k["correct_choice_id"] and m is not None:
                problems.append(f"{qid}:{choice_id}: the correct choice must have no misconception")
            if choice_id != k["correct_choice_id"] and m not in packet["misconceptions"]:
                problems.append(f"{qid}:{choice_id}: misconception {m} is not in the packet")

    for oid, packet in packets.items():
        refs = {e["ref"] for e in packet["source_excerpts"]}
        for m_id, m in packet["misconceptions"].items():
            if m["variant_id"] not in packet["variants"]:
                problems.append(f"{oid}: misconception {m_id} points to missing variant {m['variant_id']}")
            if len(m["retry_question_ids"]) < MAX_CYCLES:
                problems.append(f"{oid}: misconception {m_id} needs {MAX_CYCLES} retries so a retry never repeats")
            for r in m["retry_question_ids"]:
                if r not in key or questions.get(r, {}).get("objective_id") != oid:
                    problems.append(f"{oid}: retry {r} is not a question of this objective")
        for v_id, v in packet["variants"].items():
            if not v["source_refs"] or not set(v["source_refs"]) <= refs:
                problems.append(f"{oid}: variant {v_id} source_refs must be non-empty and in the excerpts")

    for topic in data["topics"]:
        for obj in topic["objectives"]:
            packet = packets.get(obj["objective_id"])
            if packet is None:
                problems.append(f"{topic['topic_id']}: objective {obj['objective_id']} has no packet")
            elif obj["required_question_ids"] != packet["required_question_ids"] or packet["topic_id"] != topic["topic_id"]:
                problems.append(f"{obj['objective_id']}: topics.json and its packet disagree on topic or required questions")

    if freeze:
        approved = {i for i, row in data["audit"].items() if row["review_status"] == "approved"}
        for topic in (t for t in data["topics"] if t["availability"] == "available"):
            for obj in topic["objectives"]:
                oid = obj["objective_id"]
                if packets[oid]["review_status"] != "reviewed":
                    problems.append(f"{topic['topic_id']}: packet {oid} has review_status "
                                    f"{packets[oid]['review_status']!r}; set it to 'reviewed' or make the topic coming_soon")
                problems += [f"{item_id}: not approved in content-audit.csv"
                             for item_id, _, _ in audit_items(data, oid) if item_id not in approved]
        problems += [f"{i}: not approved in content-audit.csv" for i in TEST_ITEMS if i not in approved]
    return problems


def write_audit(data, objective_ids):
    rows = list(data["audit"].values())
    wanted = [i for oid in objective_ids for i in audit_items(data, oid)] + [(i, "test_item", r) for i, r in TEST_ITEMS.items()]
    added = [{**dict.fromkeys(AUDIT_COLUMNS, ""), "item_id": i, "item_type": t, "source_refs": r, "review_status": "pending"}
             for i, t, r in wanted if i not in data["audit"]]
    with open(AUDIT, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, AUDIT_COLUMNS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows + added)
    return len(added)


if __name__ == "__main__":
    data = load()
    if "--write-audit" in sys.argv:
        # the validation build's lessons (validation-plan.md); transcription and translation stay coming_soon
        print(f"added {write_audit(data, ['synthesis_direction_and_primer', 'error_correction'])} rows to {AUDIT}")
        sys.exit(0)
    found = check(data, freeze="--freeze" in sys.argv)
    print("\n".join(found) or "content check passed")
    sys.exit(1 if found else 0)
