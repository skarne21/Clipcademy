"""Tests for check_content.py. Run: python learning/test_check_content.py"""
import copy
import unittest

from check_content import TEST_ITEMS, audit_items, check, load


class CheckContent(unittest.TestCase):
    def test_current_data_is_consistent(self):
        self.assertEqual(check(load()), [])

    def test_freeze_blocks_unreviewed_available_lessons(self):
        data = load()
        data["audit"] = {}
        for p in data["packets"].values():
            p["review_status"] = "draft"
        problems = check(data, freeze=True)
        self.assertTrue(any("dna_replication" in p and "review_status" in p for p in problems), problems)
        self.assertTrue(any("rep-q1" in p and "content-audit" in p for p in problems), problems)
        self.assertFalse(any("transcription" in p for p in problems), "coming_soon topics aren't released")

    def test_freeze_passes_once_reviewed_and_approved(self):
        data = load()
        for p in data["packets"].values():
            p["review_status"] = "reviewed"
        released = [o["objective_id"] for t in data["topics"] if t["availability"] == "available" for o in t["objectives"]]
        item_ids = [i for oid in released for i, _, _ in audit_items(data, oid)] + list(TEST_ITEMS)
        data["audit"] = {i: {"item_id": i, "review_status": "approved"} for i in item_ids}
        self.assertEqual(check(data, freeze=True), [])

    def test_catches_broken_content(self):
        breakages = {
            "unknown source ref": lambda d: d["key"]["rep-q1"].update(source_refs=["L99-p1"]),
            "wrong answer with no misconception": lambda d: d["key"]["rep-q2"]["choices"]["B"].update(misconception_id=None),
            "misconception not in packet": lambda d: d["key"]["rep-q2"]["choices"]["B"].update(misconception_id="nope"),
            "correct choice missing": lambda d: d["key"]["rep-q1"].update(correct_choice_id="Z"),
            "only one retry left": lambda d: d["packets"]["synthesis_direction_and_primer"]["misconceptions"]
                                             ["growth_direction"]["retry_question_ids"].pop(),
            "question missing from key": lambda d: d["key"].pop("rep-r4"),
            "choice ids differ": lambda d: d["questions"]["rep-q1"]["choices"].pop(),
            "topics and packet disagree": lambda d: d["topics"][0]["objectives"][0]["required_question_ids"].pop(),
            "counts_for outside objective": lambda d: d["key"]["rep-r1"].update(counts_for="dr-q1"),
            "variant missing": lambda d: d["packets"]["synthesis_direction_and_primer"]["variants"].pop("primer_followup"),
            "correct answer is the giveaway longest": lambda d: d["questions"]["rep-q1"]["choices"][1].update(
                text="The 3′ end, where DNA polymerase adds each new nucleotide"),
        }
        for name, breakage in breakages.items():
            data = copy.deepcopy(load())
            breakage(data)
            self.assertTrue(check(data), f"not caught: {name}")


if __name__ == "__main__":
    unittest.main()
