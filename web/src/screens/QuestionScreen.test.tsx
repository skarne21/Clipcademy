import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Question } from "../api/types";
import { repQ1 } from "../fixtures/questions";
import { QuestionScreen } from "./QuestionScreen";

const repQ2: Question = {
  question_id: "rep-q2",
  objective_id: "synthesis_direction_and_primer",
  prompt: "Which enzyme synthesizes the RNA primer?",
  choices: [
    { choice_id: "A", text: "Primase" },
    { choice_id: "B", text: "Helicase" },
  ],
};

function renderQuestion(
  overrides: Partial<ComponentProps<typeof QuestionScreen>> = {},
) {
  const props: ComponentProps<typeof QuestionScreen> = {
    question: repQ1,
    loadError: null,
    submitting: false,
    submitError: null,
    onSubmit: vi.fn(),
    onRetryLoad: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  };
  const view = render(<QuestionScreen {...props} />);
  return { ...view, props };
}

describe("QuestionScreen", () => {
  it("shows a loading state when question is null", () => {
    renderQuestion({ question: null });
    expect(screen.getByRole("status", { name: "Loading question" })).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("shows a load error and Try again calls onRetryLoad", async () => {
    const user = userEvent.setup();
    const { props } = renderQuestion({
      question: null,
      loadError: "Could not load question.",
    });
    expect(screen.getByText("Could not load question.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(props.onRetryLoad).toHaveBeenCalledTimes(1);
  });

  it("renders the prompt as the fieldset legend and choices as radios in order", () => {
    renderQuestion();
    expect(
      screen.getByRole("group", {
        name: "Which end receives new nucleotides during DNA synthesis?",
      }),
    ).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios[0]).toHaveAccessibleName("5′ end");
    expect(radios[1]).toHaveAccessibleName("3′ end");
  });

  it("disables Submit until a choice is selected", async () => {
    const user = userEvent.setup();
    renderQuestion();
    const submit = screen.getByRole("button", { name: "Submit" });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "3′ end" }));
    expect(submit).toBeEnabled();
  });

  it("calls onSubmit once with the selected choice_id when Submit is clicked", async () => {
    const user = userEvent.setup();
    const { props } = renderQuestion();
    await user.click(screen.getByRole("radio", { name: "3′ end" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
    expect(props.onSubmit).toHaveBeenCalledWith("B");
  });

  it("calls onSubmit only once when Submit is double-clicked", async () => {
    const user = userEvent.setup();
    const { props } = renderQuestion();
    await user.click(screen.getByRole("radio", { name: "3′ end" }));
    await user.dblClick(screen.getByRole("button", { name: "Submit" }));
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
    expect(props.onSubmit).toHaveBeenCalledWith("B");
  });

  it("disables Submit while submitting is true", () => {
    renderQuestion({ submitting: true });
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("shows submitError as an alert, keeps the selection, and allows resubmit after submitting clears", async () => {
    const user = userEvent.setup();
    const { rerender, props } = renderQuestion({
      submitError: "Network error.",
    });
    await user.click(screen.getByRole("radio", { name: "3′ end" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Network error.");
    expect(screen.getByRole("radio", { name: "3′ end" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();

    rerender(
      <QuestionScreen
        {...props}
        question={repQ1}
        loadError={null}
        submitting={true}
        submitError={null}
      />,
    );
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();

    rerender(
      <QuestionScreen
        {...props}
        question={repQ1}
        loadError={null}
        submitting={false}
        submitError={null}
      />,
    );
    expect(screen.getByRole("radio", { name: "3′ end" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not show correctness or feedback text before submission", () => {
    renderQuestion();
    expect(screen.queryByText(/correct/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/incorrect/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/feedback/i)).not.toBeInTheDocument();
  });

  it("clears the selection when question_id changes", async () => {
    const user = userEvent.setup();
    const { rerender, props } = renderQuestion();
    await user.click(screen.getByRole("radio", { name: "3′ end" }));
    expect(screen.getByRole("radio", { name: "3′ end" })).toBeChecked();

    rerender(<QuestionScreen {...props} question={repQ2} />);
    expect(screen.getByRole("radio", { name: "3′ end" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Primase" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("calls onBack when Back is clicked", async () => {
    const user = userEvent.setup();
    const { props } = renderQuestion();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });
});
