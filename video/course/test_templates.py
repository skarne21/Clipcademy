"""US-27 and US-28: general-purpose stick-figure scenes and the checks every generated clip must pass.

Written before the implementation (TDD red). Run: python3 -m pytest video/course
"""
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))

import fixtures  # noqa: E402


def errors(clip):
    import templates
    return templates.validate(clip)


class Catalog(unittest.TestCase):
    def test_five_general_purpose_templates(self):
        import templates
        self.assertEqual(set(templates.TEMPLATES), {'steps', 'compare', 'flow', 'term', 'myth_fact'})

    def test_every_template_has_a_valid_sample(self):
        import templates
        for name in templates.TEMPLATES:
            with self.subTest(template=name):
                self.assertEqual(templates.validate_props(name, templates.SAMPLE_PROPS[name]), [])

    def test_catalog_text_names_every_template_and_action(self):
        import templates
        text = templates.catalog_text()
        for name, spec in templates.TEMPLATES.items():
            self.assertIn(name, text)
            for action in spec['actions']:
                self.assertIn(action, text)

    def test_biology_diagrams_are_untouched(self):
        import beats
        self.assertEqual(set(beats.DIAGRAMS), {'strand', 'repair', 'transcription', 'translation', 'timeline'})


class Validation(unittest.TestCase):
    def test_valid_clip_passes(self):
        self.assertEqual(errors(fixtures.CLIP), [])

    def test_valid_last_intro_passes(self):
        self.assertEqual(errors(fixtures.last_intro_clip()), [])

    def test_unknown_template(self):
        self.assertTrue(any('template' in e for e in errors(fixtures.scene_clip(template='strand'))))

    def test_unknown_action(self):
        clip = fixtures.scene_clip()
        clip['scenes'][0]['beats'][2]['do'] = ['explode:buyers']
        self.assertTrue(any('explode' in e for e in errors(clip)))

    def test_target_must_be_defined_in_props(self):
        clip = fixtures.scene_clip()
        clip['scenes'][0]['beats'][2]['do'] = ['reveal:nobody']
        self.assertTrue(any('nobody' in e for e in errors(clip)))

    def test_unknown_pose(self):
        clip = fixtures.scene_clip()
        clip['scenes'][0]['beats'][0]['do'] = ['pose:dance']
        self.assertTrue(any('dance' in e for e in errors(clip)))

    def test_prop_text_over_limit_is_rejected(self):
        clip = fixtures.scene_clip()
        clip['scenes'][0]['props']['steps'][0]['text'] = 'A step label that is far too long to fit'
        self.assertTrue(any('too long' in e for e in errors(clip)))

    def test_card_text_over_limit_is_rejected(self):
        clip = fixtures.scene_clip()
        clip['scenes'][0]['beats'][5]['do'] = ['card:This card text is much longer than thirty characters']
        self.assertTrue(any('card' in e for e in errors(clip)))

    def test_first_beat_must_be_start(self):
        clip = fixtures.scene_clip()
        clip['scenes'][0]['beats'] = clip['scenes'][0]['beats'][1:]
        self.assertTrue(any('^' in e for e in errors(clip)))

    def test_cue_missing_from_narration(self):
        clip = fixtures.scene_clip()
        clip['scenes'][0]['beats'][3]['on'] = 'elephant'
        self.assertTrue(any('elephant' in e for e in errors(clip)))

    def test_cue_out_of_order(self):
        clip = fixtures.scene_clip()
        beats = clip['scenes'][0]['beats']
        beats[2], beats[4] = beats[4], beats[2]
        self.assertTrue(any('order' in e or 'not found' in e for e in errors(clip)))

    def test_narration_too_short(self):
        clip = fixtures.scene_clip(narration='Why do prices rise? First, second, third. Swipe.',
                                   beats=[{'on': '^', 'do': ['pose:think']}])
        self.assertTrue(any('words' in e for e in errors(clip)))

    def test_intro_must_end_with_swipe(self):
        clip = fixtures.scene_clip()
        sc = clip['scenes'][0]
        sc['narration'] = sc['narration'].replace('Swipe.', 'Bye.')
        sc['beats'][-1]['on'] = 'bye'
        self.assertTrue(any('end' in e for e in errors(clip)))

    def test_symbols_tts_misreads_are_rejected(self):
        clip = fixtures.scene_clip()
        sc = clip['scenes'][0]
        sc['narration'] = sc['narration'].replace('prices go up', 'prices go ↑')
        self.assertTrue(any('symbol' in e for e in errors(clip)))

    def test_must_be_pending_review(self):
        self.assertTrue(any('pending' in e for e in errors(fixtures.clip(review_status='approved'))))

    def test_needs_source_refs_and_review_notes(self):
        self.assertTrue(any('source_refs' in e for e in errors(fixtures.clip(source_refs=[]))))
        self.assertTrue(any('review_notes' in e for e in errors(fixtures.clip(review_notes={}))))

    def test_ids_are_safe_names(self):
        self.assertTrue(any('variant_id' in e for e in errors(fixtures.clip(variant_id='../x'))))
        self.assertTrue(any('course_id' in e for e in errors(fixtures.clip(course_id='Econ 101'))))


class Plan(unittest.TestCase):
    def test_beats_become_timed_events_and_keep_moving(self):
        import templates
        sc = fixtures.CLIP['scenes'][0]
        words = [(w, 0.15 + i * 0.36, 0.15 + i * 0.36 + 0.3) for i, w in enumerate(sc['narration'].split())]
        duration = words[-1][2] + 0.45
        p = templates.plan(sc, words, duration)
        times = [e['t'] for e in p['events']]
        self.assertEqual(times, sorted(times))
        self.assertIn({'t': p['events'][0]['t'], 'action': 'pose', 'arg': 'think'}, p['events'][:2])
        self.assertTrue(any(e['action'] == 'reveal' and e['arg'] == 'buyers' for e in p['events']))
        self.assertLessEqual(templates.longest_still(p, duration), 3.0)


if __name__ == '__main__':
    unittest.main()
