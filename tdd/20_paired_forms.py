"""10 paired questions per form (A<n> and B<n> test the same idea with a different correct answer),
parsed from assessment.md for the printable PDFs."""
import unittest

from _repo import LEARNING, read  # noqa: F401
from check_content import TEST_ITEMS
import make_test_pdfs


class PairedForms(unittest.TestCase):
    def test_ten_audited_items_per_form(self):
        for form in "AB":
            self.assertEqual(sorted(k for k in TEST_ITEMS if k.startswith(f"test:{form}")),
                             sorted(f"test:{form}{n}" for n in range(1, 11)))

    def test_assessment_parses_into_two_forms_and_a_paired_key(self):
        forms, key = make_test_pdfs.parse(read("Context", "assessment.md"))
        self.assertEqual({f: len(qs) for f, qs in forms.items()}, {"A": 10, "B": 10})
        answers = {item: letter for item, letter, *_ in key}
        for n in range(1, 11):
            self.assertNotEqual(answers[f"A{n}"], answers[f"B{n}"], f"pair {n} has the same correct letter")


if __name__ == "__main__":
    unittest.main()
