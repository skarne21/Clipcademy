"""Member 1's video service closes its database (Windows can then delete it) and reads its files as UTF-8."""
import importlib.util
import os
import sqlite3
import tempfile
import unittest

from _repo import REPO


def load_jobs():
    spec = importlib.util.spec_from_file_location("video_jobs", os.path.join(REPO, "video", "jobs.py"))
    jobs = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(jobs)
    return jobs


class VideoServiceWindows(unittest.TestCase):
    def test_db_connection_is_closed_after_use(self):
        with tempfile.TemporaryDirectory() as d:
            service = load_jobs().VideoService(media_dir=d, db_path=os.path.join(d, "jobs.db"))
            with service.db() as conn:
                conn.execute("SELECT 1")
            with self.assertRaises(sqlite3.ProgrammingError):  # closed
                conn.execute("SELECT 1")

    def test_files_are_read_as_utf8_not_the_platform_default(self):
        source = open(os.path.join(REPO, "video", "jobs.py"), encoding="utf-8").read()
        self.assertNotIn(".read_text())", source)
        self.assertNotIn("/content-audit.csv').open()", source)


if __name__ == "__main__":
    unittest.main()
