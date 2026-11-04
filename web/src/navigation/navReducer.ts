import type { AttemptAction, AttemptResult, VideoRequest } from "../api/types";
import type {
  ProgressState,
  ScreenName,
  StoredStep,
} from "../storage/progress";

export type NavError =
  | "unknown_action"
  | "missing_next_question"
  | "missing_video_request";

export type NavState = {
  screen: ScreenName;
  token: number;
  topic_id?: string;
  objective_id?: string;
  question_id?: string;
  pending_question_id?: string;
  video_kind?: "initial" | "followup";
  video_request?: VideoRequest;
  video_job_id?: string;
  video_status?: "preparing" | "ready" | "failed";
  attempt_id?: string;
  submitting?: boolean;
  last_result?: AttemptResult;
  error?: NavError;
  initial_video_request?: VideoRequest;
  initial_first_question_id?: string;
};

export type NavAction =
  | { type: "PARTICIPANT_CODE_SAVED" }
  | { type: "TOPICS_CONFIRMED" }
  | {
      type: "OPEN_LESSON";
      topic_id: string;
      objective_id: string;
      video_request: VideoRequest;
      first_question_id: string;
    }
  | { type: "VIDEO_JOB_CREATED"; token: number; job_id: string }
  | { type: "VIDEO_READY"; token: number; job_id: string }
  | { type: "VIDEO_FAILED"; token: number; job_id: string }
  | { type: "RETRY_VIDEO" }
  | { type: "OPEN_QUESTION" }
  | { type: "ATTEMPT_SUBMITTED"; attempt_id: string }
  | { type: "ATTEMPT_FAILED"; token: number; attempt_id: string }
  | { type: "ATTEMPT_RESULT"; token: number; result: AttemptResult }
  | { type: "CONTINUE" }
  | { type: "GO_HOME" }
  | { type: "RESTART_OBJECTIVE" }
  | { type: "RESET_DEMO" };

const VALID_SCREENS: ReadonlySet<string> = new Set([
  "participant_code",
  "topics",
  "home",
  "lesson",
  "question",
  "feedback",
  "followup_preparing",
  "summary",
]);

export function initNavState(opts: {
  hasParticipantCode: boolean;
  hasSelectedTopics: boolean;
}): NavState {
  if (!opts.hasParticipantCode) {
    return { screen: "participant_code", token: 0 };
  }
  if (!opts.hasSelectedTopics) {
    return { screen: "topics", token: 0 };
  }
  return { screen: "home", token: 0 };
}

function tokenMatches(state: NavState, token: number): boolean {
  return state.token === token;
}

function isVideoScreen(screen: ScreenName): boolean {
  return screen === "lesson" || screen === "followup_preparing";
}

function routeFeedbackContinue(state: NavState): NavState {
  const result = state.last_result;
  if (!result) {
    return state;
  }

  const known: AttemptAction[] = [
    "continue_questions",
    "review_again",
    "complete",
    "needs_review",
  ];
  if (!known.includes(result.action)) {
    return { ...state, error: "unknown_action" };
  }

  switch (result.action) {
    case "continue_questions": {
      if (result.next_question_id === null) {
        return { ...state, error: "missing_next_question" };
      }
      return {
        ...state,
        screen: "question",
        question_id: result.next_question_id,
        attempt_id: undefined,
        submitting: false,
        error: undefined,
      };
    }
    case "review_again": {
      if (result.next_video_request === null) {
        return { ...state, error: "missing_video_request" };
      }
      return {
        ...state,
        screen: "followup_preparing",
        token: state.token + 1,
        video_request: result.next_video_request,
        video_status: "preparing",
        video_job_id: undefined,
        pending_question_id: result.next_question_id ?? undefined,
        attempt_id: undefined,
        submitting: false,
        error: undefined,
        video_kind: undefined,
      };
    }
    case "complete":
    case "needs_review":
      return {
        ...state,
        screen: "summary",
        submitting: false,
        error: undefined,
      };
    default:
      return { ...state, error: "unknown_action" };
  }
}

