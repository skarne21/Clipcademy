import type { EventTracker } from "../events/tracker";

export type AppDeps = {
  tracker: EventTracker;
  storage: Storage;
  generateId: () => string;
  pollIntervalMs: number;
  pollTimeoutMs: number;
};

export const defaultPollIntervalMs = 1500;
export const defaultPollTimeoutMs = 120_000;
