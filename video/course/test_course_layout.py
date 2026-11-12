"""US-27: every general-purpose template draws its content inside the board, in a real rendered frame.

Renders one frame per template with Remotion (the course entry point) and checks pixels, like
video/test_layout.py does for captions. Skipped when Node or the Remotion packages are missing.
Written before the implementation (TDD red).
"""
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
REMOTION = HERE.parent / 'remotion'
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))

BOARD = (24, 262, 590, 556)  # x0, y0, x1, y1 of the board, from video/remotion/src/theme.ts


def everything_revealed(name, props):
    import templates
    events = [{'t': 0.0, 'action': a, 'arg': arg} for a, arg in templates.reveal_all(name, props)]
    return {'fps': 24, 'durationInFrames': 48, 'audio': 'silence.wav', 'title': f'Layout check: {name}',
            'sources': 'Sources: test', 'template': name, 'props': props,
            'words': [{'text': 'Check', 'start': 0.0, 'end': 1.0}], 'events': events, 'energy': []}


def still(props, tmp):
    import render_course
    (tmp / 'props.json').write_text(json.dumps(props), encoding='utf-8')
    out = tmp / 'frame.png'
    subprocess.run([shutil.which('npx'), 'remotion', 'still', 'course/index.ts', 'CourseClip', str(out), '--frame=40',
                    f'--props={tmp / "props.json"}', f'--port={render_course.free_port()}', '--log=error'],
                   cwd=REMOTION, check=True, capture_output=True)
    from PIL import Image
    return Image.open(out).convert('RGB')


def ink(p):
    return all(c < 90 for c in p)


@unittest.skipUnless(shutil.which('npx') and (REMOTION / 'node_modules').exists(), 'needs Node and `npm ci` in video/remotion')
class TemplatesDrawInsideTheBoard(unittest.TestCase):
    def test_each_template(self):
        import templates
        for name, props in templates.SAMPLE_PROPS.items():
            with self.subTest(template=name), tempfile.TemporaryDirectory() as tmp:
                image = still(everything_revealed(name, props), Path(tmp))
                px = image.load()
                x0, y0, x1, y1 = BOARD
                inside = sum(ink(px[x, y]) for x in range(x0 + 16, x1 - 16, 3) for y in range(y0 + 16, y1 - 16, 3))
                self.assertGreater(inside, 150, f'{name}: almost nothing drawn on the board')
                # Just right of the board (before the side buttons' zone) must be plain sky: no overflowing text.
                outside = [(x, y) for x in range(x1 + 8, 640, 2) for y in range(y0 + 10, y1 - 10, 2)
                           if ink(px[x, y]) or all(c > 245 for c in px[x, y])]
                self.assertEqual(outside, [], f'{name}: board content spills past the right edge')


if __name__ == '__main__':
    unittest.main()
