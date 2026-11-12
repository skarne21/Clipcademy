"""US-29: course clips live apart from the 35 existing clips and never change them.

The existing clips' fingerprints hash render.py, beats.py, sfx.py, tts.py and everything under
video/remotion/src. The course pipeline must not touch any of those, so every existing clip keeps
matching its rendered file. Written before the implementation (TDD red).
"""
import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
VIDEO = HERE.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(VIDEO))


class ExistingClipsUntouched(unittest.TestCase):
    def test_course_code_is_not_part_of_existing_fingerprints(self):
        import render
        for path in render._code_files():
            rel = path.relative_to(VIDEO).as_posix()
            self.assertFalse(rel.startswith('course/') or rel.startswith('remotion/course/'), rel)

    def test_every_existing_clip_still_matches_its_rendered_file(self):
        import jobs
        service = jobs.VideoService(preview=True)
        scripts = [s for s in service.catalog.values() if s.get('format') == 'vertical']
        self.assertEqual(len(scripts), 35)
        stale = [f"{s['topic_id']}.{s['variant_id']}" for s in scripts if service.asset(s) is None]
        self.assertEqual(stale, [])

    def test_no_course_scripts_in_the_existing_catalog(self):
        for path in (VIDEO / 'scripts').glob('*.json'):
            self.assertNotIn('course_id', json.loads(path.read_text(encoding='utf-8')), path.name)


class CourseLayout(unittest.TestCase):
    def test_course_folders(self):
        import generate
        import render_course
        self.assertEqual(generate.COURSES, VIDEO / 'courses')
        self.assertEqual(render_course.ENTRY, 'course/index.ts')
        self.assertEqual(render_course.COMPOSITION, 'CourseClip')

    def test_course_fingerprint_covers_course_code(self):
        import render_course
        files = {p.relative_to(VIDEO).as_posix() for p in render_course.code_files()}
        self.assertIn('course/templates.py', files)
        self.assertIn('course/render_course.py', files)
        self.assertTrue(any(f.startswith('remotion/course/') for f in files))

    def test_course_fingerprint_changes_with_the_script(self):
        import fixtures
        import render_course
        a = render_course.fingerprint(fixtures.CLIP, 'elevenlabs')
        b = render_course.fingerprint(fixtures.clip(teaching_goal='Something else.'), 'elevenlabs')
        self.assertNotEqual(a, b)
        self.assertNotEqual(a, render_course.fingerprint(fixtures.CLIP, 'espeak'))


if __name__ == '__main__':
    unittest.main()
