"""The four lesson topics exist as data, and every objective has a lesson packet whose questions are keyed."""
import json
import os
import unittest

from _repo import LEARNING


def load(*parts):
    with open(os.path.join(LEARNING, *parts), encoding="utf-8") as f:
        return json.load(f)


class LearningData(unittest.TestCase):
    def test_four_topics_each_objective_has_a_packet_and_keyed_questions(self):
        topics = load("data", "topics.json")["topics"]
        self.assertEqual([t["topic_id"] for t in topics], ["dna_replication", "dna_repair", "transcription", "translation"])
        questions = {q["question_id"] for q in load("data", "questions.json")["questions"]}
        key = load("data", "answer_key.json")
        for t in topics:
            for o in t["objectives"]:
                packet = load("packets", f"{t['topic_id']}.{o['objective_id']}.json")
                self.assertEqual(packet["objective_id"], o["objective_id"])
                for qid in o["required_question_ids"]:
                    self.assertIn(qid, questions)
                    self.assertIn(key[qid]["correct_choice_id"], key[qid]["choices"])


if __name__ == "__main__":
    unittest.main()
