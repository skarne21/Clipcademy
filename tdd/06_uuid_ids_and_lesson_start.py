"""Attempt and event IDs must be UUIDs; /topics gives each objective the request that starts its lesson;
question_answered events take topic and objective from the question, not the client."""
import csv
import io
import unittest

from _repo import call, event, new_app


class IntegrationFixes(unittest.TestCase):
    def test_counter_style_ids_are_rejected(self):
        app = new_app()
        status, r = call(app, "POST", "/attempts", {"attempt_id": "a1", "question_id": "rep-q1", "selected_choice_id": "B",
                                                    "objective_id": "synthesis_direction_and_primer", "remediation_state": {}})
        self.assertEqual(status, 400, "attempt_id 'a1' accepted")
        self.assertEqual(r["error"]["field"], "attempt_id")
        status, r = call(app, "POST", "/events", {**event("app_opened"), "event_id": "e1"})
        self.assertEqual(status, 400, "event_id 'e1' accepted")
        self.assertEqual(r["error"]["field"], "event_id")

    def test_topics_carry_the_initial_video_request(self):
        _, topics = call(new_app(), "GET", "/topics")
        req = topics["topics"][0]["objectives"][0]["initial_video_request"]
        self.assertEqual((req["topic_id"], req["objective_id"], req["variant_id"]),
                         ("dna_replication", "synthesis_direction_and_primer", "initial"))

    def test_question_answered_topic_comes_from_the_question(self):
        app = new_app()
        status, _ = call(app, "POST", "/events", event("question_answered", question_id="rep-q1", correct=True,
                                                         topic_id="dna_repair", objective_id="error_correction"))
        self.assertEqual(status, 201)
        status, body = call(app, "GET", "/events.csv", headers={"Authorization": "Bearer t"})
        row = list(csv.DictReader(io.StringIO(body)))[-1]
        self.assertEqual((row["topic_id"], row["objective_id"]), ("dna_replication", "synthesis_direction_and_primer"))


if __name__ == "__main__":
    unittest.main()
