import { describe, expect, it } from "vitest";
import type { AttemptResult, VideoRequest } from "../api/types";
import {
  attemptComplete,
  attemptContinue,
  attemptNeedsReview,
  attemptReviewAgain,
} from "../fixtures/attempts";
import type { ProgressState } from "../storage/progress";
import {
  initNavState,
  navReducer,
  restoreNavState,
  toStoredStep,
  type NavAction,
  type NavState,
} from "./navReducer";

const initialVideoRequest: VideoRequest = {
  topic_id: "dna_replication",
  objective_id: "synthesis_direction_and_primer",
  variant_id: "initial_lesson",
  teaching_goal: "Introduction to DNA replication",
  source_refs: ["L19-p1", "L19-p2", "L19-p3"],
};

function defaultProgress(overrides: Partial<ProgressState> = {}): ProgressState {
  return {
    version: 1,
    selected_topic_ids: ["dna_replication"],
    remediation_states: {},
    attempts: {},
    current_step: null,
    ...overrides,
  };
}

function openLessonState(overrides: Partial<NavState> = {}): NavState {
  let state = initNavState({
    hasParticipantCode: true,
    hasSelectedTopics: true,
  });
  state = navReducer(state, {
    type: "OPEN_LESSON",
    topic_id: "dna_replication",
    objective_id: "synthesis_direction_and_primer",
    video_request: initialVideoRequest,
    first_question_id: "rep-q1",
  });
  return { ...state, ...overrides };
}

function lessonReadyState(): NavState {
  const preparing = openLessonState();
  const token = preparing.token;
  let state = navReducer(preparing, {
    type: "VIDEO_JOB_CREATED",
    token,
    job_id: "video-001",
  });
  state = navReducer(state, {
    type: "VIDEO_READY",
    token,
    job_id: "video-001",
  });
  return state;
}

function questionAfterLessonState(): NavState {
  const lesson = lessonReadyState();
  return navReducer(lesson, { type: "OPEN_QUESTION" });
}

function feedbackState(result: AttemptResult = attemptContinue): NavState {
  let state = questionAfterLessonState();
  const token = state.token;
  const attempt_id = "attempt-test-001";
  state = navReducer(state, {
    type: "ATTEMPT_SUBMITTED",
    attempt_id,
  });
  return navReducer(state, {
    type: "ATTEMPT_RESULT",
    token,
    result: { ...result, attempt_id },
  });
}

describe("initNavState", () => {
  it("returns participant_code when there is no participant code", () => {
    expect(
      initNavState({ hasParticipantCode: false, hasSelectedTopics: false }),
    ).toEqual({
      screen: "participant_code",
      token: 0,
    });
  });

  it("returns topics when there is a code but no selected topics", () => {
    expect(
      initNavState({ hasParticipantCode: true, hasSelectedTopics: false }),
    ).toEqual({
      screen: "topics",
      token: 0,
    });
  });

  it("returns home when there is a code and selected topics", () => {
    expect(
      initNavState({ hasParticipantCode: true, hasSelectedTopics: true }),
    ).toEqual({
      screen: "home",
      token: 0,
    });
  });
});

