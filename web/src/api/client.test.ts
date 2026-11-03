import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiUrl } from "./config";
import {
  attemptContinue,
  attemptReviewAgain,
} from "../fixtures/attempts";
import { repQ1 } from "../fixtures/questions";
import { topics } from "../fixtures/topics";
import {
  videoJobFailed,
  videoJobQueued,
  videoJobReady,
  videoJobRunning,
} from "../fixtures/videoJobs";
import type {
  ActivityEvent,
  AttemptRequest,
  VideoRequest,
} from "./types";
import {
  createVideoJob,
  getQuestion,
  getTopics,
  getVideoJob,
  pollVideoJob,
  sendEvent,
  submitAttempt,
} from "./client";
import {
  ApiRequestError,
  VideoJobFailedError,
  VideoJobTimeoutError,
} from "./errors";
import { server } from "../mocks/server";

const sampleAttemptRequest: AttemptRequest = {
  attempt_id: "attempt-client-001",
  question_id: "rep-q1",
  selected_choice_id: "B",
  objective_id: "synthesis_direction_and_primer",
  remediation_state: attemptContinue.remediation_state,
};

const sampleVideoRequest: VideoRequest = {
  topic_id: "dna_replication",
  objective_id: "synthesis_direction_and_primer",
  variant_id: "primer_followup",
  teaching_goal: "Explain primer requirement",
  source_refs: ["L19-p1", "L19-p2"],
};

const sampleEvent: ActivityEvent = {
  event_id: "evt-client-1",
  event_name: "question_answered",
  participant_code: "P001",
  build_id: "test",
  session_id: "sess-1",
  client_timestamp: "2026-01-01T00:00:00.000Z",
  question_id: "rep-q1",
  correct: true,
};

describe("getTopics", () => {
  it("calls GET /topics and returns the four topics fixture", async () => {
    const result = await getTopics();
    expect(result).toEqual(topics);
    expect(result).toHaveLength(4);
  });
});

