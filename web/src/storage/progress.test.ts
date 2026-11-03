import { describe, expect, it, beforeEach, vi } from "vitest";
import { attemptContinue, attemptReviewAgain } from "../fixtures/attempts";
import type { AttemptRequest, ProgressState, StoredStep } from "./progress";
import { EVENTS_KEY, PROGRESS_KEY } from "./keys";
import {
  getPendingAttempt,
  loadParticipantCode,
  loadProgress,
  recordAttemptRequest,
  recordAttemptResult,
  resetDemo,
  saveParticipantCode,
  saveProgress,
  saveRemediationState,
  setCurrentStep,
  setSelectedTopics,
} from "./progress";

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

function defaultProgressState(): ProgressState {
  return {
    version: 1,
    selected_topic_ids: [],
    remediation_states: {},
    attempts: {},
    current_step: null,
  };
}

describe("participant code", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("returns null when nothing is saved", () => {
    expect(loadParticipantCode(storage)).toBeNull();
  });

  it("round-trips a saved code", () => {
    saveParticipantCode("P-12345", storage);
    expect(loadParticipantCode(storage)).toBe("P-12345");
  });
});

describe("load and save progress", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("returns the default state when nothing is saved", () => {
    expect(loadProgress(storage)).toEqual(defaultProgressState());
  });

  it("saveProgress then loadProgress returns an equal state", () => {
    const state: ProgressState = {
      version: 1,
      selected_topic_ids: ["dna_replication"],
      remediation_states: {
        synthesis_direction_and_primer: attemptReviewAgain.remediation_state,
      },
      attempts: {},
      current_step: { screen: "topics" },
    };
    saveProgress(state, storage);
    expect(loadProgress(storage)).toEqual(state);
  });

  it("returns default state for corrupt JSON without throwing", () => {
    storage.setItem(PROGRESS_KEY, "{not valid json");
    expect(loadProgress(storage)).toEqual(defaultProgressState());
  });

  it("returns default state when version is 2", () => {
    storage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ ...defaultProgressState(), version: 2 }),
    );
    expect(loadProgress(storage)).toEqual(defaultProgressState());
  });
});

describe("selections and steps", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("setSelectedTopics persists and replaces the list", () => {
    setSelectedTopics(["dna_replication"], storage);
    expect(loadProgress(storage).selected_topic_ids).toEqual(["dna_replication"]);
    setSelectedTopics(["dna_repair", "dna_replication"], storage);
    expect(loadProgress(storage).selected_topic_ids).toEqual([
      "dna_repair",
      "dna_replication",
    ]);
  });

  it("setCurrentStep persists fields and null clears the step", () => {
    const step: StoredStep = {
      screen: "question",
      topic_id: "dna_replication",
      objective_id: "synthesis_direction_and_primer",
      question_id: "rep-q1",
    };
    setCurrentStep(step, storage);
    expect(loadProgress(storage).current_step).toEqual(step);
    setCurrentStep(null, storage);
    expect(loadProgress(storage).current_step).toBeNull();
  });
});

describe("remediation state is stored, never computed", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("saveRemediationState round-trips deeply equal", () => {
    saveRemediationState(
      "synthesis_direction_and_primer",
      attemptReviewAgain.remediation_state,
      storage,
    );
    expect(
      loadProgress(storage).remediation_states.synthesis_direction_and_primer,
    ).toEqual(attemptReviewAgain.remediation_state);
  });

  it("recordAttemptResult stores result and remediation_state from fixture unchanged", () => {
    const request: AttemptRequest = {
      attempt_id: attemptReviewAgain.attempt_id,
      question_id: attemptReviewAgain.question_id,
      selected_choice_id: "A",
      objective_id: "synthesis_direction_and_primer",
      remediation_state: attemptContinue.remediation_state,
    };
    recordAttemptRequest(request, storage);
    recordAttemptResult(attemptReviewAgain, storage);

    const progress = loadProgress(storage);
    expect(progress.attempts[attemptReviewAgain.attempt_id].result).toEqual(
      attemptReviewAgain,
    );
    expect(progress.remediation_states.synthesis_direction_and_primer).toEqual(
      attemptReviewAgain.remediation_state,
    );
  });
});

