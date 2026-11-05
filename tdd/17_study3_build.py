"""The build with captions and disclosure text is tagged study-3."""
import re
import unittest

from _repo import read


class Study3Build(unittest.TestCase):
    def test_web_build_id_is_study_3(self):
        self.assertEqual(re.search(r"BUILD_ID = '([^']+)'", read("web", "src", "config.js")).group(1), "study-3")


if __name__ == "__main__":
    unittest.main()
