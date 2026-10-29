"""Issues #14 (US-06) and #23 (US-15): burned-in captions stay in the caption band (y 760-1000) and clear
of the app's safe zones (right 120 px, bottom 200 px) in a real rendered frame.

Written before the fix (TDD). Renders single frames with Remotion and checks pixels, so it tests what
students see rather than a layout constant. Skipped when Node or the Remotion packages are missing.
"""
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
REMOTION = HERE / 'remotion'
CAPTION_TOP, CAPTION_BOTTOM, RIGHT_EDGE, BOTTOM_EDGE = 760, 1000, 600, 1080


def frame(words, tmp):
    props = {'fps': 24, 'durationInFrames': 24, 'audio': 'silence.wav', 'title': 'Layout check',
             'sources': 'Sources: test', 'diagram': 'strand', 'stage': {'strand': 3, 'slots': 10},
             'words': [{'text': w, 'start': 0.0, 'end': 1.0} for w in words], 'events': [], 'pieces': [], 'energy': []}
    (tmp / 'props.json').write_text(json.dumps(props), encoding='utf-8')
    out = tmp / 'frame.png'
    subprocess.run([shutil.which('npx'), 'remotion', 'still', 'src/index.ts', 'Clip', str(out), '--frame=6',
                    f'--props={tmp / "props.json"}', '--log=error'], cwd=REMOTION, check=True, capture_output=True)
    from PIL import Image
    return Image.open(out).convert('RGB')


def is_fill(p):
    r, g, b = p
    return (r > 245 and g > 245 and b > 245) or (r > 245 and 190 < g < 225 and b < 90)  # white or highlight yellow


def is_ink(p):
    return all(c < 70 for c in p)  # the caption's dark outline (and other ink, so only used where nothing else is drawn)


def caption_rows(image):
    """Rows (y) the caption covers: its white/yellow fill plus its 12 px dark outline.

    Review note: the first generated version only looked for the fill, which ends at y=999 even when the
    outline runs past 1000, so it passed a layout that breaks the band. The outline is part of the caption.
    Below the grass line (y > 795) the only other ink is the sources line, which starts at y=1030.
    """
    w, h = image.size
    px = image.load()
    fill_cols = [x for x in range(0, w, 2) if any(is_fill(px[x, y]) for y in range(800, 1030, 2))]
    lo, hi = (min(fill_cols) - 16, max(fill_cols) + 16) if fill_cols else (0, -1)
    rows = set()
    for y in range(800, min(h, 1029)):
        if any(is_fill(px[x, y]) or is_ink(px[x, y]) for x in range(max(0, lo), min(w, hi + 1), 2)):
            rows.add(y)
    for y in range(1029, h):  # below the band, any caption fill at all is a failure
        if any(is_fill(px[x, y]) for x in range(0, w, 2)):
            rows.add(y)
    return rows


def caption_columns(image):
    w, h = image.size
    px = image.load()
    return {x for x in range(w) for y in range(780, 1000, 3)
            if all(c > 245 for c in px[x, y]) or (px[x, y][0] > 245 and 190 < px[x, y][1] < 225 and px[x, y][2] < 90)}


@unittest.skipUnless(shutil.which('npx') and (REMOTION / 'node_modules').exists(), 'needs Node and `npm ci` in video/remotion')
class CaptionLayoutTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        tmp = Path(cls.tmp.name)
        # A caption chunk long enough to wrap onto two lines, and a long single word.
        cls.two_lines = frame(['Polymerase', 'extends'], tmp)
        cls.one_word = frame(['spell-checker,'], tmp)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_two_line_caption_stays_in_band(self):
        rows = caption_rows(self.two_lines)
        self.assertTrue(rows, 'no caption drawn')
        self.assertGreaterEqual(min(rows), CAPTION_TOP, f'caption starts at y={min(rows)}')
        self.assertLessEqual(max(rows), CAPTION_BOTTOM, f'caption runs to y={max(rows)}, below the band')

    def test_long_word_stays_in_band_and_left_of_the_buttons(self):
        rows = caption_rows(self.one_word)
        self.assertTrue(rows)
        self.assertLessEqual(max(rows), CAPTION_BOTTOM)
        cols = caption_columns(self.one_word)
        self.assertLess(max(cols), RIGHT_EDGE, f'caption reaches x={max(cols)}, under the side buttons')

    def test_nothing_from_the_caption_reaches_the_bottom_controls(self):
        for image in (self.two_lines, self.one_word):
            self.assertFalse([y for y in caption_rows(image) if y >= BOTTOM_EDGE])


if __name__ == '__main__':
    unittest.main()
