"""/video-jobs is 503 until Member 1's handler exists, then requests pass through unchanged."""
import json
import unittest

from _repo import call, new_app


def echo_video_app(environ, start_response):
    body = environ["wsgi.input"].read(int(environ.get("CONTENT_LENGTH") or 0)).decode()
    start_response("202 Accepted", [("Content-Type", "application/json")])
    return [json.dumps({"path": environ["PATH_INFO"], "body": body}).encode()]


class VideoJobs(unittest.TestCase):
    def test_503_without_a_video_service(self):
        status, r = call(new_app(video_app=None), "POST", "/video-jobs", {"variant_id": "primer_followup"})
        self.assertEqual((status, r["error"]["field"]), (503, "path"))

    def test_forwards_to_the_video_service(self):
        app = new_app(video_app=echo_video_app)
        status, r = call(app, "POST", "/video-jobs", {"variant_id": "primer_followup"})
        self.assertEqual((status, r["path"], json.loads(r["body"])), (202, "/video-jobs", {"variant_id": "primer_followup"}))
        self.assertEqual(call(app, "GET", "/video-jobs/job-1")[1]["path"], "/video-jobs/job-1")


if __name__ == "__main__":
    unittest.main()
