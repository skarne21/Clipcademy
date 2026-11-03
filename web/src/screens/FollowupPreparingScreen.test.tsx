import type { ComponentProps } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FollowupPreparingScreen } from "./FollowupPreparingScreen";

function renderFollowupPreparing(
  overrides: Partial<ComponentProps<typeof FollowupPreparingScreen>> = {},
) {
  const props: ComponentProps<typeof FollowupPreparingScreen> = {
    videoStatus: "preparing",
    onRetryVideo: vi.fn(),
    onGoHome: vi.fn(),
    ...overrides,
  };
  render(<FollowupPreparingScreen {...props} />);
  return props;
}

describe("FollowupPreparingScreen", () => {
  it("shows a status message while preparing and no Try again button", () => {
    renderFollowupPreparing({ videoStatus: "preparing" });
    expect(screen.getByRole("heading", { name: "Preparing a short follow-up" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /short video focused on the last question/i,
    );
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("shows an alert, answer-saved line, and Try again when failed", async () => {
    const user = userEvent.setup();
    const { onRetryVideo } = renderFollowupPreparing({ videoStatus: "failed" });
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't be prepared/i);
    expect(screen.getByText(/answer is saved/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetryVideo).toHaveBeenCalledTimes(1);
  });

  it("calls onGoHome from Back to home in preparing and failed states", async () => {
    const user = userEvent.setup();

    const preparing = renderFollowupPreparing({ videoStatus: "preparing" });
    await user.click(screen.getByRole("button", { name: "Back to home" }));
    expect(preparing.onGoHome).toHaveBeenCalledTimes(1);

    cleanup();
    const failed = renderFollowupPreparing({ videoStatus: "failed" });
    await user.click(screen.getByRole("button", { name: "Back to home" }));
    expect(failed.onGoHome).toHaveBeenCalledTimes(1);
  });

  it("does not render question controls or answer feedback", () => {
    renderFollowupPreparing({ videoStatus: "preparing" });
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Correct" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Not quite" })).not.toBeInTheDocument();
  });
});
