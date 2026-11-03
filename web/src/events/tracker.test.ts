import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityEvent } from "../api/types";
import { ApiRequestError } from "../api/errors";
import { EVENTS_KEY } from "../storage/keys";
import { resetDemo } from "../storage/progress";
import { createEventTracker } from "./tracker";

function createMemoryStorage(): Storage {
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

type SendFn = (
  event: ActivityEvent,
  signal?: AbortSignal,
) => Promise<void>;

function createTestTracker(
  overrides: {
    storage?: Storage;
    send?: SendFn;
    buildId?: string;
    now?: () => string;
    generateId?: () => string;
    getParticipantCode?: () => string | null;
    retryDelaysMs?: number[];
  } = {},
) {
  let idCounter = 0;
  const storage = overrides.storage ?? createMemoryStorage();
  const send =
    overrides.send ?? vi.fn<SendFn>().mockResolvedValue(undefined);

  const tracker = createEventTracker({
    storage,
    send,
    buildId: overrides.buildId ?? "test-build",
    now: overrides.now ?? (() => "2026-01-01T00:00:00.000Z"),
    generateId:
      overrides.generateId ??
      (() => {
        idCounter += 1;
        return `evt-${idCounter}`;
      }),
    getParticipantCode: overrides.getParticipantCode ?? (() => "P001"),
    retryDelaysMs: overrides.retryDelaysMs ?? [1000, 2000, 4000],
  });

  return { tracker, storage, send };
}

describe("event contents", () => {
  it("track fills event_id, participant_code, build_id, session_id, client_timestamp, and the extras", () => {
    const { tracker } = createTestTracker();
    tracker.startSession();
    const eventId = tracker.track("topic_selected", {
      topic_id: "dna_replication",
    });

    expect(eventId).toBe("evt-2");
    expect(tracker.getQueue()).toContainEqual({
      event_id: "evt-2",
      event_name: "topic_selected",
      participant_code: "P001",
      build_id: "test-build",
      session_id: expect.any(String),
      client_timestamp: "2026-01-01T00:00:00.000Z",
      topic_id: "dna_replication",
    });
  });

  it("each track call gets a different event_id", () => {
    const { tracker } = createTestTracker();
    tracker.startSession();
    const first = tracker.track("demo_reset");
    const second = tracker.track("demo_reset");
    expect(first).not.toBe(second);
  });

  it("topic_selected includes topic_id; question_answered includes question_id and correct", () => {
    const { tracker } = createTestTracker();
    tracker.startSession();
    tracker.track("topic_selected", { topic_id: "dna_repair" });
    tracker.track("question_answered", {
      question_id: "rep-q1",
      correct: true,
    });

    const queue = tracker.getQueue();
    expect(queue.find((e) => e.event_name === "topic_selected")).toMatchObject({
      topic_id: "dna_repair",
    });
    expect(
      queue.find((e) => e.event_name === "question_answered"),
    ).toMatchObject({
      question_id: "rep-q1",
      correct: true,
    });
  });
});

describe("sessions", () => {
  it("startSession queues an app_opened event", () => {
    const { tracker } = createTestTracker();
    tracker.startSession();
    expect(tracker.getQueue()).toContainEqual(
      expect.objectContaining({
        event_id: "evt-1",
        event_name: "app_opened",
      }),
    );
  });

  it("a second startSession uses a different session_id; events tracked after it carry the new id", () => {
    const { tracker } = createTestTracker();
    tracker.startSession();
    const firstSessionId = tracker.getQueue()[0]!.session_id;

    tracker.startSession();
    const secondSessionId = tracker.getQueue()[1]!.session_id;
    expect(secondSessionId).not.toBe(firstSessionId);

    tracker.track("topic_selected", { topic_id: "dna_replication" });
    const tracked = tracker.getQueue()[2]!;
    expect(tracked.session_id).toBe(secondSessionId);
  });
});

describe("never blocks", () => {
  it("track returns the event_id even when send returns a promise that never resolves", () => {
    const send = vi.fn<SendFn>(() => new Promise(() => {}));
    const { tracker } = createTestTracker({ send });
    tracker.startSession();
    const eventId = tracker.track("demo_reset");
    expect(eventId).toBe("evt-2");
  });

  it("track does not throw when send rejects", async () => {
    const send = vi
      .fn<SendFn>()
      .mockRejectedValue(new ApiRequestError(500, "server_error", "fail"));
    const { tracker } = createTestTracker({ send });
    tracker.startSession();
    expect(() => tracker.track("demo_reset")).not.toThrow();
    await tracker.flush();
  });

  it("track does not throw when storage throws, and the event still reaches send", async () => {
    const memory = createMemoryStorage();
    const storage: Storage = {
      get length() {
        return memory.length;
      },
      clear() {
        memory.clear();
      },
      getItem(key: string) {
        if (key === EVENTS_KEY) {
          throw new Error("storage read failed");
        }
        return memory.getItem(key);
      },
      key(index: number) {
        return memory.key(index);
      },
      removeItem(_key: string) {
        throw new Error("storage write failed");
      },
      setItem(_key: string, _value: string) {
        throw new Error("storage write failed");
      },
    };

    const send = vi.fn<SendFn>().mockResolvedValue(undefined);
    const { tracker } = createTestTracker({ storage, send });
    tracker.startSession();
    expect(() => tracker.track("demo_reset")).not.toThrow();
    await tracker.flush();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ event_name: "demo_reset" }),
      undefined,
    );
  });
});

