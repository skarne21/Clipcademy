import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ParticipantCodeScreen } from "./ParticipantCodeScreen";

describe("ParticipantCodeScreen", () => {
  it("disables Continue when the input is empty", () => {
    render(<ParticipantCodeScreen onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("disables Continue when the input is whitespace only", async () => {
    const user = userEvent.setup();
    render(<ParticipantCodeScreen onSubmit={vi.fn()} />);
    const input = screen.getByLabelText("Participant code");
    await user.type(input, "   ");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("enables Continue after non-whitespace input", async () => {
    const user = userEvent.setup();
    render(<ParticipantCodeScreen onSubmit={vi.fn()} />);
    const input = screen.getByLabelText("Participant code");
    await user.type(input, "abc");
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("calls onSubmit once with the trimmed code when Continue is clicked", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ParticipantCodeScreen onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Participant code");
    await user.type(input, "  study-42  ");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("study-42");
  });

  it("submits when Enter is pressed in the input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ParticipantCodeScreen onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Participant code");
    await user.type(input, "code-1{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("code-1");
  });

  it("calls onSubmit only once when Continue is double-clicked", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ParticipantCodeScreen onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Participant code");
    await user.type(input, "abc");
    await user.dblClick(screen.getByRole("button", { name: "Continue" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("abc");
  });

  it("does not accept more than 32 characters in the input", async () => {
    const user = userEvent.setup();
    render(<ParticipantCodeScreen onSubmit={vi.fn()} />);
    const input = screen.getByLabelText("Participant code") as HTMLInputElement;
    const longCode = "a".repeat(40);
    await user.type(input, longCode);
    expect(input.value.length).toBeLessThanOrEqual(32);
    expect(input.value).toHaveLength(32);
  });
});
