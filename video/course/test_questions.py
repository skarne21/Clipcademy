"""US-32: Gemini writes checked practice questions for each objective of an imported course.

Gemini is a fake here: no network, no cost. Written before the implementation (TDD red).
"""
import copy
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))

import fixtures  # noqa: E402
from test_generate import FakeGemini, prompt_text  # noqa: E402

GOOD = {'questions': [
    {'prompt': 'What happens to the price when demand rises and supply stays the same?',
     'choices': [{'choice_id': 'A', 'text': 'It rises'}, {'choice_id': 'B', 'text': 'It falls'},
                 {'choice_id': 'C', 'text': 'It stays the same'}],
     'correct_choice_id': 'A',
     'feedback': {'A': 'Correct. More buyers chase the same supply, so the price rises.',
                  'B': 'Prices fall when supply rises, not when demand rises.',
                  'C': 'A change in demand with the same supply moves the price.'},
     'source_refs': ['econ101-lecture3-p1']},
    {'prompt': 'Sellers raise prices until what happens?',
     'choices': [{'choice_id': 'A', 'text': 'Everyone can buy'},
                 {'choice_id': 'B', 'text': 'Quantity demanded matches quantity supplied'}],
     'correct_choice_id': 'B',
     'feedback': {'A': 'Not everyone can buy at the higher price.',
                  'B': 'Correct. Prices rise until demand matches supply.'},
     'source_refs': ['econ101-lecture3-p1']},
]}


def generate(replies):
    import questions
    fake = FakeGemini(replies)
    return fake, questions.generate_questions(fake, fixtures.BREAKDOWN, 'econ101')


class Validation(unittest.TestCase):
    def check(self, q):
        import questions
        return questions.validate_question(q, {'econ101-lecture3-p1'})

    def test_good_questions_pass(self):
        for q in GOOD['questions']:
            self.assertEqual(self.check(q), [])

    def test_needs_two_to_four_choices(self):
        q = copy.deepcopy(GOOD['questions'][1])
        q['choices'] = q['choices'][:1]
        self.assertTrue(any('choices' in e for e in self.check(q)))

    def test_choice_ids_are_letters_in_order(self):
        q = copy.deepcopy(GOOD['questions'][1])
        q['choices'][1]['choice_id'] = 'D'
        self.assertTrue(any('choice_id' in e for e in self.check(q)))

    def test_correct_answer_must_be_a_choice(self):
        q = copy.deepcopy(GOOD['questions'][0])
        q['correct_choice_id'] = 'D'
        self.assertTrue(any('correct_choice_id' in e for e in self.check(q)))

    def test_every_choice_needs_feedback(self):
        q = copy.deepcopy(GOOD['questions'][0])
        del q['feedback']['C']
        self.assertTrue(any('feedback' in e for e in self.check(q)))

    def test_source_refs_must_come_from_the_objective(self):
        q = copy.deepcopy(GOOD['questions'][0])
        q['source_refs'] = ['made-up-ref']
        self.assertTrue(any('source_refs' in e for e in self.check(q)))

    def test_text_limits(self):
        q = copy.deepcopy(GOOD['questions'][0])
        q['prompt'] = 'x' * 200
        self.assertTrue(any('prompt' in e for e in self.check(q)))


class Generation(unittest.TestCase):
    def test_two_questions_per_objective_with_ids(self):
        fake, result = generate([GOOD])
        self.assertEqual(len(fake.calls), 1)
        self.assertIn('When demand for a good rises', prompt_text(fake.calls[0]))
        ids = [q['question_id'] for q in result['questions']]
        self.assertEqual(ids, ['econ101-price_changes-q1', 'econ101-price_changes-q2'])
        for q in result['questions']:
            self.assertEqual((q['objective_id'], q['topic_id']), ('price_changes', 'supply_and_demand'))

    def test_failing_question_is_retried_once_then_skipped(self):
        bad = copy.deepcopy(GOOD)
        bad['questions'][0]['correct_choice_id'] = 'Z'
        fake, result = generate([bad, bad])
        self.assertEqual(len(fake.calls), 2)
        self.assertIn('correct_choice_id', prompt_text(fake.calls[1]))
        self.assertEqual(len(result['questions']), 1)  # the good one is kept
        self.assertEqual(result['skipped'][0]['objective_id'], 'price_changes')

    def test_retry_that_fixes_it_keeps_both(self):
        bad = copy.deepcopy(GOOD)
        bad['questions'][0]['correct_choice_id'] = 'Z'
        _, result = generate([bad, GOOD])
        self.assertEqual(len(result['questions']), 2)
        self.assertEqual(result['skipped'], [])


if __name__ == '__main__':
    unittest.main()
