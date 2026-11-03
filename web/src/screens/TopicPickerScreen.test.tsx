import type { ComponentProps } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { topics } from "../fixtures/topics";
import { TopicPickerScreen } from "./TopicPickerScreen";

function renderTopicPicker(
  overrides: Partial<ComponentProps<typeof TopicPickerScreen>> = {},
) {
  const props = {
    topics,
    error: null,
    selectedIds: [] as string[],
    onToggle: vi.fn(),
    onConfirm: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
  render(<TopicPickerScreen {...props} />);
  return props;
}

describe("TopicPickerScreen", () => {
  it("renders one card per topic (four total)", () => {
    renderTopicPicker();
    expect(screen.getByRole("article", { name: "DNA Replication" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "DNA Repair" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Transcription" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Translation" })).toBeInTheDocument();
  });

  it("enables checkboxes for available topics and disables coming soon topics with a Coming soon label", () => {
    renderTopicPicker();
    expect(screen.getByRole("checkbox", { name: "DNA Replication" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "DNA Repair" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Transcription" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Translation" })).toBeDisabled();

    const transcriptionCard = screen.getByRole("article", { name: "Transcription" });
    expect(within(transcriptionCard).getByText("Coming soon")).toBeInTheDocument();
    const translationCard = screen.getByRole("article", { name: "Translation" });
    expect(within(translationCard).getByText("Coming soon")).toBeInTheDocument();
  });

  it("calls onToggle with the topic id when an available checkbox is clicked", async () => {
    const user = userEvent.setup();
    const { onToggle } = renderTopicPicker();
    await user.click(screen.getByRole("checkbox", { name: "DNA Replication" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("dna_replication");
  });

  it("does not call onToggle when a coming soon checkbox is clicked", async () => {
    const user = userEvent.setup();
    const { onToggle } = renderTopicPicker();
    await user.click(screen.getByRole("checkbox", { name: "Transcription" }));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("reflects checked state from selectedIds", () => {
    renderTopicPicker({ selectedIds: ["dna_replication", "dna_repair"] });
    expect(screen.getByRole("checkbox", { name: "DNA Replication" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "DNA Repair" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Transcription" })).not.toBeChecked();
  });

  it("disables Continue with no selection and calls onConfirm when enabled", async () => {
    const user = userEvent.setup();
    const { onConfirm, ...rest } = renderTopicPicker();
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toBeDisabled();

    cleanup();
    render(<TopicPickerScreen {...rest} selectedIds={["dna_replication"]} onConfirm={onConfirm} />);
    const enabledContinue = screen.getByRole("button", { name: "Continue" });
    expect(enabledContinue).toBeEnabled();
    await user.click(enabledContinue);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("shows a loading state when topics is null", () => {
    renderTopicPicker({ topics: null });
    expect(screen.getByRole("status", { name: "Loading topics" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows an error message and Retry calls onRetry", async () => {
    const user = userEvent.setup();
    const { onRetry } = renderTopicPicker({
      topics: null,
      error: "Could not load topics.",
    });
    expect(screen.getByText("Could not load topics.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not claim the app has confirmed the user's exam coverage", () => {
    renderTopicPicker();
    expect(screen.queryByText(/confirmed exam coverage/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/we know which topics.*exam/i),
    ).not.toBeInTheDocument();
  });
});
