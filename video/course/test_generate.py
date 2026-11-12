"""US-24, US-25, US-26 and US-28: importing material and asking Gemini for clip plans and storyboards.

Gemini is replaced by a fake client, so these tests make no network calls and spend nothing.
Written before the implementation (TDD red).
"""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))

import fixtures  # noqa: E402


class FakeGemini:
    """Returns queued JSON replies and records every request's parts."""

    def __init__(self, replies):
        self.replies = list(replies)
        self.calls = []

    def generate_json(self, parts, system=None, temperature=None):
        self.calls.append({'parts': parts, 'system': system})
        if not self.replies:
            raise AssertionError('unexpected Gemini call')
        return copy.deepcopy(self.replies.pop(0))


def prompt_text(call):
    return '\n'.join(p.get('text', '') for p in call['parts']) + '\n' + (call['system'] or '')


class Workspace(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix='clipcademy-course-test-'))
        self.root = self.tmp / 'courses'
        self.material = self.tmp / 'lecture3.txt'
        self.material.write_text(fixtures.MATERIAL_TEXT, encoding='utf-8')

    def run_generate(self, replies, materials=None, course='econ101'):
        import generate
        fake = FakeGemini(replies)
        result = generate.generate(course, materials or [self.material], client=fake, root=self.root, title='Intro Economics')
        return fake, result


class Import(Workspace):
    def test_rejects_unsafe_course_id_before_any_call(self):
        import generate
        fake = FakeGemini([])
        for bad in ('Econ 101', '../econ', 'ECON101', ''):
            with self.subTest(course=bad), self.assertRaises(ValueError):
                generate.generate(bad, [self.material], client=fake, root=self.root)
        self.assertEqual(fake.calls, [])

    def test_rejects_unsupported_file_types(self):
        import generate
        other = self.tmp / 'slides.pptx'
        other.write_bytes(b'not supported')
        with self.assertRaises(ValueError):
            generate.generate('econ101', [other], client=FakeGemini([]), root=self.root)

    def test_material_is_copied_into_the_course_folder(self):
        self.run_generate([fixtures.BREAKDOWN, fixtures.CLIP, fixtures.last_intro_clip()])
        self.assertTrue((self.root / 'econ101' / 'material' / 'lecture3.txt').is_file())

    def test_missing_key_is_a_clear_error(self):
        import gemini
        with self.assertRaises(gemini.MissingKey) as caught:
            gemini.load_key(env={}, env_file=self.tmp / 'no.env')
        self.assertIn('GEMINI_API_KEY', str(caught.exception))

    def test_key_is_read_from_env_file(self):
        import gemini
        env = self.tmp / '.env'
        env.write_text('ELEVENLABS_API_KEY=x\nGEMINI_API_KEY="abc123"\n', encoding='utf-8')
        self.assertEqual(gemini.load_key(env={}, env_file=env), 'abc123')


class GeminiClient(unittest.TestCase):
    def test_request_asks_for_json_and_sends_key_in_header(self):
        import gemini
        seen = {}

        def transport(url, headers, body):
            seen.update(url=url, headers=headers, body=json.loads(body))
            return {'candidates': [{'content': {'parts': [{'text': '{"ok": true}'}]}}]}

        client = gemini.Gemini('secret', model='test-model', transport=transport)
        self.assertEqual(client.generate_json([gemini.text_part('hello')], system='be brief'), {'ok': True})
        self.assertIn('models/test-model:generateContent', seen['url'])
        self.assertNotIn('secret', seen['url'])
        self.assertEqual(seen['headers']['x-goog-api-key'], 'secret')
        self.assertEqual(seen['body']['generationConfig']['responseMimeType'], 'application/json')
        self.assertEqual(seen['body']['contents'][0]['parts'], [{'text': 'hello'}])
        self.assertEqual(seen['body']['systemInstruction']['parts'], [{'text': 'be brief'}])

    def test_pdf_becomes_inline_file_data(self):
        import gemini
        pdf = Path(tempfile.mkdtemp()) / 'l.pdf'
        pdf.write_bytes(b'%PDF-1.4 test')
        part = gemini.file_part(pdf)
        self.assertEqual(part['inline_data']['mime_type'], 'application/pdf')
        self.assertTrue(part['inline_data']['data'])

    def test_reply_wrapped_in_code_fences_still_parses(self):
        import gemini
        reply = {'candidates': [{'content': {'parts': [{'text': '```json\n{"a": 1}\n```'}]}}]}
        client = gemini.Gemini('k', transport=lambda u, h, b: reply)
        self.assertEqual(client.generate_json([gemini.text_part('x')]), {'a': 1})

    def test_default_model_is_the_pro_alias_that_survives_retirements(self):
        # US-36: gemini-2.5-pro is refused for new keys; Google's alias always points at a current Pro model.
        import gemini
        from unittest import mock
        with mock.patch.dict('os.environ', {}, clear=True):
            self.assertEqual(gemini.Gemini('k').model, 'gemini-pro-latest')

    def test_gemini_model_setting_still_overrides_the_default(self):
        import gemini
        from unittest import mock
        with mock.patch.dict('os.environ', {'GEMINI_MODEL': 'gemini-3.5-flash'}, clear=True):
            self.assertEqual(gemini.Gemini('k').model, 'gemini-3.5-flash')


