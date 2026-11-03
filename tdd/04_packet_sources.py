"""The replication packet quotes the L19 lines its feedback relies on, and feedback stays within its sources."""
import json
import os
import unittest

from _repo import LEARNING


class PacketSources(unittest.TestCase):
    def test_replication_packet_cites_anti_parallel_and_ligase_lines(self):
        with open(os.path.join(LEARNING, "packets", "dna_replication.synthesis_direction_and_primer.json"), encoding="utf-8") as f:
            texts = [e["text"] for e in json.load(f)["source_excerpts"] if e["ref"] == "L19-p1"]
        self.assertTrue(any("anti-parallel" in t for t in texts), texts)
        self.assertTrue(any("DNA ligase closes this gap" in t for t in texts), texts)

    def test_feedback_no_longer_claims_what_the_sources_dont_say(self):
        with open(os.path.join(LEARNING, "data", "answer_key.json"), encoding="utf-8") as f:
            key = json.load(f)
        feedback = [c["feedback"] for q in key.values() for c in q["choices"].values()]
        for unsourced in ("Ligase joins DNA fragments.", "Ligase joins backbone gaps.", "Primers belong to replication"):
            self.assertFalse(any(unsourced in f for f in feedback), unsourced)


if __name__ == "__main__":
    unittest.main()
