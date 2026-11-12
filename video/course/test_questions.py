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


def retry(misconception_id, prompt):
    return {'misconception_id': misconception_id, 'prompt': prompt,
            'choices': [{'choice_id': 'A', 'text': 'The price rises'}, {'choice_id': 'B', 'text': 'The price falls'}],
            'correct_choice_id': 'A' if misconception_id == 'demand_down' else 'B',
            'feedback': {'A': 'Feedback for A.', 'B': 'Feedback for B.'}, 'source_refs': ['econ101-lecture3-p1']}


def with_misconceptions():
    out = copy.deepcopy(GOOD)
    out['questions'][0]['misconceptions'] = {'B': 'demand_down', 'C': 'supply_none'}
    out['questions'][1]['misconceptions'] = {'A': 'supply_none'}
    out['retries'] = [retry('demand_down', 'Buyers double and supply stays put. The price?'),
                      retry('demand_down', 'A sold-out concert adds buyers. The price?'),
                      retry('supply_none', 'Farmers grow twice the apples for the same buyers. The price?'),
                      retry('supply_none', 'A factory doubles its output for the same buyers. The price?')]
    return out


class Misconceptions(unittest.TestCase):
    """US-41: wrong choices name a misconception, and each misconception gets 2 fresh retry questions."""

    def generate(self, replies):
        import questions
        fake = FakeGemini(replies)
        return fake, questions.generate_questions(fake, fixtures.breakdown_with_misconceptions(), 'econ101')

    def test_prompt_names_the_misconceptions_and_asks_for_retries(self):
        fake, _ = self.generate([with_misconceptions()])
        text = prompt_text(fake.calls[0])
        for m in fixtures.MISCONCEPTIONS:
            self.assertIn(m['misconception_id'], text)
            self.assertIn(m['label'], text)
        self.assertIn('retries', text)

    def test_required_questions_map_every_wrong_choice(self):
        _, result = self.generate([with_misconceptions()])
        required = [q for q in result['questions'] if q['role'] == 'required']
        self.assertEqual([q['question_id'] for q in required], ['econ101-price_changes-q1', 'econ101-price_changes-q2'])
        self.assertEqual(required[0]['misconceptions'], {'A': None, 'B': 'demand_down', 'C': 'supply_none'})
        self.assertEqual([q['counts_for'] for q in required], ['econ101-price_changes-q1', 'econ101-price_changes-q2'])

    def test_two_retries_per_misconception_count_for_the_question_that_leads_there(self):
        _, result = self.generate([with_misconceptions()])
        retries = [q for q in result['questions'] if q['role'] == 'retry']
        self.assertEqual([q['question_id'] for q in retries],
                         ['econ101-price_changes-demand_down-r1', 'econ101-price_changes-demand_down-r2',
                          'econ101-price_changes-supply_none-r1', 'econ101-price_changes-supply_none-r2'])
        self.assertEqual([q['counts_for'] for q in retries], ['econ101-price_changes-q1'] * 4)
        self.assertEqual(retries[2]['misconceptions'], {'A': 'supply_none', 'B': None})  # wrong → its own idea

    def test_wrong_choice_without_a_known_misconception_is_an_error(self):
        bad = with_misconceptions()
        bad['questions'][0]['misconceptions'] = {'B': 'demand_down', 'C': 'made_up'}
        fake, result = self.generate([bad, with_misconceptions()])
        self.assertEqual(len(fake.calls), 2)
        self.assertIn('misconceptions', prompt_text(fake.calls[1]))
        self.assertEqual(len(result['questions']), 6)

    def test_each_misconception_needs_two_retries(self):
        bad = with_misconceptions()
        bad['retries'] = bad['retries'][:3]
        fake, result = self.generate([bad, bad])
        self.assertIn('supply_none', prompt_text(fake.calls[1]))
        self.assertTrue(result['skipped'])


if __name__ == '__main__':
    unittest.main()