describe("happy path", () => {
  it("participant_code -> topics -> home -> lesson preparing -> video ready -> question -> feedback", () => {
    let state = initNavState({
      hasParticipantCode: false,
      hasSelectedTopics: false,
    });
    expect(state.screen).toBe("participant_code");

    state = navReducer(state, { type: "PARTICIPANT_CODE_SAVED" });
    expect(state.screen).toBe("topics");

    state = navReducer(state, { type: "TOPICS_CONFIRMED" });
    expect(state.screen).toBe("home");

    const homeToken = state.token;
    state = navReducer(state, {
      type: "OPEN_LESSON",
      topic_id: "dna_replication",
      objective_id: "synthesis_direction_and_primer",
      video_request: initialVideoRequest,
      first_question_id: "rep-q1",
    });
    expect(state.screen).toBe("lesson");
    expect(state.video_kind).toBe("initial");
    expect(state.video_status).toBe("preparing");
    expect(state.pending_question_id).toBe("rep-q1");
    expect(state.token).toBe(homeToken + 1);

    const lessonToken = state.token;
    state = navReducer(state, {
      type: "VIDEO_JOB_CREATED",
      token: lessonToken,
      job_id: "video-001",
    });
    expect(state.video_job_id).toBe("video-001");

    state = navReducer(state, {
      type: "VIDEO_READY",
      token: lessonToken,
      job_id: "video-001",
    });
    expect(state.video_status).toBe("ready");

    state = navReducer(state, { type: "OPEN_QUESTION" });
    expect(state.screen).toBe("question");
    expect(state.question_id).toBe("rep-q1");
    expect(state.pending_question_id).toBeUndefined();

    const questionToken = state.token;
    state = navReducer(state, {
      type: "ATTEMPT_SUBMITTED",
      attempt_id: "attempt-happy-1",
    });
    expect(state.submitting).toBe(true);

    state = navReducer(state, {
      type: "ATTEMPT_RESULT",
      token: questionToken,
      result: { ...attemptContinue, attempt_id: "attempt-happy-1" },
    });
    expect(state.screen).toBe("feedback");
    expect(state.last_result?.action).toBe("continue_questions");
    expect(state.submitting).toBe(false);
  });
});

describe("routing on action only", () => {
  it("continue_questions goes to next_question_id", () => {
    const state = feedbackState(attemptContinue);
    const next = navReducer(state, { type: "CONTINUE" });
    expect(next.screen).toBe("question");
    expect(next.question_id).toBe("rep-q2");
    expect(next.attempt_id).toBeUndefined();
  });

  it("review_again goes to followup_preparing; VIDEO_READY -> lesson followup; OPEN_QUESTION shows rep-r2", () => {
    const fb = feedbackState(attemptReviewAgain);
    let state = navReducer(fb, { type: "CONTINUE" });
    expect(state.screen).toBe("followup_preparing");
    expect(state.video_status).toBe("preparing");
    expect(state.pending_question_id).toBe("rep-r2");
    expect(state.video_request).toEqual(attemptReviewAgain.next_video_request);

    const prepToken = state.token;
    state = navReducer(state, {
      type: "VIDEO_JOB_CREATED",
      token: prepToken,
      job_id: "video-002",
    });
    state = navReducer(state, {
      type: "VIDEO_READY",
      token: prepToken,
      job_id: "video-002",
    });
    expect(state.screen).toBe("lesson");
    expect(state.video_kind).toBe("followup");
    expect(state.video_status).toBe("ready");

    state = navReducer(state, { type: "OPEN_QUESTION" });
    expect(state.screen).toBe("question");
    expect(state.question_id).toBe("rep-r2");
    expect(state.attempt_id).toBeUndefined();
  });

  it("clears attempt_id after continue_questions", () => {
    const next = navReducer(feedbackState(attemptContinue), { type: "CONTINUE" });
    expect(next.screen).toBe("question");
    expect(next.attempt_id).toBeUndefined();
  });

  it("complete goes to summary", () => {
    const state = feedbackState(attemptComplete);
    const next = navReducer(state, { type: "CONTINUE" });
    expect(next.screen).toBe("summary");
  });

  it("needs_review goes to summary", () => {
    const state = feedbackState(attemptNeedsReview);
    const next = navReducer(state, { type: "CONTINUE" });
    expect(next.screen).toBe("summary");
  });

  it("correct false with action continue_questions still goes to next question", () => {
    const wrongButContinue: AttemptResult = {
      ...attemptContinue,
      correct: false,
    };
    const state = feedbackState(wrongButContinue);
    const next = navReducer(state, { type: "CONTINUE" });
    expect(next.screen).toBe("question");
    expect(next.question_id).toBe("rep-q2");
  });

  it("correct true with action review_again still goes to followup_preparing", () => {
    const rightButReview: AttemptResult = {
      ...attemptReviewAgain,
      correct: true,
    };
    const state = feedbackState(rightButReview);
    const next = navReducer(state, { type: "CONTINUE" });
    expect(next.screen).toBe("followup_preparing");
  });

  it("unknown action stays on feedback with error unknown_action", () => {
    const badAction = {
      ...attemptContinue,
      action: "skip_ahead" as AttemptResult["action"],
    };
    const state = feedbackState(badAction);
    const next = navReducer(state, { type: "CONTINUE" });
    expect(next.screen).toBe("feedback");
    expect(next.error).toBe("unknown_action");
  });

  it("continue_questions with null next_question_id sets missing_next_question", () => {
    const noNext: AttemptResult = {
      ...attemptContinue,
      next_question_id: null,
    };
    const state = feedbackState(noNext);
    const next = navReducer(state, { type: "CONTINUE" });
    expect(next.screen).toBe("feedback");
    expect(next.error).toBe("missing_next_question");
  });

  it("review_again with null next_video_request sets missing_video_request", () => {
    const noVideo: AttemptResult = {
      ...attemptReviewAgain,
      next_video_request: null,
    };
    const state = feedbackState(noVideo);
    const next = navReducer(state, { type: "CONTINUE" });
    expect(next.screen).toBe("feedback");
    expect(next.error).toBe("missing_video_request");
  });
});

