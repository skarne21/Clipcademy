export type {
  AttemptRequest,
  AttemptResult,
  RemediationState,
  VideoRequest,
} from "../api/types";
import type {
  AttemptRequest,
  AttemptResult,
  RemediationState,
  VideoRequest,
} from "../api/types";
import { PARTICIPANT_KEY, PROGRESS_KEY } from "./keys";

export type ScreenName =
  | "participant_code"
  | "topics"
  | "home"
  | "lesson"
  | "question"
  | "feedback"
  | "followup_preparing"
  | "summary";

export type StoredStep = {
  screen: ScreenName;
  topic_id?: string;
  objective_id?: string;
  question_id?: string;
  pending_question_id?: string;
  video_kind?: "initial" | "followup";
  video_job_id?: string;
  video_request?: VideoRequest;
  attempt_id?: string;
  initial_video_request?: VideoRequest;
  initial_first_question_id?: string;
};

export type StoredAttempt = {
  request: AttemptRequest;
  result: AttemptResult | null;
};

export type ProgressState = {
  version: 1;
  selected_topic_ids: string[];
  remediation_states: Record<string, RemediationState>;
  attempts: Record<string, StoredAttempt>;
  current_step: StoredStep | null;
};

function resolveStorage(storage?: Storage): Storage | null {
  if (storage) {
    return storage;
  }
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

function warnStorage(operation: string, error: unknown): void {
  console.warn(`[clipcademy storage] ${operation} failed`, error);
}

function safeGetItem(key: string, storage?: Storage): string | null {
  const target = resolveStorage(storage);
  if (!target) {
    return null;
  }
  try {
    return target.getItem(key);
  } catch (error) {
    warnStorage(`read ${key}`, error);
    return null;
  }
}

function safeSetItem(key: string, value: string, storage?: Storage): void {
  const target = resolveStorage(storage);
  if (!target) {
    return;
  }
  try {
    target.setItem(key, value);
  } catch (error) {
    warnStorage(`write ${key}`, error);
  }
}

function safeRemoveItem(key: string, storage?: Storage): void {
  const target = resolveStorage(storage);
  if (!target) {
    return;
  }
  try {
    target.removeItem(key);
  } catch (error) {
    warnStorage(`remove ${key}`, error);
  }
}

export function createDefaultProgressState(): ProgressState {
  return {
    version: 1,
    selected_topic_ids: [],
    remediation_states: {},
    attempts: {},
    current_step: null,
  };
}

function isProgressState(value: unknown): value is ProgressState {
  if (!value || typeof value !== "object") {
    return false;
  }
  const state = value as ProgressState;
  return (
    state.version === 1 &&
    Array.isArray(state.selected_topic_ids) &&
    typeof state.remediation_states === "object" &&
    state.remediation_states !== null &&
    typeof state.attempts === "object" &&
    state.attempts !== null &&
    (state.current_step === null || typeof state.current_step === "object")
  );
}

export function loadParticipantCode(storage?: Storage): string | null {
  return safeGetItem(PARTICIPANT_KEY, storage);
}

export function saveParticipantCode(code: string, storage?: Storage): void {
  safeSetItem(PARTICIPANT_KEY, code, storage);
}

export function loadProgress(storage?: Storage): ProgressState {
  const raw = safeGetItem(PROGRESS_KEY, storage);
  if (!raw) {
    return createDefaultProgressState();
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isProgressState(parsed)) {
      return createDefaultProgressState();
    }
    return parsed;
  } catch (error) {
    warnStorage(`parse ${PROGRESS_KEY}`, error);
    return createDefaultProgressState();
  }
}

export function saveProgress(state: ProgressState, storage?: Storage): void {
  safeSetItem(PROGRESS_KEY, JSON.stringify(state), storage);
}

function updateProgress(
  updater: (state: ProgressState) => ProgressState,
  storage?: Storage,
): void {
  const next = updater(loadProgress(storage));
  saveProgress(next, storage);
}

export function setSelectedTopics(topicIds: string[], storage?: Storage): void {
  updateProgress(
    (state) => ({
      ...state,
      selected_topic_ids: [...topicIds],
    }),
    storage,
  );
}

export function saveRemediationState(
  objectiveId: string,
  remediationState: RemediationState,
  storage?: Storage,
): void {
  updateProgress(
    (state) => ({
      ...state,
      remediation_states: {
        ...state.remediation_states,
        [objectiveId]: remediationState,
      },
    }),
    storage,
  );
}

export function recordAttemptRequest(request: AttemptRequest, storage?: Storage): void {
  updateProgress(
    (state) => ({
      ...state,
      attempts: {
        ...state.attempts,
        [request.attempt_id]: {
          request,
          result: null,
        },
      },
    }),
    storage,
  );
}

export function recordAttemptResult(result: AttemptResult, storage?: Storage): void {
  updateProgress(
    (state) => {
      const existing = state.attempts[result.attempt_id];
      if (!existing) {
        return state;
      }

      const objectiveId = existing.request.objective_id;
      return {
        ...state,
        attempts: {
          ...state.attempts,
          [result.attempt_id]: {
            ...existing,
            result,
          },
        },
        remediation_states: {
          ...state.remediation_states,
          [objectiveId]: result.remediation_state,
        },
      };
    },
    storage,
  );
}

export function getPendingAttempt(storage?: Storage): StoredAttempt | null {
  const state = loadProgress(storage);
  for (const attempt of Object.values(state.attempts)) {
    if (attempt.result === null) {
      return attempt;
    }
  }
  return null;
}

export function setCurrentStep(step: StoredStep | null, storage?: Storage): void {
  updateProgress(
    (state) => ({
      ...state,
      current_step: step,
    }),
    storage,
  );
}

export function resetDemo(storage?: Storage): void {
  safeRemoveItem(PROGRESS_KEY, storage);
}
