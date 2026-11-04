"""Vertical scripts: beats resolve to narrated words, and pacing follows notes.md (15-30 s, no still > 3 s)."""
import importlib.util
import json
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location('clipcademy_beats', HERE / 'beats.py')
beats = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(beats)
WPM = 160  # notes.md: 150-170 words a minute


def estimated(text):
    words, at = [], 0.15
    for word in text.split():
        words.append((word, at, at + 0.3))
        at += 60 / WPM
    return words, at + 0.45


def vertical_scripts():
    for path in sorted((HERE / 'scripts').glob('*.json')):
        script = json.loads(path.read_text(encoding='utf-8'))
        if script.get('format') == 'vertical':
            yield path.name, script


class PacingTest(unittest.TestCase):
    def test_there_is_a_vertical_script(self):
        self.assertTrue(list(vertical_scripts()))

    def test_length_and_stills(self):
        for name, script in vertical_scripts():
            with self.subTest(script=name):
                self.assertEqual(len(script['scenes']), 1, 'one continuous scene per clip')
                scene = script['scenes'][0]
                words, duration = estimated(scene['narration'])
                self.assertLessEqual(duration, 30, 'over 30 s at 160 words a minute')
                self.assertGreaterEqual(duration, 15, 'under 15 s at 160 words a minute')
                plan = beats.plan(scene, words, duration)
                self.assertLessEqual(beats.longest_still(plan, duration), beats.MAX_STILL)
                self.assertLess(plan['events'][0]['t'], 2.0, 'the hook needs an on-screen change in the first 2 s')

    def test_last_line_and_sources(self):
        for name, script in vertical_scripts():
            with self.subTest(script=name):
                self.assertTrue(script['source_refs'])
                self.assertEqual(script['review_status'], 'pending')
                self.assertIn('hook_claim', script['review_notes'])
                self.assertIn('analogy', script['review_notes'])

    def test_bad_cue_and_target_are_rejected(self):
        scene = {'diagram': 'strand', 'beats': [{'on': 'nowhere', 'do': ['pulse:strand']}]}
        with self.assertRaises(ValueError):
            beats.resolve(scene, estimated('a bare template')[0])
        scene = {'diagram': 'strand', 'beats': [{'on': '^', 'do': ['pulse:moon']}]}
        with self.assertRaises(ValueError):
            beats.resolve(scene, estimated('a bare template')[0])

    def test_sounds_open_with_the_series_sting(self):
        scene = {'diagram': 'strand', 'beats': [{'on': '^', 'do': ['extend']}]}
        words, duration = estimated('one two three four five six seven')
        cues = beats.sound_cues(beats.plan(scene, words, duration))
        self.assertEqual(cues[0], (0.0, 'sting'))
        self.assertIn('click', {kind for _, kind in cues})


if __name__ == '__main__':
    unittest.main()
