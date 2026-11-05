"""Secrets.txt (API keys) can never be committed."""
import os
import shutil
import subprocess
import tempfile
import unittest

from _repo import REPO


class IgnoreSecrets(unittest.TestCase):
    def test_git_ignores_secrets_txt(self):
        with tempfile.TemporaryDirectory() as d:
            subprocess.run(["git", "init", "-q", d], check=True)
            shutil.copy(os.path.join(REPO, ".gitignore"), d)
            ignored = subprocess.run(["git", "check-ignore", "-q", "secrets.txt"], cwd=d).returncode == 0
        self.assertTrue(ignored, "secrets.txt is not ignored")


if __name__ == "__main__":
    unittest.main()
