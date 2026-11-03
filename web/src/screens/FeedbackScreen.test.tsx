import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AttemptResult } from "../api/types";
import {
  attemptComplete,
  attemptContinue,
  attemptNeedsReview,
  attemptReviewAgain,
} from "../fixtures/attempts";
import { FeedbackScreen } from "./FeedbackScreen";

function renderFeedback(
  overrides: Partial<ComponentProps<typeof FeedbackScreen>> = {},
) {
  const props: ComponentProps<typeof FeedbackScreen> = {
    result: attemptContinue,
    onContinue: vi.fn(),
    onGoHome: vi.fn(),
    ...overrides,
  };
  render(<FeedbackScreen {...props} />);
  return props;
}

describe("FeedbackScreen", () => {
  it('shows heading "Correct" when result.correct is true', () => {
    renderFeedback({ result: attemptContinue });
    expect(screen.getByRole("heading", { name: "Correct" })).toBeInTheDocument();
  });

  it('shows heading "Not quite" when result.correct is false', () => {
    renderFeedback({ result: attemptReviewAgain });
    expect(screen.getByRole("heading", { name: "Not quite" })).toBeInTheDocument();
  });

  it("moves focus to the heading when the screen appears", () => {
    renderFeedback({ result: attemptContinue });
    expect(screen.getByRole("heading", { name: "Correct" })).toHaveFocus();
  });

  it("shows feedback text and formatted source references", () => {
    renderFeedback({ result: attemptContinue });
    expect(
      screen.getByText("Correct. DNA polymerase adds nucleotides to the 3′ end."),
    ).toBeInTheDocument();
    expect(screen.getByText("Lecture 19, p. 1; Lecture 19, p. 2")).toBeInTheDocument();
  });

  it('shows "Next question" for continue_questions and calls onContinue', async () => {
    const user = userEvent.setup();
    const { onContinue } = renderFeedback({ result: attemptContinue });
    await user.click(screen.getByRole("button", { name: "Next question" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('shows "Watch a short follow-up" for review_again', () => {
    renderFeedback({ result: attemptReviewAgain });
    expect(
      screen.getByRole("button", { name: "Watch a short follow-up" }),
    ).toBeInTheDocument();
  });

  it('shows "See summary" for complete', () => {
    renderFeedback({ result: attemptComplete });
    expect(screen.getByRole("button", { name: "See summary" })).toBeInTheDocument();
  });

  it('shows "See summary" for needs_review', () => {
    renderFeedback({ result: attemptNeedsReview });
    expect(screen.getByRole("button", { name: "See summary" })).toBeInTheDocument();
  });

  it("never renders misconception_id text", () => {
    renderFeedback({ result: attemptReviewAgain });
    expect(screen.queryByText("primer_requirement")).not.toBeInTheDocument();
    expect(screen.queryByText(/misconception/i)).not.toBeInTheDocument();
  });

  it("shows the error alert and Back to home without Continue for an unrecognized action", async () => {
    const user = userEvent.setup();
    const unrecognized: AttemptResult = {
      ...attemptContinue,
      action: "skip_ahead" as AttemptResult["action"],
    };
    const { onGoHome } = renderFeedback({ result: unrecognized });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Something went wrong loading the next step.",
    );
    expect(screen.queryByRole("button", { name: "Next question" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to home" }));
    expect(onGoHome).toHaveBeenCalledTimes(1);
  });

  it.each([
    "unknown_action",
    "missing_next_question",
    "missing_video_request",
  ] as const)("shows error UI for error %s with no Continue button", async (error) => {
    const user = userEvent.setup();
    const { onGoHome } = renderFeedback({
      result: attemptContinue,
      error,
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Something went wrong loading the next step.",
    );
    expect(screen.queryByRole("button", { name: "Next question" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to home" }));
    expect(onGoHome).toHaveBeenCalledTimes(1);
  });
});
