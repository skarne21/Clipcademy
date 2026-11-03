import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { getTopics } from "../api/client";
import { ApiRequestError } from "../api/errors";
import type { Topic } from "../api/types";
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
  resetDemo,
  saveParticipantCode,
  setCurrentStep,
  setSelectedTopics,
  type ProgressState,
} from "../storage/progress";
import type { AppDeps } from "./deps";

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

export function useAppController(deps: AppDeps) {
  const [nav, dispatch] = useReducer(navReducer, undefined, () =>
    readInitialNav(deps.storage),
  );
  const [progressSnapshot, setProgressSnapshot] = useState<ProgressState>(() =>
    loadProgress(deps.storage),
  );
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [topicsError, setTopicsError] = useState<string | null>(null);

  const topicsAbortRef = useRef<AbortController | null>(null);
  const sessionStartedRef = useRef(false);

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
  }, [deps, dispatchNav]);

  const onOpenObjective = useCallback(
    (_topicId: string, _objectiveId: string) => {
      // Part 2
    },
    [],
  );

  const onResume = useCallback(() => {
    // Part 4 restore uses reducer; home keeps canResume false in Part 1
  }, []);

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
    onResume,
    isStartable: (objectiveId: string) => getObjectiveStart(objectiveId) !== null,
  };
}