describe("submissions", () => {
  it("ignores a second ATTEMPT_SUBMITTED while submitting", () => {
    const state = questionAfterLessonState();
    const once = navReducer(state, {
      type: "ATTEMPT_SUBMITTED",
      attempt_id: "attempt-a",
    });
    const twice = navReducer(once, {
      type: "ATTEMPT_SUBMITTED",
      attempt_id: "attempt-b",
    });
    expect(twice).toBe(once);
    expect(twice.attempt_id).toBe("attempt-a");
  });

  it("ATTEMPT_FAILED keeps attempt_id and clears submitting", () => {
    let state = questionAfterLessonState();
    const token = state.token;
    state = navReducer(state, {
      type: "ATTEMPT_SUBMITTED",
      attempt_id: "attempt-retry",
    });
    state = navReducer(state, {
      type: "ATTEMPT_FAILED",
      token,
      attempt_id: "attempt-retry",
    });
    expect(state.submitting).toBe(false);
    expect(state.attempt_id).toBe("attempt-retry");
  });

  it("ignores ATTEMPT_RESULT with a different attempt_id", () => {
    let state = questionAfterLessonState();
    const token = state.token;
    state = navReducer(state, {
      type: "ATTEMPT_SUBMITTED",
      attempt_id: "attempt-live",
    });
    const next = navReducer(state, {
      type: "ATTEMPT_RESULT",
      token,
      result: { ...attemptContinue, attempt_id: "attempt-other" },
    });
    expect(next).toBe(state);
    expect(next.screen).toBe("question");
  });
});

