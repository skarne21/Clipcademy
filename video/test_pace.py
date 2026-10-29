"""Issue #21 (US-13): narration pace in every rendered clip is 150-170 words a minute (notes.md, rule 6).

Written before the fix (TDD). Pace is measured on the rendered clip: transcript words over the
narrated time (clip length minus the fixed lead-in and tail silence).
"""
import importlib.util
import json
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location('clipcademy_renderer', HERE / 'render.py')
render = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(render)
LOW, HIGH = 150, 170


def current_clips():
    for path in sorted((HERE / 'scripts').glob('*.json')):
        script = json.loads(path.read_text(encoding='utf-8'))
        manifest = HERE / 'media' / f"{script['topic_id']}.{script['variant_id']}.{render.fingerprint(script)}.json"
        yield script, manifest


def pace(record):
    speech = record['duration_seconds'] - render.LEAD - render.TAIL
    return len(record['transcript'].split()) / speech * 60


class PaceTest(unittest.TestCase):
    def test_every_clip_is_paced_150_to_170_wpm(self):
        for script, manifest in current_clips():
            name = f"{script['topic_id']}.{script['variant_id']}"
            with self.subTest(clip=name):
                self.assertTrue(manifest.exists(), f'{name} is not rendered for the current script')
                wpm = pace(json.loads(manifest.read_text(encoding='utf-8')))
                self.assertGreaterEqual(round(wpm), LOW, f'{name}: {wpm:.0f} wpm is too slow')
                self.assertLessEqual(round(wpm), HIGH, f'{name}: {wpm:.0f} wpm is too fast')

    def test_pace_formula(self):
        # 40 words over 15 s of speech (plus lead and tail) is 160 wpm.
        record = {'transcript': ' '.join(['word'] * 40), 'duration_seconds': 15 + render.LEAD + render.TAIL}
        self.assertAlmostEqual(pace(record), 160)


if __name__ == '__main__':
    unittest.main()
