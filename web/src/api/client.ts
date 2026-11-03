import type {
  ActivityEvent,
  ApiError,
  AttemptRequest,
  AttemptResult,
  Question,
  Topic,
  VideoJob,
  VideoRequest,
} from "./types";
import { apiUrl } from "./config";
import {
  ApiRequestError,
  delay,
  throwIfAborted,
  VideoJobFailedError,
  VideoJobTimeoutError,
} from "./errors";

export type ApiRequestOptions = {
  signal?: AbortSignal;
};

type JsonRequestInit = RequestInit & {
  signal?: AbortSignal;
};

async function readJsonBody<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    throw new ApiRequestError(
      response.status,
      "invalid_response",
      "Empty response body",
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiRequestError(
      response.status,
      "invalid_response",
      "Response body is not valid JSON",
    );
  }
}

async function requestJson<T>(
  path: string,
  init: JsonRequestInit = {},
): Promise<T> {
  throwIfAborted(init.signal);

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    throw new ApiRequestError(0, "network_error", "Network request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    try {
      const apiError = await readJsonBody<ApiError>(response);
      throw new ApiRequestError(response.status, apiError.error, apiError.message);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        throw error;
      }
      throw new ApiRequestError(
        response.status,
        "invalid_response",
        `Request failed with status ${response.status}`,
      );
    }
  }

  return readJsonBody<T>(response);
}

export async function getTopics(options?: ApiRequestOptions): Promise<Topic[]> {
  return requestJson<Topic[]>("/topics", {
    method: "GET",
    signal: options?.signal,
  });
}

export async function getQuestion(
  questionId: string,
  options?: ApiRequestOptions,
): Promise<Question> {
  return requestJson<Question>(`/questions/${encodeURIComponent(questionId)}`, {
    method: "GET",
    signal: options?.signal,
  });
}

export async function submitAttempt(
  request: AttemptRequest,
  options?: ApiRequestOptions,
): Promise<AttemptResult> {
  const body = {
    attempt_id: request.attempt_id,
    question_id: request.question_id,
    selected_choice_id: request.selected_choice_id,
    objective_id: request.objective_id,
    remediation_state: request.remediation_state,
  };

  return requestJson<AttemptResult>("/attempts", {
    method: "POST",
    body: JSON.stringify(body),
    signal: options?.signal,
  });
}

export async function createVideoJob(
  request: VideoRequest,
  options?: ApiRequestOptions,
): Promise<VideoJob> {
  return requestJson<VideoJob>("/video-jobs", {
    method: "POST",
    body: JSON.stringify(request),
    signal: options?.signal,
  });
}

export async function getVideoJob(
  jobId: string,
  options?: ApiRequestOptions,
): Promise<VideoJob> {
  return requestJson<VideoJob>(`/video-jobs/${encodeURIComponent(jobId)}`, {
    method: "GET",
    signal: options?.signal,
  });
}

export type PollVideoJobOptions = {
  intervalMs: number;
  timeoutMs: number;
  signal?: AbortSignal;
};

export async function pollVideoJob(
  jobId: string,
  options: PollVideoJobOptions,
): Promise<VideoJob> {
  const started = Date.now();

  while (true) {
    throwIfAborted(options.signal);

    if (Date.now() - started >= options.timeoutMs) {
      throw new VideoJobTimeoutError(jobId);
    }

    const job = await getVideoJob(jobId, { signal: options.signal });

    if (job.status === "ready") {
      return job;
    }

    if (job.status === "failed") {
      throw new VideoJobFailedError(job);
    }

    await delay(options.intervalMs, options.signal);
  }
}

export async function sendEvent(
  event: ActivityEvent,
  options?: ApiRequestOptions,
): Promise<void> {
  await requestJson<void>("/events", {
    method: "POST",
    body: JSON.stringify(event),
    signal: options?.signal,
  });
}
