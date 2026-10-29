"""Issue #24 (US-16): every script follows the notes.md script rules that a reviewer relies on.

Written before the fix (TDD). The intro clip's last line must be the packet's teaching goal, the last
intro leads into the quiz, other intros end on a swipe teaser, and follow-ups lead back to the retry.
"""
import json
import re
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
PACKETS = {json.loads(p.read_text(encoding='utf-8'))['topic_id']: json.loads(p.read_text(encoding='utf-8'))
           for p in (HERE.parent / 'learning' / 'packets').glob('*.json')}


def scripts():
    for path in sorted((HERE / 'scripts').glob('*.json')):
        yield json.loads(path.read_text(encoding='utf-8'))


def spoken(text):
    """Compare written and spoken forms: 3′ is narrated as 3-prime; ignore case and punctuation."""
    text = text.replace('5′', '5-prime').replace('3′', '3-prime').replace('’', "'")
    return re.sub(r'\s+', ' ', re.sub(r"[^a-z0-9' ]", ' ', text.lower().replace('-', ' '))).strip()


def sentences(text):
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]


class ScriptRulesTest(unittest.TestCase):
    def test_teaching_goal_is_spoken_near_the_end(self):
        # notes.md: "That sentence becomes the clip's last line" (before the swipe teaser).
        for s in scripts():
            if not s['variant_id'].startswith('intro'):
                continue
            with self.subTest(clip=f"{s['topic_id']}.{s['variant_id']}"):
                goal = spoken(s['teaching_goal'])
                tail = [spoken(x) for x in sentences(s['scenes'][0]['narration'])[-3:]]
                self.assertIn(goal, tail, f'teaching goal "{s["teaching_goal"]}" is not one of the last lines')

    def test_endings(self):
        for s in scripts():
            narration = s['scenes'][0]['narration']
            name = f"{s['topic_id']}.{s['variant_id']}"
            intros = sorted(v for v in PACKETS[s['topic_id']]['variants'] if v.startswith('intro'))
            with self.subTest(clip=name):
                if s['variant_id'] == intros[-1]:
                    self.assertTrue(narration.endswith("Let's see what you remember."), name)
                elif s['variant_id'].startswith('intro'):
                    self.assertRegex(sentences(narration)[-1], r'^Swipe\b', name)
                else:
                    self.assertTrue(narration.endswith('Now try the question again.'), name)

    def test_teaching_goal_and_sources_come_from_the_packet(self):
        for s in scripts():
            variant = PACKETS[s['topic_id']]['variants'][s['variant_id']]
            with self.subTest(clip=f"{s['topic_id']}.{s['variant_id']}"):
                self.assertEqual(s['teaching_goal'], variant['teaching_goal'])
                self.assertEqual(s['source_refs'], variant['source_refs'])

    def test_every_packet_variant_has_a_script(self):
        have = {(s['topic_id'], s['variant_id']) for s in scripts()}
        want = {(t, v) for t, p in PACKETS.items() for v in p['variants']}
        self.assertEqual(want - have, set())
        self.assertEqual(have - want, set(), 'a script for a variant the packet no longer defines')

    def test_spoken_normalises_primes_and_punctuation(self):
        # Edge cases found when reviewing the generated test: primes, curly apostrophes, hyphens, case.
        self.assertEqual(spoken('New DNA grows 5′ to 3′.'), spoken('new DNA grows 5-prime to 3-prime'))
        self.assertEqual(spoken('DNA polymerase can’t start'), spoken("DNA polymerase can't start"))
        self.assertNotEqual(spoken('grows 5′ to 3′'), spoken('grows 3′ to 5′'))


if __name__ == '__main__':
    unittest.main()
