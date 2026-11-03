import type { VideoJob } from "../api/types";

const baseJob = {
  job_id: "video-001",
  variant_id: "primer_followup",
  source_refs: ["L19-p1", "L19-p2"] as string[],
};

export const videoJobQueued: VideoJob = {
  ...baseJob,
  status: "queued",
};

export const videoJobRunning: VideoJob = {
  ...baseJob,
  status: "running",
};

export const videoJobReady: VideoJob = {
  ...baseJob,
  status: "ready",
  video_url: "/media/sample.mp4",
  transcript: "Sample transcript placeholder.",
};

export const videoJobFailed: VideoJob = {
  ...baseJob,
  status: "failed",
  error: "render_failed",
};

export const videoJobs: Record<string, VideoJob> = {
  queued: videoJobQueued,
  running: videoJobRunning,
  ready: videoJobReady,
  failed: videoJobFailed,
};