describe("attempts", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  const request: AttemptRequest = {
    attempt_id: "attempt-store-1",
    question_id: "rep-q2",
    selected_choice_id: "B",
    objective_id: "synthesis_direction_and_primer",
    remediation_state: attemptContinue.remediation_state,
  };

  it("recordAttemptRequest stores request with result null", () => {
    recordAttemptRequest(request, storage);
    expect(loadProgress(storage).attempts[request.attempt_id]).toEqual({
      request,
      result: null,
    });
  });

  it("getPendingAttempt returns pending attempt until result is recorded", () => {
    recordAttemptRequest(request, storage);
    expect(getPendingAttempt(storage)).toEqual({ request, result: null });
    recordAttemptResult(
      { ...attemptReviewAgain, attempt_id: request.attempt_id },
      storage,
    );
    expect(getPendingAttempt(storage)).toBeNull();
  });

  it("does not duplicate entries when recordAttemptRequest is called twice with same attempt_id", () => {
    recordAttemptRequest(request, storage);
    recordAttemptRequest(request, storage);
    expect(Object.keys(loadProgress(storage).attempts)).toEqual([request.attempt_id]);
  });

  it("recordAttemptResult for unknown attempt_id does not throw", () => {
    expect(() =>
      recordAttemptResult(
        { ...attemptReviewAgain, attempt_id: "missing-attempt" },
        storage,
      ),
    ).not.toThrow();
    expect(loadProgress(storage).attempts["missing-attempt"]).toBeUndefined();
  });
});

describe("resetDemo", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("clears progress only, keeps participant and events keys", () => {
    saveParticipantCode("P-999", storage);
    setSelectedTopics(["dna_replication"], storage);
    storage.setItem(EVENTS_KEY, JSON.stringify([{ event_id: "evt-1" }]));

    resetDemo(storage);

    expect(loadParticipantCode(storage)).toBe("P-999");
    expect(storage.getItem(EVENTS_KEY)).toBe(JSON.stringify([{ event_id: "evt-1" }]));
    expect(loadProgress(storage)).toEqual(defaultProgressState());
  });
});

describe("resilience", () => {
  it("does not throw when storage read/write fails", () => {
    const throwingStorage: Storage = {
      get length() {
        return 0;
      },
      clear() {
        throw new Error("blocked");
      },
      getItem() {
        throw new Error("blocked");
      },
      key() {
        throw new Error("blocked");
      },
      removeItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    };

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => loadParticipantCode(throwingStorage)).not.toThrow();
    expect(loadParticipantCode(throwingStorage)).toBeNull();

    expect(() => saveParticipantCode("P-1", throwingStorage)).not.toThrow();
    expect(() => loadProgress(throwingStorage)).not.toThrow();
    expect(loadProgress(throwingStorage)).toEqual(defaultProgressState());

    expect(() => saveProgress(defaultProgressState(), throwingStorage)).not.toThrow();
    expect(() => setSelectedTopics(["dna_repair"], throwingStorage)).not.toThrow();
    expect(() =>
      saveRemediationState("error_correction", attemptContinue.remediation_state, throwingStorage),
    ).not.toThrow();
    expect(() => recordAttemptRequest(requestFixture(), throwingStorage)).not.toThrow();
    expect(() => recordAttemptResult(attemptReviewAgain, throwingStorage)).not.toThrow();
    expect(() => getPendingAttempt(throwingStorage)).not.toThrow();
    expect(() => setCurrentStep({ screen: "home" }, throwingStorage)).not.toThrow();
    expect(() => resetDemo(throwingStorage)).not.toThrow();

    warn.mockRestore();
  });
});

describe("persistence across reloads", () => {
  it("returns saved data from a separate read after write", () => {
    const storage = createMemoryStorage();
    saveParticipantCode("P-RELOAD", storage);
    saveProgress(
      {
        version: 1,
        selected_topic_ids: ["dna_repair"],
        remediation_states: {},
        attempts: {},
        current_step: { screen: "home" },
      },
      storage,
    );

    expect(loadParticipantCode(storage)).toBe("P-RELOAD");
    expect(loadProgress(storage).selected_topic_ids).toEqual(["dna_repair"]);
    expect(loadProgress(storage).current_step).toEqual({ screen: "home" });
  });
});

function requestFixture(): AttemptRequest {
  return {
    attempt_id: "attempt-resilience",
    question_id: "rep-q1",
    selected_choice_id: "A",
    objective_id: "synthesis_direction_and_primer",
    remediation_state: attemptContinue.remediation_state,
  };
}