export function navReducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case "PARTICIPANT_CODE_SAVED":
      if (state.screen !== "participant_code") {
        return state;
      }
      return { screen: "topics", token: state.token };

    case "TOPICS_CONFIRMED":
      if (state.screen !== "topics") {
        return state;
      }
      return { screen: "home", token: state.token };

    case "OPEN_LESSON":
      if (state.screen !== "home") {
        return state;
      }
      return {
        screen: "lesson",
        token: state.token + 1,
        topic_id: action.topic_id,
        objective_id: action.objective_id,
        video_request: action.video_request,
        video_kind: "initial",
        video_status: "preparing",
        pending_question_id: action.first_question_id,
        initial_video_request: action.video_request,
        initial_first_question_id: action.first_question_id,
        video_job_id: undefined,
        attempt_id: undefined,
        submitting: false,
        last_result: undefined,
        error: undefined,
        question_id: undefined,
      };

    case "VIDEO_JOB_CREATED":
      if (!isVideoScreen(state.screen) || !tokenMatches(state, action.token)) {
        return state;
      }
      return { ...state, video_job_id: action.job_id };

    case "VIDEO_READY":
      if (!tokenMatches(state, action.token)) {
        return state;
      }
      if (state.screen === "followup_preparing") {
        return {
          ...state,
          screen: "lesson",
          video_kind: "followup",
          video_status: "ready",
          video_job_id: action.job_id,
        };
      }
      if (state.screen === "lesson") {
        return { ...state, video_status: "ready", video_job_id: action.job_id };
      }
      return state;

    case "VIDEO_FAILED":
      if (!isVideoScreen(state.screen) || !tokenMatches(state, action.token)) {
        return state;
      }
      return { ...state, video_status: "failed", video_job_id: action.job_id };

    case "RETRY_VIDEO":
      if (
        !isVideoScreen(state.screen) ||
        state.video_status !== "failed"
      ) {
        return state;
      }
      return {
        ...state,
        token: state.token + 1,
        video_status: "preparing",
        video_job_id: undefined,
      };

    case "OPEN_QUESTION":
      if (
        state.screen !== "lesson" ||
        state.video_status !== "ready" ||
        state.pending_question_id === undefined
      ) {
        return state;
      }
      return {
        ...state,
        screen: "question",
        question_id: state.pending_question_id,
        pending_question_id: undefined,
        attempt_id: undefined,
        submitting: false,
        error: undefined,
      };

    case "ATTEMPT_SUBMITTED":
      if (state.screen !== "question" || state.submitting) {
        return state;
      }
      return {
        ...state,
        submitting: true,
        attempt_id: action.attempt_id,
      };

    case "ATTEMPT_FAILED":
      if (
        state.screen !== "question" ||
        !tokenMatches(state, action.token) ||
        state.attempt_id !== action.attempt_id
      ) {
        return state;
      }
      return {
        ...state,
        submitting: false,
      };

    case "ATTEMPT_RESULT":
      if (
        state.screen !== "question" ||
        !tokenMatches(state, action.token) ||
        state.attempt_id !== action.result.attempt_id
      ) {
        return state;
      }
      return {
        ...state,
        screen: "feedback",
        last_result: action.result,
        submitting: false,
        error: undefined,
      };

    case "CONTINUE":
      if (state.screen !== "feedback") {
        return state;
      }
      return routeFeedbackContinue(state);

    case "GO_HOME":
      if (state.screen === "participant_code" || state.screen === "topics") {
        return state;
      }
      return {
        screen: "home",
        token: state.token + 1,
      };

    case "RESTART_OBJECTIVE":
      if (state.screen !== "summary") {
        return state;
      }
      if (
        !state.initial_video_request ||
        !state.initial_first_question_id ||
        !state.topic_id ||
        !state.objective_id
      ) {
        return state;
      }
      return {
        screen: "lesson",
        token: state.token + 1,
        topic_id: state.topic_id,
        objective_id: state.objective_id,
        video_kind: "initial",
        video_status: "preparing",
        video_request: state.initial_video_request,
        pending_question_id: state.initial_first_question_id,
        initial_video_request: state.initial_video_request,
        initial_first_question_id: state.initial_first_question_id,
        video_job_id: undefined,
        attempt_id: undefined,
        submitting: false,
        last_result: undefined,
        error: undefined,
        question_id: undefined,
      };

    case "RESET_DEMO":
      return {
        screen: "topics",
        token: state.token + 1,
      };

    default:
      return state;
  }
}

