import { sendEvent } from "../api/client";
import type { ActivityEvent } from "../api/types";
import { ApiRequestError } from "../api/errors";
import { BUILD_ID } from "../config/build";
import { EVENTS_KEY } from "../storage/keys";
import { loadParticipantCode } from "../storage/progress";

type QueuedActivityEvent = Omit<ActivityEvent, "participant_code"> & {
  participant_code?: string;
};

export type TrackEventName =
  | "app_opened"
  | "topic_selected"
  | "video_started"
  | "video_completed"
  | "question_answered"
  | "followup_requested"
  | "objective_completed"
  | "objective_needs_review"
  | "demo_reset";

type TrackExtrasMap = {
  app_opened: undefined;
  topic_selected: { topic_id: string };
  video_started: { variant_id: string };
  video_completed: { variant_id: string };
  question_answered: { question_id: string; correct: boolean };
  followup_requested: { variant_id: string };
  objective_completed: { objective_id: string };
  objective_needs_review: { objective_id: string };
  demo_reset: undefined;
};

type SendFn = (
  event: ActivityEvent,
  signal?: AbortSignal,
) => Promise<void>;

export type EventTrackerOptions = {
  storage?: Storage;
  send?: SendFn;
  buildId?: string;
  now?: () => string;
  generateId?: () => string;
  getParticipantCode?: (storage?: Storage) => string | null;
  retryDelaysMs?: number[];
};

export type EventTracker = {
  startSession: () => void;
  track: <E extends TrackEventName>(
    name: E,
    ...args: TrackExtrasMap[E] extends undefined
      ? []
      : [extras: TrackExtrasMap[E]]
  ) => string;
  flush: () => Promise<void>;
  getQueue: () => QueuedActivityEvent[];
};

const DEFAULT_RETRY_DELAYS_MS = [
  1000, 2000, 4000, 8000, 16000, 30000,
];

function resolveStorage(storage?: Storage): Storage | null {
  if (storage) {
    return storage;
  }
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

function warn(message: string, error?: unknown): void {
  console.warn(`[clipcademy events] ${message}`, error);
}

function parseQueue(raw: string | null): QueuedActivityEvent[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as QueuedActivityEvent[];
  } catch {
    return [];
  }
}

function isRetryableSendError(error: unknown): boolean {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return true;
    }
    if (error.status === 408 || error.status === 429) {
      return true;
    }
    if (error.status >= 500) {
      return true;
    }
    if (error.status >= 400 && error.status < 500) {
      return false;
    }
  }
  return true;
}

function isDropSendError(error: unknown): boolean {
  return error instanceof ApiRequestError && !isRetryableSendError(error);
}

function toActivityEvent(event: QueuedActivityEvent): ActivityEvent {
  return {
    ...event,
    participant_code: event.participant_code ?? "",
  };
}

type TrackerStore = {
  memoryFallback: boolean;
  memoryQueue: QueuedActivityEvent[] | null;
  flushPromise: Promise<void> | null;
  retryIndex: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
  awaitingRetry: boolean;
};

const trackerStores = new WeakMap<Storage, TrackerStore>();
const detachedStore: TrackerStore = {
  memoryFallback: false,
  memoryQueue: null,
  flushPromise: null,
  retryIndex: 0,
  retryTimer: null,
  awaitingRetry: false,
};

function getTrackerStore(storage: Storage | null): TrackerStore {
  if (!storage) {
    return detachedStore;
  }
  let store = trackerStores.get(storage);
  if (!store) {
    store = {
      memoryFallback: false,
      memoryQueue: null,
      flushPromise: null,
      retryIndex: 0,
      retryTimer: null,
      awaitingRetry: false,
    };
    trackerStores.set(storage, store);
  }
  return store;
}