class Breakdown(Workspace):
    def test_material_sent_and_breakdown_saved(self):
        fake, _ = self.run_generate([fixtures.BREAKDOWN, fixtures.CLIP, fixtures.last_intro_clip()])
        self.assertIn('When demand for a good rises', prompt_text(fake.calls[0]))
        saved = json.loads((self.root / 'econ101' / 'breakdown.json').read_text(encoding='utf-8'))
        self.assertEqual(saved['objectives'][0]['objective_id'], 'price_changes')

    def test_excerpt_not_in_text_material_drops_its_clips(self):
        bad = copy.deepcopy(fixtures.BREAKDOWN)
        bad['objectives'][0]['source_excerpts'][0]['text'] = 'Prices always double every year.'
        fake, result = self.run_generate([bad])
        self.assertEqual(len(fake.calls), 1)  # no storyboard calls for an unverified objective
        self.assertEqual(result['written'], [])
        self.assertTrue(any('verbatim' in s['reason'] for s in result['skipped']))


class Storyboard(Workspace):
    def test_valid_clips_are_written_pending_review(self):
        _, result = self.run_generate([fixtures.BREAKDOWN, fixtures.CLIP, fixtures.last_intro_clip()])
        scripts = self.root / 'econ101' / 'scripts'
        self.assertEqual(sorted(p.name for p in scripts.glob('*.json')),
                         ['supply_and_demand.intro_1.json', 'supply_and_demand.intro_2.json'])
        for path in scripts.glob('*.json'):
            clip = json.loads(path.read_text(encoding='utf-8'))
            self.assertEqual(clip['review_status'], 'pending')
            self.assertEqual(clip['course_id'], 'econ101')
        self.assertEqual(len(result['written']), 2)

    def test_prompt_has_rules_catalog_and_teaching_goal(self):
        import templates
        fake, _ = self.run_generate([fixtures.BREAKDOWN, fixtures.CLIP, fixtures.last_intro_clip()])
        text = prompt_text(fake.calls[1])
        self.assertIn('When demand beats supply, prices go up.', text)
        self.assertIn('45–70 words', text)
        for name in templates.TEMPLATES:
            self.assertIn(name, text)

    def test_invalid_clip_is_retried_once_with_its_errors(self):
        broken = fixtures.scene_clip(template='strand')
        fake, result = self.run_generate([fixtures.BREAKDOWN, broken, fixtures.CLIP, fixtures.last_intro_clip()])
        self.assertEqual(len(fake.calls), 4)
        self.assertIn('strand', prompt_text(fake.calls[2]))  # the retry quotes the error
        self.assertEqual(len(result['written']), 2)

    def test_clip_that_fails_twice_is_skipped_and_reported(self):
        broken = fixtures.scene_clip(template='strand')
        _, result = self.run_generate([fixtures.BREAKDOWN, broken, broken, fixtures.last_intro_clip()])
        self.assertEqual([Path(p).name for p in result['written']], ['supply_and_demand.intro_2.json'])
        self.assertEqual(result['skipped'][0]['variant_id'], 'intro_1')
        self.assertTrue(result['skipped'][0]['errors'])

    def test_gemini_cannot_mark_its_own_clip_approved_or_change_ids(self):
        sneaky = fixtures.clip(review_status='approved', course_id='other', variant_id='intro_9')
        self.run_generate([fixtures.BREAKDOWN, sneaky, fixtures.last_intro_clip()])
        clip = json.loads((self.root / 'econ101' / 'scripts' / 'supply_and_demand.intro_1.json').read_text(encoding='utf-8'))
        self.assertEqual((clip['review_status'], clip['course_id'], clip['variant_id']), ('pending', 'econ101', 'intro_1'))

    def test_fixture_followup_clip_passes_the_checks(self):
        import templates
        for clip in fixtures.followup_clips():
            self.assertEqual(templates.validate(clip), [], clip['variant_id'])

    def test_nothing_is_written_outside_the_course_folder(self):
        self.run_generate([fixtures.BREAKDOWN, fixtures.CLIP, fixtures.last_intro_clip()])
        written = {p.relative_to(self.tmp).parts[:2] for p in self.tmp.rglob('*') if p.is_file()}
        self.assertEqual(written, {('lecture3.txt',), ('courses', 'econ101')})


