import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LessonScreen } from "./LessonScreen";

function renderLesson(overrides: Partial<ComponentProps<typeof LessonScreen>> = {}) {
  const props: ComponentProps<typeof LessonScreen> = {
    title: "Synthesis direction and primer requirement",
    videoKind: "initial",
    videoStatus: "ready",
    videoUrl: "https://example.com/lesson.mp4",
    transcript: "DNA polymerase adds nucleotides to the 3 prime end.",
    sourceRefs: ["L19-p1", "L19-p2"],
    onVideoStarted: vi.fn(),
    onVideoCompleted: vi.fn(),
    onOpenQuestion: vi.fn(),
    onBack: vi.fn(),
    onRetryVideo: vi.fn(),
    ...overrides,
  };
  render(<LessonScreen {...props} />);
  return props;
}

describe("LessonScreen", () => {
  it("shows a preparing status and no video element while preparing", () => {
    renderLesson({ videoStatus: "preparing", videoUrl: undefined });
    expect(screen.getByRole("status")).toHaveTextContent("Preparing your video...");
    expect(screen.queryByLabelText("Lesson video")).not.toBeInTheDocument();
  });

  it("shows Try again on failure and calls onRetryVideo without a video element", async () => {
    const user = userEvent.setup();
    const { onRetryVideo } = renderLesson({ videoStatus: "failed", videoUrl: undefined });
    expect(screen.queryByLabelText("Lesson video")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetryVideo).toHaveBeenCalledTimes(1);
  });

  it("shows the video, transcript, and formatted sources when ready", () => {
    renderLesson();
    const video = screen.getByLabelText("Lesson video");
    expect(video).toHaveAttribute("src", "https://example.com/lesson.mp4");
    expect(screen.getByText("DNA polymerase adds nucleotides to the 3 prime end.")).toBeInTheDocument();
    expect(screen.getByText("Lecture 19, p. 1; Lecture 19, p. 2")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Transcript" })).toBeInTheDocument();
  });

  it("shows the follow-up line for followup clips but not for initial lessons", () => {
    renderLesson({ videoKind: "followup" });
    expect(
      screen.getByText(/short clip focuses on the idea from the last question/i),
    ).toBeInTheDocument();

    cleanup();
    renderLesson({ videoKind: "initial" });
    expect(
      screen.queryByText(/short clip focuses on the idea from the last question/i),
    ).not.toBeInTheDocument();
  });

  it("calls onVideoStarted only once across multiple play events", () => {
    const { onVideoStarted } = renderLesson();
    const video = screen.getByLabelText("Lesson video");
    fireEvent.play(video);
    fireEvent.play(video);
    expect(onVideoStarted).toHaveBeenCalledTimes(1);
  });

  it("calls onVideoCompleted only once across multiple ended events", () => {
    const { onVideoCompleted } = renderLesson();
    const video = screen.getByLabelText("Lesson video");
    fireEvent.ended(video);
    fireEvent.ended(video);
    expect(onVideoCompleted).toHaveBeenCalledTimes(1);
  });

  it("calls onVideoStarted and onVideoCompleted again when videoUrl changes", () => {
    const onVideoStarted = vi.fn();
    const onVideoCompleted = vi.fn();
    const shared: Omit<
      ComponentProps<typeof LessonScreen>,
      "videoUrl" | "onVideoStarted" | "onVideoCompleted"
    > = {
      title: "Synthesis direction and primer requirement",
      videoKind: "initial",
      videoStatus: "ready",
      onOpenQuestion: vi.fn(),
      onBack: vi.fn(),
      onRetryVideo: vi.fn(),
    };

    const { rerender } = render(
      <LessonScreen
        {...shared}
        videoUrl="https://example.com/first.mp4"
        onVideoStarted={onVideoStarted}
        onVideoCompleted={onVideoCompleted}
      />,
    );
    let video = screen.getByLabelText("Lesson video");
    fireEvent.play(video);
    fireEvent.ended(video);

    rerender(
      <LessonScreen
        {...shared}
        videoUrl="https://example.com/second.mp4"
        onVideoStarted={onVideoStarted}
        onVideoCompleted={onVideoCompleted}
      />,
    );
    video = screen.getByLabelText("Lesson video");
    fireEvent.play(video);
    fireEvent.ended(video);

    expect(onVideoStarted).toHaveBeenCalledTimes(2);
    expect(onVideoCompleted).toHaveBeenCalledTimes(2);
  });

  it("disables Answer question while preparing or failed and enables it when ready", async () => {
    const user = userEvent.setup();
    renderLesson({ videoStatus: "preparing" });
    expect(screen.getByRole("button", { name: "Answer question" })).toBeDisabled();

    cleanup();
    renderLesson({ videoStatus: "failed" });
    expect(screen.getByRole("button", { name: "Answer question" })).toBeDisabled();

    cleanup();
    const { onOpenQuestion } = renderLesson({ videoStatus: "ready" });
    const answerButton = screen.getByRole("button", { name: "Answer question" });
    expect(answerButton).toBeEnabled();
    await user.click(answerButton);
    expect(onOpenQuestion).toHaveBeenCalledTimes(1);
  });

  it("calls onBack from preparing, failed, and ready states", async () => {
    const user = userEvent.setup();

    const preparing = renderLesson({ videoStatus: "preparing" });
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(preparing.onBack).toHaveBeenCalledTimes(1);

    cleanup();
    const failed = renderLesson({ videoStatus: "failed" });
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(failed.onBack).toHaveBeenCalledTimes(1);

    cleanup();
    const ready = renderLesson({ videoStatus: "ready" });
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(ready.onBack).toHaveBeenCalledTimes(1);
  });

  it("shows clipOriginLabel only when provided", () => {
    renderLesson({ clipOriginLabel: "Pre-rendered clip" });
    expect(screen.getByText("Pre-rendered clip")).toBeInTheDocument();

    cleanup();
    renderLesson({ clipOriginLabel: undefined });
    expect(screen.queryByText("Pre-rendered clip")).not.toBeInTheDocument();
  });
});
