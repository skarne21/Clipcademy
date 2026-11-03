"""The learning service grades answers over HTTP and walks an objective to completion."""
import unittest

from _repo import call, new_app, uid

OBJ = "synthesis_direction_and_primer"


def attempt(qid, choice, state):
    return {"attempt_id": uid(), "question_id": qid, "selected_choice_id": choice,
            "objective_id": OBJ, "remediation_state": state}


class GradingService(unittest.TestCase):
    def test_two_correct_answers_complete_the_objective(self):
        app = new_app()
        status, r = call(app, "POST", "/attempts", attempt("rep-q1", "B", {}))
        self.assertEqual((status, r["action"], r["next_question_id"]), (200, "continue_questions", "rep-q2"))
        status, r = call(app, "POST", "/attempts", attempt("rep-q2", "A", r["remediation_state"]))
        self.assertEqual((status, r["action"], r["remediation_state"]["objective_status"]), (200, "complete", "complete"))

    def test_wrong_answer_asks_for_a_follow_up_clip(self):
        status, r = call(new_app(), "POST", "/attempts", attempt("rep-q1", "A", {}))
        self.assertEqual(status, 200)
        self.assertEqual(r["next_video_request"]["objective_id"], OBJ)

    def test_unknown_choice_is_a_400_naming_the_field(self):
        status, r = call(new_app(), "POST", "/attempts", attempt("rep-q1", "Z", {}))
        self.assertEqual((status, r["error"]["field"]), (400, "selected_choice_id"))


if __name__ == "__main__":
    unittest.main()
