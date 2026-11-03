import { eventTracker } from "../events/tracker";
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

export function createDefaultAppDeps(storage?: Storage): AppDeps {
  const resolvedStorage =
    storage ??
    (typeof window !== "undefined" ? window.localStorage : (null as unknown as Storage));

  return {
    tracker: eventTracker,
    storage: resolvedStorage,
    generateId: () => crypto.randomUUID(),
    pollIntervalMs: defaultPollIntervalMs,
    pollTimeoutMs: defaultPollTimeoutMs,
  };
}
