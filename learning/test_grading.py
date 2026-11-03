"""Member2_SPEC test cases for the grading module. Run: python learning/test_grading.py"""
import unittest
import uuid

from grading import KEY, PACKETS, GradingError, grade

OBJ = "synthesis_direction_and_primer"


def uid(label):
    """A stable UUID per test label; attempt IDs must be UUIDs."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, label))


def attempt(qid, choice, state, attempt_id="x", objective_id=OBJ):
    return {"attempt_id": uid(attempt_id), "question_id": qid, "selected_choice_id": choice,
            "objective_id": objective_id, "remediation_state": state}


def play(*steps, attempts=None):
    """Answer each "question=choice" step in order from an empty state, threading remediation_state."""
    attempts = {} if attempts is None else attempts
    state, results = {}, []
    for i, step in enumerate(steps):
        q, c = step.split("=")
        r = grade(attempt(f"rep-{q}", c, state, f"a{i}"), attempts)
        state = r["remediation_state"]
        results.append(r)
    return results


class SpecCases(unittest.TestCase):
    def assertError(self, status, field, req, attempts=None):
        with self.assertRaises(GradingError) as e:
            grade(req, {} if attempts is None else attempts)
        self.assertEqual((e.exception.status, e.exception.field), (status, field))
        return e.exception

    def test_1_correct_q1_continues_to_q2(self):
        r = play("q1=B")[-1]
        self.assertEqual((r["action"], r["next_question_id"]), ("continue_questions", "rep-q2"))
        self.assertIsNone(r["next_video_request"])
        self.assertEqual(r["remediation_state"], {"objective_status": "in_progress", "expected_question_id": "rep-q2",
                                                  "remediation_count": 0, "satisfied_question_ids": ["rep-q1"],
                                                  "asked_retry_ids": []})

    def test_2_both_correct_completes(self):
        r = play("q1=B", "q2=A")[-1]
        self.assertEqual(r["action"], "complete")
        self.assertIsNone(r["next_question_id"])
        self.assertEqual(r["remediation_state"]["objective_status"], "complete")
        self.assertIsNone(r["remediation_state"]["expected_question_id"])

    def test_3_wrong_q1_direction_followup(self):
        r = play("q1=A")[-1]
        self.assertEqual(r["action"], "review_again")
        self.assertEqual(r["misconception_id"], "growth_direction")
        self.assertEqual(r["next_video_request"]["variant_id"], "direction_followup")
        self.assertEqual(r["next_question_id"], "rep-r1")
        self.assertEqual(r["remediation_state"]["remediation_count"], 1)

    def test_4_q2_b_matches_contract_example(self):
        r = play("q1=B", "q2=B")[-1]
        r["attempt_id"] = "attempt-001"
        self.assertEqual(r, {
            "attempt_id": "attempt-001", "question_id": "rep-q2", "correct": False, "action": "review_again",
            "feedback": "Ligase joins pieces of DNA. It does not add the new bases. DNA polymerase extends a primer that primase made.",
            "misconception_id": "primer_requirement",
            "next_video_request": {"topic_id": "dna_replication", "objective_id": OBJ, "variant_id": "primer_followup",
                                   "teaching_goal": "Explain why DNA polymerase needs a primer",
                                   "source_refs": ["L19-p1", "L19-p2"]},
            "next_question_id": "rep-r2",
            "remediation_state": {"objective_status": "in_progress", "expected_question_id": "rep-r2",
                                  "remediation_count": 1, "satisfied_question_ids": ["rep-q1"],
                                  "asked_retry_ids": ["rep-r2"]},
            "review_points": None, "source_refs": ["L19-p1", "L19-p2"]})

    def test_5_q2_c_goes_to_direction(self):
        r = play("q1=B", "q2=C")[-1]
        self.assertEqual((r["next_video_request"]["variant_id"], r["next_question_id"]), ("direction_followup", "rep-r1"))

    def test_5b_r1_does_not_count_for_q2(self):
        r = play("q1=B", "q2=C", "r1=A")[-1]
        self.assertEqual((r["action"], r["next_question_id"]), ("continue_questions", "rep-q2"))

    def test_5c_correct_answer_does_not_reset_count(self):
        rs = play("q1=A", "r1=A", "q2=B", "r2=A")
        self.assertEqual((rs[2]["action"], rs[2]["remediation_state"]["remediation_count"]), ("review_again", 2))
        self.assertEqual(rs[3]["action"], "needs_review")

    def test_6_demo_walkthrough(self):
        self.assertEqual(play("q1=B", "q2=B", "r2=B")[-1]["action"], "complete")

    def test_7_retry_counts_for_q1(self):
        r = play("q1=A", "r1=A")[-1]
        self.assertEqual((r["action"], r["next_question_id"]), ("continue_questions", "rep-q2"))

    def test_8_two_failed_cycles_need_review(self):
        rs = play("q1=A", "r1=B", "r3=B")
        self.assertEqual((rs[1]["action"], rs[1]["next_question_id"]), ("review_again", "rep-r3"))
        self.assertEqual(rs[1]["remediation_state"]["remediation_count"], 2)
        r = rs[2]
        self.assertEqual(r["action"], "needs_review")
        self.assertIsNone(r["next_video_request"])
        self.assertIsNone(r["next_question_id"])
        self.assertEqual(r["remediation_state"]["objective_status"], "needs_review")
        self.assertIsNone(r["remediation_state"]["expected_question_id"])

    def test_8b_second_retry_correct(self):
        r = play("q1=A", "r1=B", "r3=A")[-1]
        self.assertEqual((r["action"], r["next_question_id"]), ("continue_questions", "rep-q2"))

    def test_8c_second_primer_cycle_uses_r4(self):
        r = play("q1=B", "q2=B", "r2=C")[-1]
        self.assertEqual((r["action"], r["next_question_id"]), ("review_again", "rep-r4"))
        self.assertEqual(r["next_video_request"]["variant_id"], "primer_followup")

    def test_8f_needs_review_explanation(self):
        r = play("q1=A", "r1=B", "r3=B")[-1]
        self.assertEqual(r["feedback"], KEY["rep-r3"]["choices"]["B"]["feedback"])
        self.assertEqual(r["review_points"], PACKETS[OBJ]["variants"]["initial"]["key_points"])

    def test_9_repeated_attempt_is_idempotent(self):
        attempts = {}
        first, second = grade(attempt("rep-q1", "A", {}), attempts), grade(attempt("rep-q1", "A", {}), attempts)
        self.assertEqual(first, second)
        self.assertEqual(second["remediation_state"]["remediation_count"], 1)
        self.assertEqual(len(attempts), 1)

    def test_9b_same_attempt_id_different_body_is_409(self):
        attempts = {}
        first = grade(attempt("rep-q1", "B", {}), attempts)
        self.assertError(409, "attempt_id", attempt("rep-q1", "A", {}), attempts)
        self.assertEqual(grade(attempt("rep-q1", "B", {}), attempts), first)

    def test_10_unknown_ids_are_400_naming_the_field(self):
        for field, value in [("question_id", "nope"), ("selected_choice_id", "Z"), ("objective_id", "nope"),
                             ("question_id", "dr-q1"), ("attempt_id", ""), ("attempt_id", "attempt-001"), ("remediation_state", "x")]:
            self.assertError(400, field, {**attempt("rep-q1", "A", {}), field: value})
        self.assertError(400, "body", ["not", "an", "object"])

    def test_10b_inconsistent_state_is_400(self):
        for field, value in [("asked_retry_ids", ["dr-r1"]), ("asked_retry_ids", ["rep-q1"]),
                             ("satisfied_question_ids", ["dr-q1"]), ("remediation_count", 3),
                             ("remediation_count", "1"), ("objective_status", "done"),
                             ("expected_question_id", "dr-q1")]:
            self.assertError(400, f"remediation_state.{field}", attempt("rep-q1", "B", {field: value}))

    def test_10c_attempt_after_finish_is_409(self):
        for steps in [("q1=B", "q2=A"), ("q1=A", "r1=B", "r3=B")]:
            state = play(*steps)[-1]["remediation_state"]
            self.assertError(409, "remediation_state.objective_status", attempt("rep-q1", "B", state, "late"))

    def test_10d_out_of_order_question_is_409(self):
        e = self.assertError(409, "question_id", attempt("rep-q2", "A", {}))
        self.assertIn("rep-q1", e.message)


class EveryPath(unittest.TestCase):
    """Walk every possible answer sequence for every objective and check the flow invariants on each step."""

    def test_invariants_hold_on_every_path(self):
        endings = []

        def walk(oid, state, shown, depth):
            self.assertLess(depth, 12, "flow did not terminate")
            qid = state.get("expected_question_id") or PACKETS[oid]["required_question_ids"][0]
            for choice in KEY[qid]["choices"]:
                req = attempt(qid, choice, state, f"{oid}-{depth}-{len(endings)}-{choice}-{qid}", oid)
                r = grade(req, {})
                st = r["remediation_state"]
                self.assertEqual(r["feedback"], KEY[qid]["choices"][choice]["feedback"])
                self.assertLessEqual(st["remediation_count"], 2)
                self.assertEqual(st["expected_question_id"], r["next_question_id"])
                if r["action"] == "review_again":
                    self.assertNotIn(r["next_question_id"], shown, "a retry was shown twice")
                    self.assertIn(r["next_video_request"]["variant_id"], PACKETS[oid]["variants"])
                else:
                    self.assertIsNone(r["next_video_request"])
                if r["action"] == "complete":
                    self.assertLessEqual(set(PACKETS[oid]["required_question_ids"]), set(st["satisfied_question_ids"]))
                if r["next_question_id"] is None:
                    endings.append(r["action"])
                    with self.assertRaises(GradingError):  # a finished objective refuses more attempts
                        grade({**req, "attempt_id": uid(f"late-{len(endings)}"), "remediation_state": st}, {})
                else:
                    walk(oid, st, shown | {r["next_question_id"]}, depth + 1)

        for oid, packet in PACKETS.items():
            walk(oid, {}, {packet["required_question_ids"][0]}, 0)
        self.assertEqual(len(endings), 152)
        self.assertEqual(set(endings), {"complete", "needs_review"})


class Extra(unittest.TestCase):
    def test_client_state_is_not_mutated(self):
        state = {"remediation_count": 0, "satisfied_question_ids": [], "asked_retry_ids": []}
        grade(attempt("rep-q1", "A", state), {})
        self.assertEqual(state, {"remediation_count": 0, "satisfied_question_ids": [], "asked_retry_ids": []})

    def test_repair_objective_uses_its_own_packet(self):
        r = grade(attempt("dr-q1", "A", {}, objective_id="error_correction"), {})
        self.assertEqual((r["next_video_request"]["variant_id"], r["next_question_id"]), ("timing_followup", "dr-r1"))


if __name__ == "__main__":
    unittest.main()
