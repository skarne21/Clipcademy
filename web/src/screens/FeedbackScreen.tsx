import { useEffect, useRef } from "react";
import type { AttemptAction, AttemptResult } from "../api/types";
import { formatSourceRefs } from "../content/sourceRefs";

type FeedbackError =
  | "unknown_action"
  | "missing_next_question"
  | "missing_video_request";

type FeedbackScreenProps = {
  result: AttemptResult;
  error?: FeedbackError;
  onContinue(): void;
  onGoHome(): void;
};

const KNOWN_ACTIONS: AttemptAction[] = [
  "continue_questions",
  "review_again",
  "complete",
  "needs_review",
];

function isKnownAction(action: string): action is AttemptAction {
  return KNOWN_ACTIONS.includes(action as AttemptAction);
}

function continueButtonLabel(action: AttemptAction): string {
  switch (action) {
    case "continue_questions":
      return "Next question";
    case "review_again":
      return "Watch a short follow-up";
    case "complete":
    case "needs_review":
      return "See summary";
    default:
      return "Continue";
  }
}

export function FeedbackScreen({
  result,
  error,
  onContinue,
  onGoHome,
}: FeedbackScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  const heading = result.correct ? "Correct" : "Not quite";
  const showRoutingError = error !== undefined || !isKnownAction(result.action);
  const sourceLabel =
    result.source_refs.length > 0 ? formatSourceRefs(result.source_refs) : "";

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main>
      <h1 ref={headingRef} tabIndex={-1}>
        {heading}
      </h1>
      <p>{result.feedback}</p>
      {sourceLabel ? <p>{sourceLabel}</p> : null}

      {showRoutingError ? (
        <>
          <p role="alert">Something went wrong loading the next step.</p>
          <button type="button" onClick={onGoHome}>
            Back to home
          </button>
        </>
      ) : (
        <button type="button" onClick={onContinue}>
          {continueButtonLabel(result.action)}
        </button>
      )}
    </main>
  );
}
