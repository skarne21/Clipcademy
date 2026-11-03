import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RemediationState } from "../api/types";
import { topics } from "../fixtures/topics";
import { ReviewHomeScreen } from "./ReviewHomeScreen";

function baseRemediation(
  objectiveStatus: RemediationState["objective_status"],
): RemediationState {
  return {
    objective_status: objectiveStatus,
    expected_question_id: null,
    remediation_count: 0,
    satisfied_question_ids: [],
    asked_retry_ids: [],
  };
}

function renderReviewHome(
  overrides: Partial<ComponentProps<typeof ReviewHomeScreen>> = {},
) {
  const props: ComponentProps<typeof ReviewHomeScreen> = {
    topics,
    selectedIds: ["dna_replication"],
    remediationStates: {},
    isStartable: () => true,
    canResume: false,
    onOpenObjective: vi.fn(),
    onResume: vi.fn(),
    onChangeTopics: vi.fn(),
    ...overrides,
  };
  render(<ReviewHomeScreen {...props} />);
  return props;
}

describe("ReviewHomeScreen", () => {
  it("renders only topics that are selected", () => {
    renderReviewHome({ selectedIds: ["dna_replication"] });
    expect(screen.getByRole("heading", { name: "DNA Replication" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "DNA Repair" })).not.toBeInTheDocument();
  });

  it("shows Not started when there is no remediation state for an objective", () => {
    renderReviewHome({ remediationStates: {} });
    const section = screen.getByRole("region", {
      name: "Synthesis direction and primer requirement",
    });
    expect(within(section).getByText("Not started")).toBeInTheDocument();
  });

  it("shows In progress from remediation state", () => {
    renderReviewHome({
      remediationStates: {
        synthesis_direction_and_primer: baseRemediation("in_progress"),
      },
    });
    const section = screen.getByRole("region", {
      name: "Synthesis direction and primer requirement",
    });
    expect(within(section).getByText("In progress")).toBeInTheDocument();
  });

  it("shows objective complete wording that names the objective", () => {
    renderReviewHome({
      remediationStates: {
        synthesis_direction_and_primer: baseRemediation("complete"),
      },
    });
    expect(
      screen.getByText(
        "Objective complete: Synthesis direction and primer requirement",
      ),
    ).toBeInTheDocument();
  });

  it("shows Needs review from remediation state", () => {
    renderReviewHome({
      remediationStates: {
        synthesis_direction_and_primer: baseRemediation("needs_review"),
      },
    });
    const section = screen.getByRole("region", {
      name: "Synthesis direction and primer requirement",
    });
    expect(within(section).getByText("Needs review")).toBeInTheDocument();
  });

  it("does not say the topic is complete or mastered when an objective is complete", () => {
    renderReviewHome({
      remediationStates: {
        synthesis_direction_and_primer: baseRemediation("complete"),
      },
    });
    expect(screen.queryByText(/DNA Replication.*complete/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/topic.*mastered/i)).not.toBeInTheDocument();
  });

  it("calls onOpenObjective with topic and objective ids when Start is clicked", async () => {
    const user = userEvent.setup();
    const { onOpenObjective } = renderReviewHome({
      isStartable: () => true,
    });
    await user.click(
      screen.getByRole("button", {
        name: "Start, Synthesis direction and primer requirement",
      }),
    );
    expect(onOpenObjective).toHaveBeenCalledTimes(1);
    expect(onOpenObjective).toHaveBeenCalledWith(
      "dna_replication",
      "synthesis_direction_and_primer",
    );
  });

  it("shows Coming soon and no start button when isStartable is false", () => {
    renderReviewHome({
      isStartable: () => false,
    });
    const section = screen.getByRole("region", {
      name: "Synthesis direction and primer requirement",
    });
    expect(within(section).getByText("Coming soon")).toBeInTheDocument();
    expect(
      within(section).queryByRole("button", {
        name: "Start, Synthesis direction and primer requirement",
      }),
    ).not.toBeInTheDocument();
  });

  it("does not show progress status for a selected coming_soon topic even with stray remediation state", () => {
    renderReviewHome({
      selectedIds: ["transcription"],
      remediationStates: {
        some_stray_objective: baseRemediation("in_progress"),
      },
    });
    expect(screen.getByRole("heading", { name: "Transcription" })).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.queryByText("In progress")).not.toBeInTheDocument();
    expect(screen.queryByText("Not started")).not.toBeInTheDocument();
    expect(screen.queryByText("Needs review")).not.toBeInTheDocument();
  });

  it("shows Resume only when canResume is true", () => {
    renderReviewHome({ canResume: false });
    expect(screen.queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();

    renderReviewHome({ canResume: true });
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
  });

  it("calls onChangeTopics when Change topics is clicked", async () => {
    const user = userEvent.setup();
    const { onChangeTopics } = renderReviewHome();
    await user.click(screen.getByRole("button", { name: "Change topics" }));
    expect(onChangeTopics).toHaveBeenCalledTimes(1);
  });
});
