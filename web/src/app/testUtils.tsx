import { render, type RenderOptions } from "@testing-library/react";
import { vi } from "vitest";
import type { ActivityEvent } from "../api/types";
import App from "../App";
import { createEventTracker } from "../events/tracker";
import {
  createDefaultProgressState,
  loadParticipantCode,
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

export type RenderAppOptions = {
  storage?: Storage;
  participantCode?: string;
  selectedTopicIds?: string[];
  renderOptions?: RenderOptions;
};

export function renderApp(options: RenderAppOptions = {}) {
  const storage = options.storage ?? createMemoryStorage();

  if (options.participantCode) {
    saveParticipantCode(options.participantCode, storage);
  }
  if (options.selectedTopicIds) {
    saveProgress(
      {
        ...createDefaultProgressState(),
        selected_topic_ids: options.selectedTopicIds,
      },
      storage,
    );
  }

  let idCounter = 0;
  const send: SendMock = vi.fn<ActivityEventSendFn>().mockResolvedValue(undefined);

  const tracker = createEventTracker({
    storage,
    send,
    buildId: "test-build",
    now: () => "2026-01-01T00:00:00.000Z",
    generateId: () => {
      idCounter += 1;
      return `evt-${idCounter}`;
    },
    getParticipantCode: () => loadParticipantCode(storage),
    retryDelaysMs: [1000, 2000, 4000],
  });

  const deps: AppDeps = {
    tracker,
    storage,
    generateId: () => {
      idCounter += 1;
      return `gen-${idCounter}`;
    },
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

export function sentEvents(send: SendMock): ActivityEvent[] {
  return send.mock.calls.map(([event]) => event);
}

export function eventsNamed(send: SendMock, name: string): ActivityEvent[] {
  return sentEvents(send).filter((event) => event.event_name === name);
}
