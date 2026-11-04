import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  createVideoJob,
  getQuestion,
  getTopics,
  pollVideoJob,
  submitAttempt,
} from "../api/client";
import { ApiRequestError, VideoJobFailedError } from "../api/errors";
import type { Question, RemediationState, Topic } from "../api/types";
import { getObjectiveStart } from "../content/objectiveMap";
import {
  initNavState,
  navReducer,
  restoreNavState,
  toStoredStep,
  type NavAction,
  type NavState,
} from "../navigation/navReducer";
import {
  loadParticipantCode,
  loadProgress,
  recordAttemptRequest,
  recordAttemptResult,
  resetDemo,
  saveParticipantCode,
  saveRemediationState,
  setCurrentStep,
  setSelectedTopics,
  type ProgressState,
} from "../storage/progress";
import type { AppDeps } from "./deps";

const DEFAULT_REMEDIATION_STATE: RemediationState = {
  objective_status: "not_started",
  expected_question_id: null,
  remediation_count: 0,
  satisfied_question_ids: [],
  asked_retry_ids: [],
};

type VideoJobMeta = {
  video_url: string;
  transcript?: string;
  source_refs: string[];
};

function readInitialNav(storage: Storage): NavState {
  const hasParticipantCode = loadParticipantCode(storage) !== null;
  if (!hasParticipantCode) {
    return initNavState({
      hasParticipantCode: false,
      hasSelectedTopics: false,
    });
  }
  return restoreNavState(loadProgress(storage), { hasParticipantCode: true });
}

function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong.";
}

function isVideoPipelineScreen(screen: NavState["screen"]): boolean {
  return screen === "lesson" || screen === "followup_preparing";
}

function resolveFirstQuestionId(
  objectiveId: string,
  storage: Storage,
): string | null {
  const start = getObjectiveStart(objectiveId);
  if (!start) {
    return null;
  }
  const saved = loadProgress(storage).remediation_states[objectiveId];
  if (
    saved?.objective_status === "in_progress" &&
    saved.expected_question_id !== null
  ) {
    return saved.expected_question_id;
  }
  return start.first_question_id;
}

function findObjectiveLabel(
  topics: Topic[] | null,
  topicId: string | undefined,
  objectiveId: string | undefined,
): string {
  if (!topics || !topicId || !objectiveId) {
    return "Lesson";
  }
  const topic = topics.find((item) => item.topic_id === topicId);
  const objective = topic?.objectives.find(
    (item) => item.objective_id === objectiveId,
  );
  return objective?.label ?? "Lesson";
}

