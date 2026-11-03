import type { VideoJob } from "./types";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

export class VideoJobFailedError extends Error {
  readonly job: VideoJob;

  constructor(job: VideoJob) {
    super(`Video job failed: ${job.job_id}`);
    this.name = "VideoJobFailedError";
    this.job = job;
  }
}

export class VideoJobTimeoutError extends Error {
  readonly jobId: string;

  constructor(jobId: string) {
    super(`Video job timed out: ${jobId}`);
    this.name = "VideoJobTimeoutError";
    this.jobId = jobId;
  }
}

function abortError(signal?: AbortSignal): DOMException {
  if (signal?.reason instanceof Error && signal.reason.name === "AbortError") {
    return signal.reason as DOMException;
  }
  return new DOMException("The operation was aborted.", "AbortError");
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw abortError(signal);
  }
}

export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      reject(abortError(signal));
    };

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
