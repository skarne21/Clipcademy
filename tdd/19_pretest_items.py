"""The pre/post tests have 8 questions per form across all four lectures, and every one is audited."""
import unittest

from _repo import LEARNING  # noqa: F401  (puts $REPO/learning on the path)
from check_content import TEST_ITEMS


class PretestItems(unittest.TestCase):
    def test_eight_audited_items_per_form_covering_lectures_19_to_22(self):
        for form in "AB":
            items = {k: v for k, v in TEST_ITEMS.items() if k.startswith(f"test:{form}")}
            self.assertEqual(sorted(items), [f"test:{form}{n}" for n in range(1, 9)])
            lectures = {ref.split("-")[0] for refs in items.values() for ref in refs.split(";")}
            self.assertEqual(lectures, {"L19", "L20", "L21", "L22"})


if __name__ == "__main__":
    unittest.main()