describe("flush and order", () => {
  it("flush sends queued events oldest first and empties the queue on success", async () => {
    const send = vi.fn<SendFn>().mockResolvedValue(undefined);
    const { tracker } = createTestTracker({ send });
    tracker.startSession();
    tracker.track("topic_selected", { topic_id: "dna_replication" });

    await tracker.flush();

    expect(send.mock.calls.map(([event]) => event.event_name)).toEqual([
      "app_opened",
      "topic_selected",
    ]);
    expect(tracker.getQueue()).toEqual([]);
  });

  it("if the second of three sends fails with a network error, the first is removed and the second and third stay queued in order", async () => {
    const send = vi
      .fn<SendFn>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        new ApiRequestError(0, "network_error", "offline"),
      );
    const { tracker } = createTestTracker({ send, retryDelaysMs: [60000] });
    tracker.startSession();
    tracker.track("topic_selected", { topic_id: "a" });
    tracker.track("question_answered", {
      question_id: "rep-q1",
      correct: false,
    });

    await tracker.flush();

    expect(send).toHaveBeenCalledTimes(2);
    expect(tracker.getQueue().map((e) => e.event_name)).toEqual([
      "topic_selected",
      "question_answered",
    ]);
  });

  it("a 500 also keeps the event queued", async () => {
    const send = vi
      .fn<SendFn>()
      .mockRejectedValue(
        new ApiRequestError(500, "server_error", "Internal failure"),
      );
    const { tracker } = createTestTracker({ send, retryDelaysMs: [60000] });
    tracker.startSession();

    await tracker.flush();

    expect(send).toHaveBeenCalledTimes(1);
    expect(tracker.getQueue()).toHaveLength(1);
    expect(tracker.getQueue()[0]!.event_name).toBe("app_opened");
  });

  it("a 400 drops that event and continues with the next", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const send = vi
      .fn<SendFn>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        new ApiRequestError(400, "bad_request", "Invalid event"),
      )
      .mockResolvedValueOnce(undefined);
    const { tracker } = createTestTracker({ send });
    tracker.startSession();
    tracker.track("topic_selected", { topic_id: "dna_replication" });
    tracker.track("demo_reset");

    await tracker.flush();

    expect(send.mock.calls.map(([event]) => event.event_name)).toEqual([
      "app_opened",
      "topic_selected",
      "demo_reset",
    ]);
    expect(tracker.getQueue()).toEqual([]);
    warn.mockRestore();
  });

  it("calling flush twice at once sends each event only once", async () => {
    const send = vi.fn<SendFn>(
      () => new Promise((resolve) => setTimeout(resolve, 10)),
    );
    const { tracker } = createTestTracker({ send });
    tracker.startSession();

    const first = tracker.flush();
    const second = tracker.flush();
    expect(first).toBe(second);
    await Promise.all([first, second]);

    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("retry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("after a failed flush, advancing fake timers by the first retry delay triggers another send attempt", async () => {
    const send = vi
      .fn<SendFn>()
      .mockRejectedValueOnce(
        new ApiRequestError(0, "network_error", "offline"),
      )
      .mockResolvedValueOnce(undefined);
    const { tracker } = createTestTracker({ send, retryDelaysMs: [1000, 2000] });
    tracker.startSession();

    await tracker.flush();
    expect(send).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    await vi.runOnlyPendingTimersAsync();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("consecutive failures use increasing delays; after a success, the next failure starts again at the first delay", async () => {
    const send = vi.fn<SendFn>();
    send
      .mockRejectedValueOnce(
        new ApiRequestError(0, "network_error", "offline"),
      )
      .mockRejectedValueOnce(
        new ApiRequestError(0, "network_error", "offline"),
      )
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        new ApiRequestError(0, "network_error", "offline"),
      );

    const { tracker } = createTestTracker({
      send,
      retryDelaysMs: [1000, 2000, 4000],
    });
    tracker.startSession();

    await tracker.flush();
    expect(send).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1999);
    expect(send).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(3);

    tracker.track("demo_reset");
    await tracker.flush();
    expect(send).toHaveBeenCalledTimes(4);

    send.mockRejectedValueOnce(
      new ApiRequestError(0, "network_error", "offline"),
    );
    send.mockResolvedValueOnce(undefined);

    await tracker.flush();
    expect(send).toHaveBeenCalledTimes(5);

    await vi.advanceTimersByTimeAsync(999);
    expect(send).toHaveBeenCalledTimes(5);
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(6);
  });
});