export function useAppController(deps: AppDeps) {
  const [nav, dispatch] = useReducer(navReducer, undefined, () =>
    readInitialNav(deps.storage),
  );
  const [progressSnapshot, setProgressSnapshot] = useState<ProgressState>(() =>
    loadProgress(deps.storage),
  );
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const [videoJobsById, setVideoJobsById] = useState<
    Record<string, VideoJobMeta>
  >({});
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionLoadError, setQuestionLoadError] = useState<string | null>(
    null,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [questionLoadNonce, setQuestionLoadNonce] = useState(0);

  const navRef = useRef(nav);
  navRef.current = nav;

  const topicsAbortRef = useRef<AbortController | null>(null);
  const videoAbortRef = useRef<AbortController | null>(null);
  const questionAbortRef = useRef<AbortController | null>(null);
  const attemptAbortRef = useRef<AbortController | null>(null);
  const sessionStartedRef = useRef(false);
  const prevScreenRef = useRef<NavState["screen"]>(nav.screen);

  const refreshProgressSnapshot = useCallback(() => {
    setProgressSnapshot(loadProgress(deps.storage));
  }, [deps.storage]);

  const loadTopicsList = useCallback(async () => {
    topicsAbortRef.current?.abort();
    const controller = new AbortController();
    topicsAbortRef.current = controller;

    setTopics(null);
    setTopicsError(null);

    try {
      const list = await getTopics({ signal: controller.signal });
      if (controller.signal.aborted) {
        return;
      }
      setTopics(list);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      setTopicsError(apiErrorMessage(error));
      setTopics(null);
    }
  }, []);

  useEffect(() => {
    if (!sessionStartedRef.current) {
      sessionStartedRef.current = true;
      deps.tracker.startSession();
    }
  }, [deps.tracker]);

  useEffect(() => {
    void loadTopicsList();
    return () => {
      topicsAbortRef.current?.abort();
    };
  }, [loadTopicsList]);

  useEffect(() => {
    setCurrentStep(toStoredStep(nav), deps.storage);
    refreshProgressSnapshot();
  }, [nav, deps.storage, refreshProgressSnapshot]);

  useEffect(() => {
    if (
      nav.screen === "followup_preparing" &&
      prevScreenRef.current === "feedback" &&
      nav.video_request
    ) {
      deps.tracker.track("followup_requested", {
        variant_id: nav.video_request.variant_id,
      });
    }
    prevScreenRef.current = nav.screen;
  }, [nav.screen, nav.video_request, deps.tracker]);

  useEffect(() => {
    const { screen, video_status, video_request, video_job_id, token } = nav;

    if (
      !isVideoPipelineScreen(screen) ||
      video_status !== "preparing" ||
      !video_request
    ) {
      return;
    }

    videoAbortRef.current?.abort();
    const controller = new AbortController();
    videoAbortRef.current = controller;

    void (async () => {
      try {
        let jobId = video_job_id;
        if (!jobId) {
          const created = await createVideoJob(video_request, {
            signal: controller.signal,
          });
          if (controller.signal.aborted) {
            return;
          }
          if (navRef.current.token !== token) {
            return;
          }
          jobId = created.job_id;
          dispatch({
            type: "VIDEO_JOB_CREATED",
            token,
            job_id: jobId,
          });
          return;
        }

        const readyJob = await pollVideoJob(jobId, {
          intervalMs: deps.pollIntervalMs,
          timeoutMs: deps.pollTimeoutMs,
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }
        if (navRef.current.token !== token) {
          return;
        }
        if (!readyJob.video_url) {
          dispatch({
            type: "VIDEO_FAILED",
            token,
            job_id: readyJob.job_id,
          });
          return;
        }

        const videoUrl = readyJob.video_url;
        setVideoJobsById((prev) => ({
          ...prev,
          [readyJob.job_id]: {
            video_url: videoUrl,
            transcript: readyJob.transcript,
            source_refs: readyJob.source_refs,
          },
        }));
        dispatch({
          type: "VIDEO_READY",
          token,
          job_id: readyJob.job_id,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        if (navRef.current.token !== token) {
          return;
        }
        if (error instanceof VideoJobFailedError) {
          dispatch({
            type: "VIDEO_FAILED",
            token,
            job_id: error.job.job_id,
          });
          return;
        }
        if (error instanceof ApiRequestError && error.status === 404) {
          dispatch({
            type: "VIDEO_FAILED",
            token,
            job_id: video_job_id ?? "unknown",
          });
          return;
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [
    nav.screen,
    nav.video_status,
    nav.video_request,
    nav.video_job_id,
    nav.token,
    deps.pollIntervalMs,
    deps.pollTimeoutMs,
  ]);

  useEffect(() => {
    if (nav.screen !== "question" || !nav.question_id) {
      questionAbortRef.current?.abort();
      setQuestion(null);
      setQuestionLoadError(null);
      setSubmitError(null);
      return;
    }

    questionAbortRef.current?.abort();
    const controller = new AbortController();
    questionAbortRef.current = controller;
    const questionId = nav.question_id;
    const token = nav.token;

    setQuestion(null);
    setQuestionLoadError(null);
    setSubmitError(null);

    void (async () => {
      try {
        const loaded = await getQuestion(questionId, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }
        if (
          navRef.current.token !== token ||
          navRef.current.question_id !== questionId
        ) {
          return;
        }
        setQuestion(loaded);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        if (
          navRef.current.token !== token ||
          navRef.current.question_id !== questionId
        ) {
          return;
        }
        setQuestionLoadError(apiErrorMessage(error));
      }
    })();

    return () => {
      controller.abort();
    };
  }, [nav.screen, nav.question_id, nav.token, questionLoadNonce]);

  const dispatchNav = useCallback((action: NavAction) => {
    dispatch(action);
  }, []);

  const onParticipantSubmit = useCallback(
    (code: string) => {
      saveParticipantCode(code, deps.storage);
      dispatchNav({ type: "PARTICIPANT_CODE_SAVED" });
      void deps.tracker.flush();
    },
    [deps, dispatchNav],
  );

  const onTopicToggle = useCallback(
    (topicId: string) => {
      const progress = loadProgress(deps.storage);
      const selected = new Set(progress.selected_topic_ids);
      if (selected.has(topicId)) {
        selected.delete(topicId);
      } else {
        selected.add(topicId);
        deps.tracker.track("topic_selected", { topic_id: topicId });
      }
      setSelectedTopics([...selected], deps.storage);
      refreshProgressSnapshot();
    },
    [deps, refreshProgressSnapshot],
  );

  const onTopicsConfirm = useCallback(() => {
    dispatchNav({ type: "TOPICS_CONFIRMED" });
  }, [dispatchNav]);

  const onChangeTopics = useCallback(() => {
    dispatchNav({ type: "RESET_DEMO" });
  }, [dispatchNav]);

  const onResetDemo = useCallback(() => {
    resetDemo(deps.storage);
    deps.tracker.track("demo_reset");
    dispatchNav({ type: "RESET_DEMO" });
    refreshProgressSnapshot();
  }, [deps, dispatchNav, refreshProgressSnapshot]);

  const onOpenObjective = useCallback(
    (topicId: string, objectiveId: string) => {
      const start = getObjectiveStart(objectiveId);
      if (!start) {
        return;
      }
      const firstQuestionId = resolveFirstQuestionId(objectiveId, deps.storage);
      if (!firstQuestionId) {
        return;
      }
      dispatchNav({
        type: "OPEN_LESSON",
        topic_id: topicId,
        objective_id: objectiveId,
        video_request: start.initial_video_request,
        first_question_id: firstQuestionId,
      });
    },
    [deps.storage, dispatchNav],
  );

  const onReviewObjectiveAgain = useCallback(
    (topicId: string, objectiveId: string) => {
      const start = getObjectiveStart(objectiveId);
      if (!start) {
        return;
      }
      saveRemediationState(objectiveId, DEFAULT_REMEDIATION_STATE, deps.storage);
      refreshProgressSnapshot();
      dispatchNav({
        type: "OPEN_LESSON",
        topic_id: topicId,
        objective_id: objectiveId,
        video_request: start.initial_video_request,
        first_question_id: start.first_question_id,
      });
    },
    [deps.storage, dispatchNav, refreshProgressSnapshot],
  );

  const onResume = useCallback(() => {
    // Part 4 restore uses reducer; home keeps canResume false in Part 1
  }, []);

  const onRetryVideo = useCallback(() => {
    dispatchNav({ type: "RETRY_VIDEO" });
  }, [dispatchNav]);

  const onOpenQuestion = useCallback(() => {
    dispatchNav({ type: "OPEN_QUESTION" });
  }, [dispatchNav]);

  const onGoHome = useCallback(() => {
    dispatchNav({ type: "GO_HOME" });
  }, [dispatchNav]);

  const onVideoStarted = useCallback(() => {
    const variantId = navRef.current.video_request?.variant_id;
    if (!variantId) {
      return;
    }
    deps.tracker.track("video_started", { variant_id: variantId });
  }, [deps.tracker]);

  const onVideoCompleted = useCallback(() => {
    const variantId = navRef.current.video_request?.variant_id;
    if (!variantId) {
      return;
    }
    deps.tracker.track("video_completed", { variant_id: variantId });
  }, [deps.tracker]);

  const onRetryQuestionLoad = useCallback(() => {
    setQuestionLoadNonce((value) => value + 1);
  }, []);

  const onQuestionSubmit = useCallback(
    (selectedChoiceId: string) => {
      const current = navRef.current;
      if (
        current.screen !== "question" ||
        !current.question_id ||
        !current.objective_id ||
        current.submitting
      ) {
        return;
      }

      const token = current.token;
      const attemptId = current.attempt_id ?? deps.generateId();
      const progress = loadProgress(deps.storage);
      const remediationState =
        progress.remediation_states[current.objective_id] ??
        DEFAULT_REMEDIATION_STATE;

      const request = {
        attempt_id: attemptId,
        question_id: current.question_id,
        selected_choice_id: selectedChoiceId,
        objective_id: current.objective_id,
        remediation_state: remediationState,
      };

      recordAttemptRequest(request, deps.storage);
      refreshProgressSnapshot();
      dispatchNav({ type: "ATTEMPT_SUBMITTED", attempt_id: attemptId });
      setSubmitError(null);

      attemptAbortRef.current?.abort();
      const controller = new AbortController();
      attemptAbortRef.current = controller;

      void (async () => {
        try {
          const result = await submitAttempt(request, {
            signal: controller.signal,
          });
          if (controller.signal.aborted) {
            return;
          }
          if (navRef.current.token !== token) {
            return;
          }
          if (navRef.current.attempt_id !== attemptId) {
            return;
          }

          if (result.attempt_id !== attemptId) {
            dispatchNav({
              type: "ATTEMPT_FAILED",
              token,
              attempt_id: attemptId,
            });
            setSubmitError("The server returned an unexpected attempt.");
            return;
          }

          recordAttemptResult(result, deps.storage);
          refreshProgressSnapshot();
          dispatchNav({
            type: "ATTEMPT_RESULT",
            token,
            result,
          });
          deps.tracker.track("question_answered", {
            question_id: result.question_id,
            correct: result.correct,
          });
          if (result.remediation_state.objective_status === "complete") {
            deps.tracker.track("objective_completed", {
              objective_id: request.objective_id,
            });
          } else if (result.remediation_state.objective_status === "needs_review") {
            deps.tracker.track("objective_needs_review", {
              objective_id: request.objective_id,
            });
          }
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }
          if (navRef.current.token !== token) {
            return;
          }
          if (navRef.current.attempt_id !== attemptId) {
            return;
          }
          dispatchNav({
            type: "ATTEMPT_FAILED",
            token,
            attempt_id: attemptId,
          });
          setSubmitError(apiErrorMessage(error));
        }
      })();
    },
    [deps, dispatchNav, refreshProgressSnapshot],
  );

  const onFeedbackContinue = useCallback(() => {
    dispatchNav({ type: "CONTINUE" });
  }, [dispatchNav]);

  const onRestartObjective = useCallback(() => {
    const objectiveId = navRef.current.objective_id;
    if (!objectiveId) {
      return;
    }
    saveRemediationState(objectiveId, DEFAULT_REMEDIATION_STATE, deps.storage);
    refreshProgressSnapshot();
    dispatchNav({ type: "RESTART_OBJECTIVE" });
  }, [deps.storage, dispatchNav, refreshProgressSnapshot]);

  const followupVideoStatus: "preparing" | "failed" | undefined =
    nav.screen === "followup_preparing"
      ? nav.video_status === "failed"
        ? "failed"
        : "preparing"
      : undefined;

  const lessonVideoMeta =
    nav.video_job_id !== undefined
      ? videoJobsById[nav.video_job_id]
      : undefined;

  const lessonTitle = findObjectiveLabel(
    topics,
    nav.topic_id,
    nav.objective_id,
  );

  return {
    nav,
    topics,
    topicsError,
    progressSnapshot,
    loadTopicsList,
    onParticipantSubmit,
    onTopicToggle,
    onTopicsConfirm,
    onChangeTopics,
    onResetDemo,
    onOpenObjective,
    onReviewObjectiveAgain,
    onResume,
    onRetryVideo,
    onOpenQuestion,
    onGoHome,
    onVideoStarted,
    onVideoCompleted,
    onRetryQuestionLoad,
    onQuestionSubmit,
    onFeedbackContinue,
    onRestartObjective,
    followupVideoStatus,
    lessonTitle,
    lessonVideoMeta,
    question,
    questionLoadError,
    submitError,
    isStartable: (objectiveId: string) => getObjectiveStart(objectiveId) !== null,
  };
}
