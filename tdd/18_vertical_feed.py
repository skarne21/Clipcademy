"""Each objective plays 4-5 intro clips; a second miss of the same misconception gets the v2 clip;
clip_swiped events record direction and seconds watched."""
import unittest

from _repo import call, event, new_app, uid
import grading

OBJ = "synthesis_direction_and_primer"


def attempt(qid, choice, state):
    return {"attempt_id": uid(), "question_id": qid, "selected_choice_id": choice,
            "objective_id": OBJ, "remediation_state": state}


class VerticalFeed(unittest.TestCase):
    def test_topics_list_intro_clips_in_order(self):
        _, topics = call(new_app(), "GET", "/topics")
        for t in topics["topics"]:
            for o in t["objectives"]:
                variants = [r["variant_id"] for r in o["intro_video_requests"]]
                self.assertIn(len(variants), (4, 5))
                self.assertEqual(variants, [f"intro_{i}" for i in range(1, len(variants) + 1)])

    def test_second_miss_of_a_misconception_gets_the_v2_clip(self):
        app = new_app()
        _, r = call(app, "POST", "/attempts", attempt("rep-q1", "A", {}))
        first = r["next_video_request"]["variant_id"]
        missed = grading.KEY["rep-q1"]["choices"]["A"]["misconception_id"]
        retry = r["next_question_id"]
        wrong = next(c for c, v in grading.KEY[retry]["choices"].items() if v["misconception_id"] == missed)
        _, r = call(app, "POST", "/attempts", attempt(retry, wrong, r["remediation_state"]))
        self.assertEqual(r["next_video_request"]["variant_id"], f"{first}_2")

    def test_clip_swiped_is_stored_and_validated(self):
        app = new_app()
        swipe = dict(variant_id="intro_2", direction="up", seconds_watched=7.5)
        self.assertEqual(call(app, "POST", "/events", event("clip_swiped", **swipe))[0], 201)
        status, r = call(app, "POST", "/events", event("clip_swiped", **{**swipe, "direction": "left"}))
        self.assertEqual((status, r["error"]["field"]), (400, "direction"))


if __name__ == "__main__":
    unittest.main()
