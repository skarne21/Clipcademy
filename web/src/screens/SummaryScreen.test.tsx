import type { ComponentProps } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { attemptNeedsReview } from "../fixtures/attempts";
import { SummaryScreen } from "./SummaryScreen";

const objectiveLabel = "Synthesis direction and primer requirement";

function renderSummary(overrides: Partial<ComponentProps<typeof SummaryScreen>> = {}) {
  const props: ComponentProps<typeof SummaryScreen> = {
    objectiveLabel,
    status: "complete",
    onGoHome: vi.fn(),
    onRestart: vi.fn(),
    ...overrides,
  };
  render(<SummaryScreen {...props} />);
  return props;
}

describe("SummaryScreen", () => {
  it('shows "Objective complete" and names the objective without topic-complete wording', () => {
    renderSummary({ status: "complete" });
    expect(screen.getByRole("heading", { name: "Objective complete" })).toBeInTheDocument();
    expect(screen.getByText(objectiveLabel)).toBeInTheDocument();
    expect(screen.queryByText(/mastered/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/topic.*complete/i)).not.toBeInTheDocument();
  });

  it("shows needs_review content with feedback, key points, and formatted sources", () => {
    renderSummary({
      status: "needs_review",
      feedback: attemptNeedsReview.feedback,
      keyPoints: attemptNeedsReview.key_points,
      sourceRefs: attemptNeedsReview.source_refs,
    });
    expect(screen.getByRole("heading", { name: "Let's review this one" })).toBeInTheDocument();
    expect(screen.getByText(objectiveLabel)).toBeInTheDocument();
    expect(screen.getByText(attemptNeedsReview.feedback)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Key points" })).toBeInTheDocument();
    expect(
      screen.getByText("DNA polymerase can only extend from a 3′ OH."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Primase synthesizes a short RNA primer to start synthesis."),
    ).toBeInTheDocument();
    expect(screen.getByText("Lecture 19, p. 1; Lecture 19, p. 2")).toBeInTheDocument();
  });

  it.each([
    { label: "empty keyPoints", keyPoints: [] as string[] },
    { label: "missing keyPoints", keyPoints: undefined },
  ])("does not show Key points heading when $label", ({ keyPoints }) => {
    renderSummary({
      status: "needs_review",
      feedback: attemptNeedsReview.feedback,
      keyPoints,
      sourceRefs: attemptNeedsReview.source_refs,
    });
    expect(screen.queryByRole("heading", { name: "Key points" })).not.toBeInTheDocument();
  });

  it("calls onGoHome and onRestart from both complete and needs_review states", async () => {
    const user = userEvent.setup();

    let props = renderSummary({ status: "complete" });
    await user.click(screen.getByRole("button", { name: "Back to home" }));
    expect(props.onGoHome).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Restart this objective" }));
    expect(props.onRestart).toHaveBeenCalledTimes(1);

    cleanup();
    props = renderSummary({
      status: "needs_review",
      feedback: attemptNeedsReview.feedback,
      keyPoints: attemptNeedsReview.key_points,
    });
    await user.click(screen.getByRole("button", { name: "Back to home" }));
    expect(props.onGoHome).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Restart this objective" }));
    expect(props.onRestart).toHaveBeenCalledTimes(1);
  });

  it("moves focus to the heading when the screen appears", () => {
    renderSummary({ status: "complete" });
    expect(screen.getByRole("heading", { name: "Objective complete" })).toHaveFocus();
  });
});
