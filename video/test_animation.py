"""Every script's beats must resolve to spoken words and name known actions and targets."""
import importlib.util
import json
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location('clipcademy_animation', HERE / 'animation.py')
art = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(art)


def fake_words(text):
    words, at = [], 0.35
    for word in text.split():
        words.append((word, at, at + 0.3))
        at += 0.35
    return words, at + 0.65


class BeatTest(unittest.TestCase):
    def test_beats_resolve_in_order(self):
        for path in sorted((HERE / 'scripts').glob('*.json')):
            script = json.loads(path.read_text())
            for i, scene in enumerate(script['scenes']):
                with self.subTest(script=path.name, scene=i):
                    words, duration = fake_words(scene['narration'])
                    tl = art.Timeline(scene, words, duration)
                    self.assertTrue(tl.events, 'scene has no animation beats')
                    diagram = art.DIAGRAMS[scene['diagram']](None, scene, tl, duration)
                    targets = diagram.targets(duration / 2)
                    for _, name, arg in tl.events:
                        if name in ('point', 'pulse', 'zoom'):
                            self.assertIn(arg, targets, f'{name}:{arg} is not a target of {scene["diagram"]}')

    def test_cards_repeat_short_claims(self):
        for path in sorted((HERE / 'scripts').glob('*.json')):
            for scene in json.loads(path.read_text())['scenes']:
                cards = [b for beat in scene['beats'] for b in beat['do'] if b.startswith('card:')]
                self.assertLessEqual(len(cards), 2, 'at most two cards fit above the captions')

    def test_unknown_cue_is_rejected(self):
        scene = {'beats': [{'on': 'nowhere', 'do': ['pulse:template']}]}
        with self.assertRaises(ValueError):
            art.Timeline(scene, fake_words('a bare template')[0], 3)


if __name__ == '__main__':
    unittest.main()