class SharedTopic(Workspace):
    def test_two_objectives_in_one_topic_keep_their_own_scripts(self):
        # US-45: a live run wrote both objectives to supply_and_demand.intro_1.json, so one lost all its clips.
        breakdown = copy.deepcopy(fixtures.BREAKDOWN)
        second = copy.deepcopy(breakdown['objectives'][0])
        second['objective_id'] = 'price_floors'
        breakdown['objectives'].append(second)
        replies = [breakdown, fixtures.CLIP, fixtures.last_intro_clip(), fixtures.CLIP, fixtures.last_intro_clip()]
        _, result = self.run_generate(replies)
        self.assertEqual(len(set(result['written'])), 4)
        objectives = [json.loads(Path(p).read_text(encoding='utf-8'))['objective_id'] for p in result['written']]
        self.assertEqual(sorted(objectives), ['price_changes', 'price_changes', 'price_floors', 'price_floors'])


class FollowUps(Workspace):
    """US-40: two misconceptions per objective, each with a v1 and a differently explained v2 follow-up clip."""

    def replies(self):
        return [fixtures.breakdown_with_misconceptions(), fixtures.CLIP, fixtures.last_intro_clip(), *fixtures.followup_clips()]

    def test_breakdown_asks_for_two_misconceptions(self):
        fake, _ = self.run_generate(self.replies())
        text = prompt_text(fake.calls[0])
        self.assertIn('misconceptions', text)
        self.assertIn('exactly 2', text)

    def test_each_misconception_gets_a_v1_and_v2_followup_clip(self):
        _, result = self.run_generate(self.replies())
        names = sorted(Path(p).name for p in result['written'])
        self.assertEqual(names, sorted(['supply_and_demand.intro_1.json', 'supply_and_demand.intro_2.json',
                                        'supply_and_demand.demand_down_followup.json',
                                        'supply_and_demand.demand_down_followup_2.json',
                                        'supply_and_demand.supply_none_followup.json',
                                        'supply_and_demand.supply_none_followup_2.json']))
        clip = json.loads((self.root / 'econ101' / 'scripts' / 'supply_and_demand.supply_none_followup_2.json')
                          .read_text(encoding='utf-8'))
        self.assertEqual((clip['kind'], clip['teaching_goal']),
                         ('followup', 'Plenty of goods and the same buyers means a lower price.'))

    def test_v2_prompt_asks_for_a_different_explanation_than_v1(self):
        fake, _ = self.run_generate(self.replies())
        v1 = fixtures.followup_clips()[0]['scenes'][0]['narration']
        v2_prompt = prompt_text(fake.calls[4])
        self.assertIn('demand_down_followup_2', v2_prompt)
        self.assertIn('differently', v2_prompt)
        self.assertIn(v1, v2_prompt)

    def test_objective_without_two_misconceptions_keeps_intros_and_reports_it(self):
        bad = fixtures.breakdown_with_misconceptions()
        bad['objectives'][0]['misconceptions'] = bad['objectives'][0]['misconceptions'][:1]
        _, result = self.run_generate([bad, fixtures.CLIP, fixtures.last_intro_clip()])
        self.assertEqual(len(result['written']), 2)
        self.assertTrue(any('misconception' in s['reason'] for s in result['skipped']))


if __name__ == '__main__':
    unittest.main()
