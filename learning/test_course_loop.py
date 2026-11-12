"""US-42: in a course class, a wrong answer plays the follow-up clip for that mistake and then a fresh retry question,
graded by the MVP's rules (learning/grading.py). Written before the implementation (TDD red).

The pipeline is a fake (no Gemini, ElevenLabs or Remotion); questions come from the real questions.py, fed a canned reply.
"""
import json
import sys
import unittest
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / 'video' / 'course'))

import fixtures  # noqa: E402
from test_courses import AUTH, FakePipeline, Platform, call  # noqa: E402
from test_generate import FakeGemini  # noqa: E402
from test_questions import with_misconceptions  # noqa: E402


class LoopPipeline(FakePipeline):
    """Intro clips, four follow-up clips, 2 required questions and 4 retries for one objective."""

    def generate(self, course_id, title, materials, courses_root):
        report = super().generate(course_id, title, materials, courses_root)
        base = Path(courses_root) / course_id
        for clip in fixtures.followup_clips():
            clip = {**clip, 'course_id': course_id}
            path = base / 'scripts' / f"{clip['topic_id']}.{clip['objective_id']}.{clip['variant_id']}.json"
            path.write_text(json.dumps(clip), encoding='utf-8')
            report['written'].append(str(path))
        (base / 'breakdown.json').write_text(json.dumps({**fixtures.breakdown_with_misconceptions(), 'course_id': course_id}),
                                             encoding='utf-8')
        return report

    def questions(self, course_id, breakdown):
        import questions
        return questions.generate_questions(FakeGemini([with_misconceptions()]), breakdown, course_id)


class Loop(Platform):
    def setUp(self):
        super().setUp()
        self.pipeline = LoopPipeline()
        self.worker.pipeline = self.pipeline
        self.course = self.generated()
        self.code = self.course['join_code']
        self.state = {}
        self.q = lambda tail: f"{self.course['course_id']}-price_changes-{tail}"

    def answer(self, question, choice, state=None):
        body = {'attempt_id': str(uuid.uuid4()), 'objective_id': 'price_changes', 'question_id': self.q(question),
                'selected_choice_id': choice, 'remediation_state': self.state if state is None else state}
        status, _, result = call(self.app, 'POST', f'/courses/{self.code}/attempts', body)
        if status == 200:
            self.state = result['remediation_state']
        return status, result

    def test_student_view_splits_intros_followups_questions_and_retries(self):
        _, _, body = call(self.app, 'GET', f'/courses/{self.code}')
        [obj] = body['objectives']
        self.assertEqual([c['variant_id'] for c in obj['clips']], ['intro_1', 'intro_2'])
        self.assertEqual(sorted(obj['followups']), ['demand_down_followup', 'demand_down_followup_2',
                                                    'supply_none_followup', 'supply_none_followup_2'])
        self.assertEqual([q['question_id'] for q in obj['questions']], [self.q('q1'), self.q('q2')])
        self.assertEqual(len(obj['retries']), 4)
        for q in obj['questions'] + list(obj['retries'].values()):
            self.assertFalse({'correct_choice_id', 'feedback', 'misconceptions', 'counts_for'} & set(q), q)

    def test_right_answers_complete_the_objective(self):
        _, first = self.answer('q1', 'A')
        self.assertEqual((first['action'], first['next_question_id']), ('continue_questions', self.q('q2')))
        _, last = self.answer('q2', 'B')
        self.assertEqual(last['action'], 'complete')

    def test_wrong_answer_plays_its_v1_clip_then_a_fresh_retry(self):
        _, result = self.answer('q1', 'B')  # B means demand_down
        self.assertFalse(result['correct'])
        self.assertEqual(result['action'], 'review_again')
        self.assertEqual(result['next_video_request']['variant_id'], 'demand_down_followup')
        self.assertEqual(result['next_question_id'], self.q('demand_down-r1'))
        self.assertEqual(result['feedback'], 'Prices fall when supply rises, not when demand rises.')

    def test_missing_it_again_plays_the_v2_clip_and_second_retry(self):
        self.answer('q1', 'B')
        _, result = self.answer('demand_down-r1', 'B')
        self.assertEqual(result['next_video_request']['variant_id'], 'demand_down_followup_2')
        self.assertEqual(result['next_question_id'], self.q('demand_down-r2'))

    def test_two_cycles_then_needs_review_with_the_intro_teaching_goals(self):
        self.answer('q1', 'B')
        self.answer('demand_down-r1', 'B')
        _, result = self.answer('demand_down-r2', 'B')
        self.assertEqual(result['action'], 'needs_review')
        self.assertEqual(result['review_points'], ['When demand beats supply, prices go up.',
                                                   'When supply beats demand, prices go down.'])

    def test_right_retry_counts_for_the_missed_question(self):
        self.answer('q1', 'B')
        _, result = self.answer('demand_down-r1', 'A')
        self.assertEqual((result['action'], result['next_question_id']), ('continue_questions', self.q('q2')))

    def test_deleted_followup_clip_still_leads_to_the_retry(self):
        view = self.view(self.course['course_id'])
        clip = next(c for c in view['clips'] if c['variant_id'] == 'demand_down_followup')
        call(self.app, 'DELETE', f"/teacher/clips/{clip['clip_id']}", headers=AUTH)
        _, _, body = call(self.app, 'GET', f'/courses/{self.code}')
        self.assertNotIn('demand_down_followup', body['objectives'][0]['followups'])
        _, result = self.answer('q1', 'B')
        self.assertEqual((result['action'], result['next_question_id']), ('review_again', self.q('demand_down-r1')))

    def test_out_of_order_and_unknown_answers_are_refused(self):
        self.assertEqual(self.answer('q2', 'A')[0], 409)
        self.assertEqual(self.answer('q1', 'Z')[0], 400)
        self.assertEqual(self.answer('nope', 'A')[0], 400)

    def test_same_attempt_sent_twice_gets_the_same_result(self):
        body = {'attempt_id': str(uuid.uuid4()), 'objective_id': 'price_changes', 'question_id': self.q('q1'),
                'selected_choice_id': 'B', 'remediation_state': {}}
        status, _, first = call(self.app, 'POST', f'/courses/{self.code}/attempts', body)
        again = call(self.app, 'POST', f'/courses/{self.code}/attempts', body)[2]
        self.assertEqual(status, 200, first)
        self.assertEqual(first, again)


class OlderCourse(Platform):
    def test_wrong_answer_without_misconceptions_ends_in_needs_review(self):
        # Courses made before US-40/41 have no follow-ups; a wrong answer can't loop, so it shows the key points.
        course = self.generated()
        body = {'attempt_id': str(uuid.uuid4()), 'objective_id': 'price_changes',
                'question_id': f"{course['course_id']}-price_changes-q1", 'selected_choice_id': 'B', 'remediation_state': {}}
        status, _, result = call(self.app, 'POST', f"/courses/{course['join_code']}/attempts", body)
        self.assertEqual((status, result['action']), (200, 'needs_review'))
        self.assertEqual(result['feedback'], 'It falls when supply rises.')


if __name__ == '__main__':
    unittest.main()
