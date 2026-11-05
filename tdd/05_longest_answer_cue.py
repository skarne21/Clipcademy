"""The content check flags a correct choice much longer than every distractor, and no question has one."""
import copy
import unittest

from _repo import LEARNING  # noqa: F401  (puts $REPO/learning on the path)
from check_content import check, load


def length_cues(data):
    return [p for p in check(data) if "much longer" in p]


class LongestAnswerCue(unittest.TestCase):
    def test_current_questions_have_no_giveaway_length(self):
        self.assertEqual(length_cues(load()), [])

    def test_a_giveaway_correct_answer_is_flagged(self):
        data = copy.deepcopy(load())
        correct = data["key"]["rep-q1"]["correct_choice_id"]
        choice = next(c for c in data["questions"]["rep-q1"]["choices"] if c["choice_id"] == correct)
        choice["text"] = "The 3' end, where DNA polymerase adds each new nucleotide to the growing strand"
        problems = length_cues(data)
        self.assertTrue(any(p.startswith("rep-q1") for p in problems), f"giveaway-length correct answer not flagged: {problems}")


if __name__ == "__main__":
    unittest.main()
