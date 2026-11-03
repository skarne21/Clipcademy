import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { apiUrl } from "../api/config";
import { attemptContinue, attemptReviewAgain } from "../fixtures/attempts";
import { repQ1 } from "../fixtures/questions";
import { topics } from "../fixtures/topics";
import { videoJobQueued, videoJobReady } from "../fixtures/videoJobs";
import { handlers } from "./handlers";
import { server } from "./server";

describe("MSW API handlers", () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it("GET /topics returns four topics", async () => {
    const res = await fetch(apiUrl("/topics"));
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body).toHaveLength(4);
    expect(body).toEqual(topics);
  });

  it("GET /questions/rep-q1 returns question without answer fields", async () => {
    const res = await fetch(apiUrl("/questions/rep-q1"));
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body).toEqual(repQ1);
    const keys = Object.keys(body).map((k) => k.toLowerCase());
    expect(keys.some((k) => k.includes("correct"))).toBe(false);
    expect(keys.some((k) => k.includes("answer"))).toBe(false);
  });

  it("GET /questions/unknown returns 404 ApiError", async () => {
    const res = await fetch(apiUrl("/questions/unknown-id"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("not_found");
    expect(typeof body.message).toBe("string");
  });

  it("POST /attempts returns attemptContinue for choice A or B", async () => {
    for (const selected_choice_id of ["A", "B"]) {
      const res = await fetch(apiUrl("/attempts"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attempt_id: attemptContinue.attempt_id,
          question_id: "rep-q1",
          selected_choice_id,
          objective_id: "synthesis_direction_and_primer",
          remediation_state: attemptContinue.remediation_state,
        }),
      });
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body).toEqual(attemptContinue);
    }
  });

  it("POST /attempts can be overridden to return attemptReviewAgain", async () => {
    server.use(
      http.post(apiUrl("/attempts"), () => HttpResponse.json(attemptReviewAgain)),
    );
    const res = await fetch(apiUrl("/attempts"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        attempt_id: "attempt-001",
        question_id: "rep-q2",
        selected_choice_id: "A",
        objective_id: "synthesis_direction_and_primer",
        remediation_state: attemptReviewAgain.remediation_state,
      }),
    });
    expect(await res.json()).toEqual(attemptReviewAgain);
  });

  it("POST /video-jobs returns queued job", async () => {
    const res = await fetch(apiUrl("/video-jobs"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic_id: "dna_replication",
        objective_id: "synthesis_direction_and_primer",
        variant_id: "primer_followup",
        teaching_goal: "Explain primer",
        source_refs: ["L19-p1"],
      }),
    });
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.status).toBe("queued");
    expect(body).toEqual(videoJobQueued);
  });

  it("GET /video-jobs/video-001 returns ready job with video_url", async () => {
    const res = await fetch(apiUrl("/video-jobs/video-001"));
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.status).toBe("ready");
    expect(body.video_url).toBeTruthy();
    expect(body).toEqual(videoJobReady);
  });

  it("POST /events returns 204 with no body", async () => {
    const res = await fetch(apiUrl("/events"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_id: "evt-1",
        event_name: "question_answered",
        participant_code: "P001",
        build_id: "dev",
        session_id: "sess-1",
        client_timestamp: new Date().toISOString(),
      }),
    });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });
});

// Ensure handlers are registered (import side effect for coverage)
expect(handlers.length).toBeGreaterThan(0);