describe("late responses", () => {
  it("ignores VIDEO_JOB_CREATED, VIDEO_READY, VIDEO_FAILED with an old token", () => {
    const preparing = openLessonState();
    const token = preparing.token;
    expect(
      navReducer(preparing, {
        type: "VIDEO_JOB_CREATED",
        token: token - 1,
        job_id: "video-old",
      }),
    ).toBe(preparing);
    expect(
      navReducer(preparing, {
        type: "VIDEO_READY",
        token: token - 1,
        job_id: "video-old",
      }),
    ).toBe(preparing);
    expect(
      navReducer(preparing, {
        type: "VIDEO_FAILED",
        token: token - 1,
        job_id: "video-old",
      }),
    ).toBe(preparing);
  });

  it("ignores ATTEMPT_RESULT and ATTEMPT_FAILED with an old token", () => {
    let state = questionAfterLessonState();
    const token = state.token;
    state = navReducer(state, {
      type: "ATTEMPT_SUBMITTED",
      attempt_id: "attempt-x",
    });
    expect(
      navReducer(state, {
        type: "ATTEMPT_RESULT",
        token: token - 1,
        result: { ...attemptContinue, attempt_id: "attempt-x" },
      }),
    ).toBe(state);
    expect(
      navReducer(state, {
        type: "ATTEMPT_FAILED",
        token: token - 1,
        attempt_id: "attempt-x",
      }),
    ).toBe(state);
  });

  it("after GO_HOME, VIDEO_READY for the previous lesson token is ignored", () => {
    const preparing = openLessonState();
    const lessonToken = preparing.token;
    const home = navReducer(preparing, { type: "GO_HOME" });
    expect(home.screen).toBe("home");
    expect(
      navReducer(home, {
        type: "VIDEO_READY",
        token: lessonToken,
        job_id: "video-001",
      }),
    ).toBe(home);
  });

  it("after RETRY_VIDEO, VIDEO_FAILED from the earlier job token is ignored", () => {
    let state = openLessonState();
    const firstToken = state.token;
    state = navReducer(state, {
      type: "VIDEO_JOB_CREATED",
      token: firstToken,
      job_id: "video-001",
    });
    state = navReducer(state, {
      type: "VIDEO_FAILED",
      token: firstToken,
      job_id: "video-001",
    });
    expect(state.video_status).toBe("failed");
    const failedToken = state.token;
    state = navReducer(state, { type: "RETRY_VIDEO" });
    expect(state.token).toBe(failedToken + 1);
    expect(
      navReducer(state, {
        type: "VIDEO_FAILED",
        token: firstToken,
        job_id: "video-001",
      }),
    ).toBe(state);
  });

  it("after OPEN_LESSON for a second topic, ATTEMPT_RESULT from the first topic is ignored", () => {
    let first = questionAfterLessonState();
    const firstToken = first.token;
    first = navReducer(first, {
      type: "ATTEMPT_SUBMITTED",
      attempt_id: "attempt-first",
    });

    let home = navReducer(first, { type: "GO_HOME" });
    home = navReducer(home, {
      type: "OPEN_LESSON",
      topic_id: "dna_repair",
      objective_id: "error_correction",
      video_request: {
        ...initialVideoRequest,
        topic_id: "dna_repair",
        objective_id: "error_correction",
        variant_id: "repair_intro",
      },
      first_question_id: "repair-q1",
    });
    expect(home.screen).toBe("lesson");

    expect(
      navReducer(home, {
        type: "ATTEMPT_RESULT",
        token: firstToken,
        result: { ...attemptContinue, attempt_id: "attempt-first" },
      }),
    ).toBe(home);
  });
});

describe("video failure", () => {
  it("VIDEO_FAILED sets failed; RETRY_VIDEO sets preparing, clears job_id, keeps last_result and pending_question_id", () => {
    let state = openLessonState();
    const token = state.token;
    state = navReducer(state, {
      type: "VIDEO_JOB_CREATED",
      token,
      job_id: "video-001",
    });
    state = navReducer(state, {
      type: "VIDEO_FAILED",
      token,
      job_id: "video-001",
    });
    expect(state.video_status).toBe("failed");

    const withContext = {
      ...state,
      last_result: attemptReviewAgain,
      pending_question_id: "rep-r2",
    };
    const retry = navReducer(withContext, { type: "RETRY_VIDEO" });
    expect(retry.video_status).toBe("preparing");
    expect(retry.video_job_id).toBeUndefined();
    expect(retry.last_result).toEqual(attemptReviewAgain);
    expect(retry.pending_question_id).toBe("rep-r2");
  });

  it("from followup_preparing with video_status failed, RETRY_VIDEO sets preparing, clears job_id, keeps video_request and pending_question_id, and increments token", () => {
    let state = navReducer(feedbackState(attemptReviewAgain), { type: "CONTINUE" });
    const token = state.token;
    const videoRequest = state.video_request;
    const pendingQuestionId = state.pending_question_id;

    state = navReducer(state, {
      type: "VIDEO_JOB_CREATED",
      token,
      job_id: "followup-fail-1",
    });
    state = navReducer(state, {
      type: "VIDEO_FAILED",
      token,
      job_id: "followup-fail-1",
    });
    expect(state.screen).toBe("followup_preparing");
    expect(state.video_status).toBe("failed");

    const retry = navReducer(state, { type: "RETRY_VIDEO" });
    expect(retry.screen).toBe("followup_preparing");
    expect(retry.video_status).toBe("preparing");
    expect(retry.video_job_id).toBeUndefined();
    expect(retry.video_request).toEqual(videoRequest);
    expect(retry.pending_question_id).toBe(pendingQuestionId);
    expect(retry.token).toBe(token + 1);
  });

  it("ignores RETRY_VIDEO when not failed", () => {
    const ready = lessonReadyState();
    expect(navReducer(ready, { type: "RETRY_VIDEO" })).toBe(ready);
  });

  it("ignores OPEN_QUESTION while preparing or failed", () => {
    const preparing = openLessonState();
    expect(navReducer(preparing, { type: "OPEN_QUESTION" })).toBe(preparing);

    let failed = openLessonState();
    const token = failed.token;
    failed = navReducer(failed, {
      type: "VIDEO_FAILED",
      token,
      job_id: "video-x",
    });
    expect(navReducer(failed, { type: "OPEN_QUESTION" })).toBe(failed);
  });
});