export function toStoredStep(state: NavState): StoredStep {
  const step: StoredStep = {
    screen: state.screen,
  };
  if (state.topic_id !== undefined) {
    step.topic_id = state.topic_id;
  }
  if (state.objective_id !== undefined) {
    step.objective_id = state.objective_id;
  }
  if (state.question_id !== undefined) {
    step.question_id = state.question_id;
  }
  if (state.pending_question_id !== undefined) {
    step.pending_question_id = state.pending_question_id;
  }
  if (state.video_kind !== undefined) {
    step.video_kind = state.video_kind;
  }
  if (state.video_job_id !== undefined) {
    step.video_job_id = state.video_job_id;
  }
  if (state.video_request !== undefined) {
    step.video_request = state.video_request;
  }
  if (state.attempt_id !== undefined) {
    step.attempt_id = state.attempt_id;
  }
  if (state.initial_video_request !== undefined) {
    step.initial_video_request = state.initial_video_request;
  }
  if (state.initial_first_question_id !== undefined) {
    step.initial_first_question_id = state.initial_first_question_id;
  }
  return step;
}

function storedStepLessonFields(step: StoredStep): Partial<NavState> {
  const fields: Partial<NavState> = {};
  if (step.pending_question_id !== undefined) {
    fields.pending_question_id = step.pending_question_id;
  }
  if (step.video_kind !== undefined) {
    fields.video_kind = step.video_kind;
  }
  if (step.initial_video_request !== undefined) {
    fields.initial_video_request = step.initial_video_request;
  }
  if (step.initial_first_question_id !== undefined) {
    fields.initial_first_question_id = step.initial_first_question_id;
  }
  return fields;
}

function baseRestore(progress: ProgressState, hasParticipantCode: boolean): NavState | null {
  if (!hasParticipantCode) {
    return { screen: "participant_code", token: 0 };
  }
  if (progress.selected_topic_ids.length === 0) {
    return { screen: "topics", token: 0 };
  }
  if (!progress.current_step) {
    return { screen: "home", token: 0 };
  }
  return null;
}

export function restoreNavState(
  progress: ProgressState,
  opts: { hasParticipantCode: boolean },
): NavState {
  const base = baseRestore(progress, opts.hasParticipantCode);
  if (base) {
    return base;
  }

  const step = progress.current_step!;
  if (!VALID_SCREENS.has(step.screen)) {
    return { screen: "home", token: 0 };
  }

  const common: NavState = {
    screen: step.screen,
    token: 0,
    topic_id: step.topic_id,
    objective_id: step.objective_id,
    question_id: step.question_id,
    video_job_id: step.video_job_id,
    video_request: step.video_request,
    attempt_id: step.attempt_id,
    submitting: false,
    ...storedStepLessonFields(step),
  };

  switch (step.screen) {
    case "feedback": {
      if (!step.attempt_id) {
        return { screen: "home", token: 0 };
      }
      const stored = progress.attempts[step.attempt_id];
      if (stored?.result) {
        return {
          ...common,
          last_result: stored.result,
        };
      }
      return {
        ...common,
        screen: "question",
        question_id: step.question_id ?? stored?.request.question_id,
        attempt_id: step.attempt_id,
        submitting: false,
      };
    }
    case "followup_preparing": {
      let pending = step.pending_question_id;
      if (pending === undefined && step.attempt_id) {
        const stored = progress.attempts[step.attempt_id];
        pending = stored?.result?.next_question_id ?? undefined;
      }
      if (pending === undefined && step.video_request === undefined) {
        return { screen: "home", token: 0 };
      }
      return {
        ...common,
        video_status: "preparing",
        pending_question_id: pending,
      };
    }
    case "lesson":
      return {
        ...common,
        video_status: "preparing",
        pending_question_id:
          step.pending_question_id ?? step.question_id ?? undefined,
      };
    case "question":
      return {
        ...common,
        attempt_id: step.attempt_id,
      };
    case "summary": {
      if (!step.attempt_id) {
        return { screen: "home", token: 0 };
      }
      const stored = progress.attempts[step.attempt_id];
      if (stored?.result) {
        return {
          ...common,
          last_result: stored.result,
        };
      }
      return { screen: "home", token: 0 };
    }
    case "participant_code":
    case "topics":
    case "home":
      return { screen: step.screen, token: 0 };
    default:
      return { screen: "home", token: 0 };
  }
}