describe("participant code", () => {
  it("an event tracked when getParticipantCode returns null is not sent while the code is missing", async () => {
    const send = vi.fn<SendFn>().mockResolvedValue(undefined);
    const { tracker } = createTestTracker({
      send,
      getParticipantCode: () => null,
    });
    tracker.startSession();

    await tracker.flush();
    expect(send).not.toHaveBeenCalled();
    expect(tracker.getQueue()).toHaveLength(1);
  });

  it("once getParticipantCode returns a code, the next flush sends that event with the code filled in", async () => {
    let code: string | null = null;
    const send = vi.fn<SendFn>().mockResolvedValue(undefined);
    const { tracker } = createTestTracker({
      send,
      getParticipantCode: () => code,
    });
    tracker.startSession();
    await tracker.flush();
    expect(send).not.toHaveBeenCalled();

    code = "P042";
    await tracker.flush();

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "app_opened",
        participant_code: "P042",
      }),
      undefined,
    );
  });
});

describe("queue persistence", () => {
  it("events tracked with one tracker are sent by a new tracker created with the same storage", async () => {
    const storage = createMemoryStorage();
    const send = vi.fn<SendFn>().mockResolvedValue(undefined);
    const first = createTestTracker({ storage, send });
    first.tracker.startSession();
    first.tracker.track("demo_reset");

    const second = createTestTracker({ storage, send });
    await second.tracker.flush();

    expect(send.mock.calls.map(([event]) => event.event_name)).toEqual([
      "app_opened",
      "demo_reset",
    ]);
  });

  it("corrupt JSON in EVENTS_KEY loads as an empty queue without throwing", () => {
    const storage = createMemoryStorage();
    storage.setItem(EVENTS_KEY, "{not json");
    const { tracker } = createTestTracker({ storage });
    expect(() => tracker.getQueue()).not.toThrow();
    expect(tracker.getQueue()).toEqual([]);
  });

  it("enqueuing an event with an event_id already in the queue does not duplicate it", async () => {
    let call = 0;
    const generateId = () => {
      call += 1;
      return call <= 2 ? "evt-dup" : `evt-${call}`;
    };
    const send = vi.fn<SendFn>().mockResolvedValue(undefined);
    const { tracker } = createTestTracker({ send, generateId });
    tracker.startSession();
    tracker.track("demo_reset");
    tracker.track("topic_selected", { topic_id: "dna_replication" });

    expect(tracker.getQueue()).toHaveLength(2);
    await tracker.flush();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("resetDemo() leaves the queued events intact", () => {
    const storage = createMemoryStorage();
    const { tracker } = createTestTracker({ storage });
    tracker.startSession();
    tracker.track("demo_reset");
    const before = tracker.getQueue();

    resetDemo(storage);

    expect(tracker.getQueue()).toEqual(before);
    expect(storage.getItem(EVENTS_KEY)).not.toBeNull();
  });
});
