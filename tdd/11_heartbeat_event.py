"""The server stores heartbeat events (time on app) and exports them."""
import unittest

from _repo import call, event, new_app


class HeartbeatEvent(unittest.TestCase):
    def test_heartbeat_is_stored_and_exported(self):
        app = new_app()
        ev = event("heartbeat")
        status, r = call(app, "POST", "/events", ev)
        self.assertEqual(status, 201, r)
        self.assertEqual(r["event_id"], ev["event_id"])
        _, csv_text = call(app, "GET", "/events.csv", headers={"Authorization": "Bearer t"})
        self.assertIn(f"{ev['event_id']},P01,", csv_text)


if __name__ == "__main__":
    unittest.main()