describe("getQuestion", () => {
  it("calls GET /questions/{id} and returns the question", async () => {
    const result = await getQuestion("rep-q1");
    expect(result).toEqual(repQ1);
  });

  it("throws ApiRequestError with status 404 and code not_found for unknown id", async () => {
    await expect(getQuestion("unknown-question")).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 404,
      code: "not_found",
    });
    await expect(getQuestion("unknown-question")).rejects.toBeInstanceOf(
      ApiRequestError,
    );
  });

  it("rejects with AbortError when the signal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(getQuestion("rep-q1", { signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});

describe("submitAttempt", () => {
  it("POST /attempts sends the expected JSON body and returns AttemptResult unchanged", async () => {
    let captured: AttemptRequest | null = null;
    server.use(
      http.post(apiUrl("/attempts"), async ({ request }) => {
        captured = (await request.json()) as AttemptRequest;
        return HttpResponse.json(attemptReviewAgain);
      }),
    );

    const result = await submitAttempt(sampleAttemptRequest);
    expect(captured).toEqual({
      attempt_id: sampleAttemptRequest.attempt_id,
      question_id: sampleAttemptRequest.question_id,
      selected_choice_id: sampleAttemptRequest.selected_choice_id,
      objective_id: sampleAttemptRequest.objective_id,
      remediation_state: sampleAttemptRequest.remediation_state,
    });
    expect(Object.keys(captured ?? {})).toEqual([
      "attempt_id",
      "question_id",
      "selected_choice_id",
      "objective_id",
      "remediation_state",
    ]);
    expect(result).toEqual(attemptReviewAgain);
  });

  it("sends the same attempt_id when called twice with the same request", async () => {
    const attemptIds: string[] = [];
    server.use(
      http.post(apiUrl("/attempts"), async ({ request }) => {
        const body = (await request.json()) as AttemptRequest;
        attemptIds.push(body.attempt_id);
        return HttpResponse.json(attemptContinue);
      }),
    );

    await submitAttempt(sampleAttemptRequest);
    await submitAttempt(sampleAttemptRequest);
    expect(attemptIds).toEqual(["attempt-client-001", "attempt-client-001"]);
  });
});

describe("createVideoJob", () => {
  it("POST /video-jobs with request body returns queued job", async () => {
    let captured: VideoRequest | null = null;
    server.use(
      http.post(apiUrl("/video-jobs"), async ({ request }) => {
        captured = (await request.json()) as VideoRequest;
        return HttpResponse.json(videoJobQueued);
      }),
    );

    const result = await createVideoJob(sampleVideoRequest);
    expect(captured).toEqual(sampleVideoRequest);
    expect(result).toEqual(videoJobQueued);
  });
});

describe("getVideoJob", () => {
  it("returns the job for video-001", async () => {
    const job = await getVideoJob("video-001");
    expect(job).toEqual(videoJobReady);
  });

  it("throws ApiRequestError 404 for unknown ids", async () => {
    await expect(getVideoJob("missing-job")).rejects.toBeInstanceOf(ApiRequestError);
    await expect(getVideoJob("missing-job")).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
  });
});

describe("pollVideoJob", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with ready job after queued and running", async () => {
    const sequence = [videoJobQueued, videoJobRunning, videoJobReady];
    let callIndex = 0;
    server.use(
      http.get(apiUrl("/video-jobs/:jobId"), () => {
        const job = sequence[Math.min(callIndex, sequence.length - 1)];
        callIndex += 1;
        return HttpResponse.json(job);
      }),
    );

    const job = await pollVideoJob("video-001", { intervalMs: 1, timeoutMs: 500 });
    expect(job.status).toBe("ready");
    expect(job).toEqual(videoJobReady);
    expect(callIndex).toBeGreaterThanOrEqual(3);
  });

  it("rejects with VideoJobFailedError containing the job", async () => {
    server.use(
      http.get(apiUrl("/video-jobs/:jobId"), () => HttpResponse.json(videoJobFailed)),
    );

    await expect(
      pollVideoJob("video-001", { intervalMs: 1, timeoutMs: 500 }),
    ).rejects.toBeInstanceOf(VideoJobFailedError);

    try {
      await pollVideoJob("video-001", { intervalMs: 1, timeoutMs: 500 });
    } catch (error) {
      expect(error).toBeInstanceOf(VideoJobFailedError);
      expect((error as VideoJobFailedError).job).toEqual(videoJobFailed);
    }
  });

  it("rejects with VideoJobTimeoutError if still running after timeoutMs", async () => {
    server.use(
      http.get(apiUrl("/video-jobs/:jobId"), () => HttpResponse.json(videoJobRunning)),
    );

    await expect(
      pollVideoJob("video-001", { intervalMs: 1, timeoutMs: 20 }),
    ).rejects.toBeInstanceOf(VideoJobTimeoutError);

    try {
      await pollVideoJob("video-001", { intervalMs: 1, timeoutMs: 20 });
    } catch (error) {
      expect(error).toBeInstanceOf(VideoJobTimeoutError);
      expect((error as VideoJobTimeoutError).jobId).toBe("video-001");
    }
  });

  it("stops polling and rejects with AbortError when aborted", async () => {
    let requestCount = 0;
    server.use(
      http.get(apiUrl("/video-jobs/:jobId"), () => {
        requestCount += 1;
        return HttpResponse.json(videoJobRunning);
      }),
    );

    const controller = new AbortController();
    const pollPromise = pollVideoJob("video-001", {
      intervalMs: 5,
      timeoutMs: 5000,
      signal: controller.signal,
    });

    await vi.waitFor(() => {
      expect(requestCount).toBeGreaterThanOrEqual(1);
    });

    const countAtAbort = requestCount;
    controller.abort();

    await expect(pollPromise).rejects.toMatchObject({ name: "AbortError" });

    await new Promise((r) => setTimeout(r, 30));
    expect(requestCount).toBe(countAtAbort);
  });
});

describe("sendEvent", () => {
  it("POST /events with body resolves on 204", async () => {
    let captured: ActivityEvent | null = null;
    server.use(
      http.post(apiUrl("/events"), async ({ request }) => {
        captured = (await request.json()) as ActivityEvent;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(sendEvent(sampleEvent)).resolves.toBeUndefined();
    expect(captured).toEqual(sampleEvent);
  });

  it("throws ApiRequestError on 500 response", async () => {
    server.use(
      http.post(apiUrl("/events"), () =>
        HttpResponse.json(
          { error: "server_error", message: "Internal failure" },
          { status: 500 },
        ),
      ),
    );

    await expect(sendEvent(sampleEvent)).rejects.toBeInstanceOf(ApiRequestError);
    await expect(sendEvent(sampleEvent)).rejects.toMatchObject({
      status: 500,
      code: "server_error",
      message: "Internal failure",
    });
  });
});

describe("error handling (all functions)", () => {
  it("maps ApiError JSON on 500 to ApiRequestError", async () => {
    server.use(
      http.get(apiUrl("/topics"), () =>
        HttpResponse.json({ error: "server_error", message: "boom" }, { status: 500 }),
      ),
    );

    await expect(getTopics()).rejects.toMatchObject({
      status: 500,
      code: "server_error",
      message: "boom",
    });
  });

  it("throws ApiRequestError invalid_response for non-JSON body", async () => {
    server.use(
      http.get(apiUrl("/topics"), () =>
        new HttpResponse("not json", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
      ),
    );

    await expect(getTopics()).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("throws ApiRequestError network_error with status 0 on network failure", async () => {
    server.use(http.get(apiUrl("/topics"), () => HttpResponse.error()));

    await expect(getTopics()).rejects.toMatchObject({
      status: 0,
      code: "network_error",
    });
  });
});
