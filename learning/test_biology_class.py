"""US-49: the MVP biology lessons as a class, joined with the class code BIO101.

Same packets, questions, answer key and rendered clips as the study app; graded by learning/grading.py.
Runs through the one server (learning/server.py) so clip URLs are checked too. Written before the implementation (TDD red).
"""
import json
import os
import shutil
import sys
import tempfile
import unittest
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
os.environ.setdefault('CLIPCADEMY_DB', ':memory:')

from test_courses import TOKEN, FakePipeline, call  # noqa: E402

PACKETS = {p['objective_id']: p for p in (json.loads(f.read_text(encoding='utf-8')) for f in (HERE / 'packets').glob('*.json'))}


class BiologyClass(unittest.TestCase):
    def setUp(self):
        import server
        self.tmp = Path(tempfile.mkdtemp(prefix='clipcademy-bio-'))
        self.addCleanup(shutil.rmtree, self.tmp, True)
        dist = self.tmp / 'dist'
        dist.mkdir()
        self.app = server.make_server_app(data_dir=self.tmp / 'data', web_dist=dist, teacher_token=TOKEN,
                                          pipeline=FakePipeline(), start_worker=False)
        self.state = {}

    def course(self, code='BIO101'):
        status, _, body = call(self.app, 'GET', f'/courses/{code}')
        self.assertEqual(status, 200, body)
        return body

    def answer(self, objective, question, choice):
        body = {'attempt_id': str(uuid.uuid4()), 'objective_id': objective, 'question_id': question,
                'selected_choice_id': choice, 'remediation_state': self.state}
        status, _, result = call(self.app, 'POST', '/courses/BIO101/attempts', body)
        self.assertEqual(status, 200, result)
        self.state = result['remediation_state']
        return result

    def test_code_works_in_any_case_and_lists_only_the_available_topics(self):
        body = self.course('bio101')
        self.assertEqual(body['join_code'], 'BIO101')
        self.assertEqual([o['objective_id'] for o in body['objectives']], ['synthesis_direction_and_primer', 'error_correction'])

    def test_each_topic_has_the_packets_clips_questions_and_retries(self):
        for obj in self.course()['objectives']:
            packet = PACKETS[obj['objective_id']]
            intros = sorted((v for v in packet['variants'] if v.startswith('intro_')), key=lambda v: int(v.split('_')[1]))
            self.assertEqual([c['variant_id'] for c in obj['clips']], intros)
            self.assertEqual(sorted(obj['followups']), sorted(v for v in packet['variants'] if not v.startswith('intro_')))
            self.assertEqual([q['question_id'] for q in obj['questions']], packet['required_question_ids'])
            retries = sorted(r for m in packet['misconceptions'].values() for r in m['retry_question_ids'])
            self.assertEqual(sorted(obj['retries']), retries)
            for q in obj['questions'] + list(obj['retries'].values()):
                self.assertFalse({'correct_choice_id', 'feedback'} & set(q), q)
                self.assertTrue(q['prompt'] and q['choices'])

    def test_clips_play_from_the_rendered_biology_files(self):
        obj = self.course()['objectives'][0]
        for clip in obj['clips'] + list(obj['followups'].values()):
            self.assertTrue(clip['video_url'].startswith('/media/') and clip['transcript'], clip)
        status, headers, _ = call(self.app, 'GET', obj['clips'][0]['video_url'], headers={'Range': 'bytes=0-9'})
        self.assertEqual((status, headers['Content-Type']), (206, 'video/mp4'))

    def test_wrong_answer_loops_exactly_as_in_the_study_app(self):
        # Team_Spec: rep-q2 choice B -> primer_followup, then retry rep-r2.
        self.assertEqual(self.answer('synthesis_direction_and_primer', 'rep-q1', 'B')['action'], 'continue_questions')
        result = self.answer('synthesis_direction_and_primer', 'rep-q2', 'B')
        self.assertEqual((result['action'], result['next_video_request']['variant_id'], result['next_question_id']),
                         ('review_again', 'primer_followup', 'rep-r2'))

    def test_course_codes_still_work_and_unknown_codes_do_not(self):
        self.assertEqual(call(self.app, 'GET', '/courses/ZZZZZZ')[0], 404)


if __name__ == '__main__':
    unittest.main()