export function createEventTracker(
  options: EventTrackerOptions = {},
): EventTracker {
  const storage = resolveStorage(options.storage);
  const send: SendFn =
    options.send ??
    ((event, signal) => sendEvent(event, signal ? { signal } : undefined));
  const buildId = options.buildId ?? BUILD_ID;
  const now = options.now ?? (() => new Date().toISOString());
  const generateId =
    options.generateId ??
    (() =>
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `evt-${Math.random().toString(36).slice(2)}`);
  const getParticipantCode =
    options.getParticipantCode ??
    ((targetStorage?: Storage) => loadParticipantCode(targetStorage));
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const store = getTrackerStore(storage);

  let sessionId: string | null = null;
  let sessionCounter = 0;

  function readQueue(): QueuedActivityEvent[] {
    if (store.memoryFallback) {
      return [...(store.memoryQueue ?? [])];
    }
    if (!storage) {
      return [...(store.memoryQueue ?? [])];
    }
    try {
      const queue = parseQueue(storage.getItem(EVENTS_KEY));
      store.memoryQueue = queue;
      return [...queue];
    } catch (error) {
      warn("failed to read event queue from storage", error);
      store.memoryFallback = true;
      store.memoryQueue = store.memoryQueue ?? [];
      return [...store.memoryQueue];
    }
  }

  function writeQueue(queue: QueuedActivityEvent[]): void {
    store.memoryQueue = [...queue];
    if (!storage || store.memoryFallback) {
      return;
    }
    try {
      storage.setItem(EVENTS_KEY, JSON.stringify(queue));
    } catch (error) {
      warn("failed to persist event queue to storage", error);
      store.memoryFallback = true;
    }
  }

  function scheduleRetry(): void {
    if (store.retryTimer !== null) {
      return;
    }
    const delay =
      retryDelaysMs[Math.min(store.retryIndex, retryDelaysMs.length - 1)] ??
      1000;
    store.retryIndex = Math.min(store.retryIndex + 1, retryDelaysMs.length - 1);
    store.retryTimer = setTimeout(() => {
      store.retryTimer = null;
      store.awaitingRetry = false;
      void beginFlush();
    }, delay);
  }

  function resetRetryDelay(): void {
    store.retryIndex = 0;
    store.awaitingRetry = false;
    if (store.retryTimer !== null) {
      clearTimeout(store.retryTimer);
      store.retryTimer = null;
    }
  }

  function enqueue(event: QueuedActivityEvent): void {
    const queue = readQueue();
    if (queue.some((item) => item.event_id === event.event_id)) {
      return;
    }
    queue.push(event);
    writeQueue(queue);
  }

  function buildEvent(
    name: TrackEventName,
    extras: Record<string, unknown> | undefined,
  ): QueuedActivityEvent {
    const code = getParticipantCode(storage ?? undefined);
    const base = {
      event_id: generateId(),
      event_name: name,
      build_id: buildId,
      session_id: sessionId ?? "",
      client_timestamp: now(),
      ...(extras ?? {}),
    } satisfies Omit<QueuedActivityEvent, "participant_code"> & {
      participant_code?: string;
    };

    if (code) {
      return { ...base, participant_code: code };
    }
    return base;
  }

  function prepareForSend(event: QueuedActivityEvent): QueuedActivityEvent | null {
    const prepared = { ...event };
    if (!prepared.participant_code) {
      const code = getParticipantCode(storage ?? undefined);
      if (code) {
        prepared.participant_code = code;
      }
    }
    if (!prepared.participant_code) {
      return null;
    }
    return prepared;
  }

  function removeHeadIfMatches(eventId: string): void {
    const current = readQueue();
    if (current.length === 0) {
      return;
    }
    if (current[0]!.event_id === eventId) {
      current.shift();
      writeQueue(current);
      return;
    }
    const index = current.findIndex((event) => event.event_id === eventId);
    if (index >= 0) {
      current.splice(index, 1);
      writeQueue(current);
    }
  }

  async function runFlush(): Promise<void> {
    store.awaitingRetry = false;
    while (true) {
      const queue = readQueue();
      if (queue.length === 0) {
        resetRetryDelay();
        return;
      }

      const head = queue[0]!;
      const prepared = prepareForSend(head);
      if (!prepared) {
        return;
      }

      try {
        await send(toActivityEvent(prepared), undefined);
      } catch (error) {
        if (isDropSendError(error)) {
          warn(`dropping event ${head.event_id}`, error);
          removeHeadIfMatches(head.event_id);
          resetRetryDelay();
          continue;
        }
        scheduleRetry();
        store.awaitingRetry = true;
        return;
      }

      removeHeadIfMatches(prepared.event_id);
      resetRetryDelay();
    }
  }

  function beginFlush(): Promise<void> {
    if (store.flushPromise) {
      return store.flushPromise;
    }
    if (store.retryTimer !== null) {
      clearTimeout(store.retryTimer);
      store.retryTimer = null;
      store.awaitingRetry = false;
      store.retryIndex = 0;
    }
    store.flushPromise = runFlush()
      .catch((error) => {
        warn("flush failed", error);
      })
      .finally(() => {
        store.flushPromise = null;
      });
    return store.flushPromise;
  }

  function triggerBackgroundFlush(): void {
    void beginFlush();
  }

  return {
    startSession() {
      try {
        sessionCounter += 1;
        sessionId = `session-${sessionCounter}`;
        enqueue(buildEvent("app_opened", undefined));
        triggerBackgroundFlush();
      } catch (error) {
        warn("startSession failed", error);
      }
    },

    track(name, ...args) {
      try {
        if (!sessionId) {
          sessionId = generateId();
        }
        const extras = args[0] as Record<string, unknown> | undefined;
        const event = buildEvent(name, extras);
        enqueue(event);
        triggerBackgroundFlush();
        return event.event_id;
      } catch (error) {
        warn("track failed", error);
        return generateId();
      }
    },

    flush() {
      try {
        return beginFlush();
      } catch (error) {
        warn("flush failed", error);
        return Promise.resolve();
      }
    },

    getQueue() {
      try {
        return readQueue();
      } catch (error) {
        warn("getQueue failed", error);
        return [];
      }
    },
  };
}

export const eventTracker = createEventTracker();