describe("navigation", () => {
  it("GO_HOME clears lesson fields, increments token, ignored on participant_code and topics", () => {
    let lesson = openLessonState();
    const beforeToken = lesson.token;
    const home = navReducer(lesson, { type: "GO_HOME" });
    expect(home.screen).toBe("home");
    expect(home.token).toBe(beforeToken + 1);
    expect(home.topic_id).toBeUndefined();
    expect(home.video_request).toBeUndefined();

    const participant = initNavState({
      hasParticipantCode: false,
      hasSelectedTopics: false,
    });
    expect(navReducer(participant, { type: "GO_HOME" })).toBe(participant);

    const topics = initNavState({
      hasParticipantCode: true,
      hasSelectedTopics: false,
    });
    expect(navReducer(topics, { type: "GO_HOME" })).toBe(topics);
  });

  it("RESTART_OBJECTIVE from summary returns initial lesson for the same objective", () => {
    let state = feedbackState(attemptComplete);
    state = navReducer(state, { type: "CONTINUE" });
    expect(state.screen).toBe("summary");

    const restarted = navReducer(state, { type: "RESTART_OBJECTIVE" });
    expect(restarted.screen).toBe("lesson");
    expect(restarted.topic_id).toBe("dna_replication");
    expect(restarted.objective_id).toBe("synthesis_direction_and_primer");
    expect(restarted.video_kind).toBe("initial");
    expect(restarted.video_status).toBe("preparing");
    expect(restarted.video_request).toEqual(initialVideoRequest);
    expect(restarted.pending_question_id).toBe("rep-q1");
  });

  it("RESET_DEMO from several screens goes to topics with lesson fields cleared", () => {
    const screens: NavState[] = [
      openLessonState(),
      questionAfterLessonState(),
      feedbackState(),
    ];
    for (const start of screens) {
      const next = navReducer(start, { type: "RESET_DEMO" });
      expect(next.screen).toBe("topics");
      expect(next.topic_id).toBeUndefined();
      expect(next.video_request).toBeUndefined();
      expect(next.last_result).toBeUndefined();
    }
  });

  it("invalid actions return the same state object", () => {
    const home = initNavState({
      hasParticipantCode: true,
      hasSelectedTopics: true,
    });
    const invalid = { type: "NOT_AN_ACTION" } as unknown as NavAction;
    expect(navReducer(home, invalid)).toBe(home);
  });
});

