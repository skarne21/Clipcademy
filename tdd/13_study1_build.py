"""The validation build opens DNA repair and is tagged study-1, so its events can be told apart."""
import re
import unittest

from _repo import call, new_app, read


class Study1Build(unittest.TestCase):
    def test_dna_repair_is_available(self):
        _, topics = call(new_app(), "GET", "/topics")
        availability = {t["topic_id"]: t["availability"] for t in topics["topics"]}
        self.assertEqual(availability["dna_repair"], "available")

    def test_web_build_id_is_study_1(self):
        self.assertEqual(re.search(r"BUILD_ID = '([^']+)'", read("web", "src", "config.js")).group(1), "study-1")


if __name__ == "__main__":
    unittest.main()
