import { cleanup, render, type RenderOptions } from "@testing-library/react";
import { vi } from "vitest";
import type { ActivityEvent } from "../api/types";
import App from "../App";
import { createEventTracker, type EventTracker } from "../events/tracker";
import {
  loadParticipantCode,
  loadProgress,
  saveParticipantCode,
  saveProgress,
} from "../storage/progress";
import type { AppDeps } from "./deps";

export type SendMock = ReturnType<typeof vi.fn<ActivityEventSendFn>>;

type ActivityEventSendFn = (
  event: ActivityEvent,
  signal?: AbortSignal,
) => Promise<void>;

export function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

export function createSharedGenerateId(prefix = "gen"): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}-${counter}`;
  };
}

export type RenderAppOptions = {
  storage?: Storage;
  participantCode?: string;
  selectedTopicIds?: string[];
  renderOptions?: RenderOptions;
  generateId?: () => string;
  tracker?: EventTracker;
  send?: SendMock;
};

export function renderApp(options: RenderAppOptions = {}) {
  const storage = options.storage ?? createMemoryStorage();

  if (options.participantCode) {
    saveParticipantCode(options.participantCode, storage);
  }
  if (options.selectedTopicIds) {
    const existing = loadProgress(storage);
    saveProgress(
      {
        ...existing,
        selected_topic_ids: options.selectedTopicIds,
      },
      storage,
    );
  }

  let idCounter = 0;
  const nextId = options.generateId ?? (() => {
    idCounter += 1;
    return `gen-${idCounter}`;
  });

  const send: SendMock =
    options.send ?? vi.fn<ActivityEventSendFn>().mockResolvedValue(undefined);

  let eventCounter = 0;
  const tracker =
    options.tracker ??
    createEventTracker({
      storage,
      send,
      buildId: "test-build",
      now: () => "2026-01-01T00:00:00.000Z",
      generateId: () => {
        eventCounter += 1;
        return `evt-${eventCounter}`;
      },
      getParticipantCode: () => loadParticipantCode(storage),
      retryDelaysMs: [1000, 2000, 4000],
    });

  const deps: AppDeps = {
    tracker,
    storage,
    generateId: nextId,
    pollIntervalMs: 1,
    pollTimeoutMs: 120_000,
  };

  const view = render(<App deps={deps} />, options.renderOptions);

  return {
    ...view,
    deps,
    storage,
    send,
    tracker,
  };
}

export function refreshApp(options: RenderAppOptions & { storage: Storage }) {
  cleanup();
  return renderApp(options);
}

export function sentEvents(send: SendMock): ActivityEvent[] {
  return send.mock.calls.map(([event]) => event);
}

export function eventsNamed(send: SendMock, name: string): ActivityEvent[] {
  return sentEvents(send).filter((event) => event.event_name === name);
}