describe("persistence", () => {
  it("round-trips question, lesson, summary, feedback, and followup_preparing via toStoredStep and restoreNavState", () => {
    const cases: NavState[] = [
      questionAfterLessonState(),
      openLessonState(),
      (() => {
        const fb = feedbackState(attemptComplete);
        return navReducer(fb, { type: "CONTINUE" });
      })(),
      feedbackState(),
      (() => {
        const fb = feedbackState(attemptReviewAgain);
        return navReducer(fb, { type: "CONTINUE" });
      })(),
    ];

    for (const nav of cases) {
      const step = toStoredStep(nav);
      const progress = defaultProgress({
        current_step: step,
        attempts: nav.attempt_id
          ? {
              [nav.attempt_id]: {
                request: {
                  attempt_id: nav.attempt_id,
                  question_id: nav.question_id ?? "rep-q1",
                  selected_choice_id: "A",
                  objective_id: nav.objective_id ?? "synthesis_direction_and_primer",
                  remediation_state: attemptContinue.remediation_state,
                },
                result: nav.last_result ?? null,
              },
            }
          : {},
      });
      const restored = restoreNavState(progress, { hasParticipantCode: true });
      expect(restored.screen).toBe(nav.screen);
      expect(restored.submitting).toBe(false);
    }
  });

  it("feedback with no stored result restores to question with same attempt_id", () => {
    const fb = feedbackState(attemptContinue);
    const step = toStoredStep(fb);
    const progress = defaultProgress({
      current_step: step,
      attempts: {
        [fb.attempt_id!]: {
          request: {
            attempt_id: fb.attempt_id!,
            question_id: "rep-q1",
            selected_choice_id: "A",
            objective_id: "synthesis_direction_and_primer",
            remediation_state: attemptContinue.remediation_state,
          },
          result: null,
        },
      },
    });
    const restored = restoreNavState(progress, { hasParticipantCode: true });
    expect(restored.screen).toBe("question");
    expect(restored.attempt_id).toBe(fb.attempt_id);
    expect(restored.submitting).toBe(false);
  });

  it("restores initial lesson preparing with pending_question_id and video_kind; OPEN_QUESTION after VIDEO_READY shows pending question", () => {
    const nav = openLessonState();
    const step = toStoredStep(nav);
    const restored = restoreNavState(
      defaultProgress({ current_step: step }),
      { hasParticipantCode: true },
    );
    expect(restored.screen).toBe("lesson");
    expect(restored.video_kind).toBe("initial");
    expect(restored.pending_question_id).toBe("rep-q1");
    expect(restored.video_status).toBe("preparing");

    const ready = navReducer(restored, {
      type: "VIDEO_READY",
      token: restored.token,
      job_id: "video-restored",
    });
    const question = navReducer(ready, { type: "OPEN_QUESTION" });
    expect(question.screen).toBe("question");
    expect(question.question_id).toBe("rep-q1");
  });

  it("restores follow-up lesson ready with pending_question_id and video_kind preserved", () => {
    const fb = feedbackState(attemptReviewAgain);
    let nav = navReducer(fb, { type: "CONTINUE" });
    const prepToken = nav.token;
    nav = navReducer(nav, {
      type: "VIDEO_JOB_CREATED",
      token: prepToken,
      job_id: "video-002",
    });
    nav = navReducer(nav, {
      type: "VIDEO_READY",
      token: prepToken,
      job_id: "video-002",
    });
    expect(nav.video_kind).toBe("followup");
    expect(nav.video_status).toBe("ready");
    expect(nav.pending_question_id).toBe("rep-r2");

    const step = toStoredStep(nav);
    const restored = restoreNavState(
      defaultProgress({
        current_step: step,
        attempts: {
          [fb.attempt_id!]: {
            request: {
              attempt_id: fb.attempt_id!,
              question_id: "rep-q2",
              selected_choice_id: "B",
              objective_id: "synthesis_direction_and_primer",
              remediation_state: attemptReviewAgain.remediation_state,
            },
            result: attemptReviewAgain,
          },
        },
      }),
      { hasParticipantCode: true },
    );
    expect(restored.screen).toBe("lesson");
    expect(restored.video_kind).toBe("followup");
    expect(restored.video_status).toBe("preparing");
    expect(restored.video_job_id).toBe("video-002");
    expect(restored.pending_question_id).toBe("rep-r2");
  });

  it("restores summary and RESTART_OBJECTIVE after restore returns initial lesson", () => {
    let summary = feedbackState(attemptComplete);
    summary = navReducer(summary, { type: "CONTINUE" });
    const step = toStoredStep(summary);
    const restored = restoreNavState(
      defaultProgress({
        current_step: step,
        attempts: {
          [step.attempt_id!]: {
            request: {
              attempt_id: step.attempt_id!,
              question_id: attemptComplete.question_id,
              selected_choice_id: "A",
              objective_id: "synthesis_direction_and_primer",
              remediation_state: attemptComplete.remediation_state,
            },
            result: { ...attemptComplete, attempt_id: step.attempt_id! },
          },
        },
      }),
      { hasParticipantCode: true },
    );
    expect(restored.screen).toBe("summary");

    const restarted = navReducer(restored, { type: "RESTART_OBJECTIVE" });
    expect(restarted.screen).toBe("lesson");
    expect(restarted.video_kind).toBe("initial");
    expect(restarted.video_status).toBe("preparing");
    expect(restarted.video_request).toEqual(initialVideoRequest);
    expect(restarted.pending_question_id).toBe("rep-q1");
  });

  it("restores summary with last_result from progress.attempts when attempt_id is on the step", () => {
    let summary = feedbackState(attemptComplete);
    summary = navReducer(summary, { type: "CONTINUE" });
    const step = toStoredStep(summary);
    expect(step.attempt_id).toBeDefined();

    const restored = restoreNavState(
      defaultProgress({
        current_step: step,
        attempts: {
          [step.attempt_id!]: {
            request: {
              attempt_id: step.attempt_id!,
              question_id: attemptComplete.question_id,
              selected_choice_id: "A",
              objective_id: "synthesis_direction_and_primer",
              remediation_state: attemptComplete.remediation_state,
            },
            result: { ...attemptComplete, attempt_id: step.attempt_id! },
          },
        },
      }),
      { hasParticipantCode: true },
    );

    expect(restored.screen).toBe("summary");
    expect(restored.last_result).toEqual({
      ...attemptComplete,
      attempt_id: step.attempt_id!,
    });
  });

  it("restores to home when summary step has no stored attempt result", () => {
    let summary = feedbackState(attemptComplete);
    summary = navReducer(summary, { type: "CONTINUE" });
    const step = toStoredStep(summary);

    const restored = restoreNavState(
      defaultProgress({ current_step: step }),
      { hasParticipantCode: true },
    );

    expect(restored.screen).toBe("home");
    expect(restored.last_result).toBeUndefined();
  });

  it("question restored from storage without a pending attempt has attempt_id undefined", () => {
    const nav = questionAfterLessonState();
    const step = toStoredStep(nav);
    expect(step.attempt_id).toBeUndefined();
    const restored = restoreNavState(
      defaultProgress({ current_step: step }),
      { hasParticipantCode: true },
    );
    expect(restored.screen).toBe("question");
    expect(restored.attempt_id).toBeUndefined();
  });

  it("followup_preparing restores pending_question_id from saved result", () => {
    const fb = feedbackState(attemptReviewAgain);
    let prep = navReducer(fb, { type: "CONTINUE" });
    const step = toStoredStep(prep);
    const progress = defaultProgress({
      current_step: step,
      attempts: {
        [fb.attempt_id!]: {
          request: {
            attempt_id: fb.attempt_id!,
            question_id: "rep-q2",
            selected_choice_id: "B",
            objective_id: "synthesis_direction_and_primer",
            remediation_state: attemptReviewAgain.remediation_state,
          },
          result: attemptReviewAgain,
        },
      },
    });
    const restored = restoreNavState(progress, { hasParticipantCode: true });
    expect(restored.screen).toBe("followup_preparing");
    expect(restored.pending_question_id).toBe("rep-r2");
  });

  it("never restores submitting as true", () => {
    const progress = defaultProgress({
      current_step: {
        screen: "question",
        question_id: "rep-q1",
        attempt_id: "attempt-stale",
      },
    });
    const restored = restoreNavState(progress, { hasParticipantCode: true });
    expect(restored.submitting).not.toBe(true);
  });

  it("restores participant_code, topics, home, and invalid screen correctly", () => {
    expect(
      restoreNavState(defaultProgress(), { hasParticipantCode: false }).screen,
    ).toBe("participant_code");

    expect(
      restoreNavState(defaultProgress({ selected_topic_ids: [] }), {
        hasParticipantCode: true,
      }).screen,
    ).toBe("topics");

    expect(
      restoreNavState(
        defaultProgress({ selected_topic_ids: ["dna_replication"] }),
        { hasParticipantCode: true },
      ).screen,
    ).toBe("home");

    expect(
      restoreNavState(
        defaultProgress({
          current_step: { screen: "not_a_real_screen" as NavState["screen"] },
        }),
        { hasParticipantCode: true },
      ).screen,
    ).toBe("home");
  });
});
