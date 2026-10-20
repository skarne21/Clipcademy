import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EDITOR_CHAR_LIMIT } from "@/lib/editor/draft-storage";
import { TaskEditor } from "./TaskEditor";

vi.mock("next/dynamic", () => ({
  default: () => {
    function MockCodeEditor({
      value,
      onChange,
      onAtCharLimit,
    }: {
      value: string;
      onChange: (v: string) => void;
      onAtCharLimit?: () => void;
    }) {
      return (
        <textarea
          data-testid="code-editor-mock"
          aria-label="Practice code editor"
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            if (next.length > EDITOR_CHAR_LIMIT) {
              onAtCharLimit?.();
              return;
            }
            onChange(next);
          }}
        />
      );
    }
    return MockCodeEditor;
  },
}));

const baseProps = {
  lessonId: "py-conditionals-01",
  starterCode: "def grade_label(score):\n    pass\n",
  taskPrompt: "Write grade_label",
  functionName: "grade_label",
};

describe("TaskEditor", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("prefills starter code", async () => {
    render(<TaskEditor {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByTestId("code-editor-mock")).toHaveValue(baseProps.starterCode);
    });
  });

  it("resets to starter after confirm", async () => {
    const user = userEvent.setup();
    render(<TaskEditor {...baseProps} />);
    const field = await screen.findByTestId("code-editor-mock");
    await user.clear(field);
    await user.type(field, "def grade_label(score):\n    return 'pass'\n");
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(window.confirm).toHaveBeenCalled();
    expect(screen.getByTestId("code-editor-mock")).toHaveValue(baseProps.starterCode);
  });

  it("restores draft after remount for the same task", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TaskEditor {...baseProps} />);
    const field = await screen.findByTestId("code-editor-mock");
    await user.clear(field);
    await user.type(field, "draft code");
    unmount();
    cleanup();
    render(<TaskEditor {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByTestId("code-editor-mock")).toHaveValue("draft code");
    });
  });

  it("starts fresh when task identity changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TaskEditor {...baseProps} />);
    const field = await screen.findByTestId("code-editor-mock");
    await user.clear(field);
    await user.type(field, "draft code");
    const newStarter = "def other():\n    pass\n";
    rerender(
      <TaskEditor
        {...baseProps}
        starterCode={newStarter}
        functionName="other"
        taskPrompt="Other task"
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("code-editor-mock")).toHaveValue(newStarter);
    });
  });

  it("shows character limit message", async () => {
    render(<TaskEditor {...baseProps} />);
    const field = await screen.findByTestId("code-editor-mock");
    fireEvent.change(field, { target: { value: "x".repeat(EDITOR_CHAR_LIMIT + 1) } });
    expect(await screen.findByRole("status")).toHaveTextContent(/character limit/i);
  });

  it("exposes submit callback and disables grading button", async () => {
    const onSubmit = vi.fn();
    render(<TaskEditor {...baseProps} onSubmit={onSubmit} />);
    const submit = screen.getByRole("button", { name: "Grading coming soon" });
    expect(submit).toBeDisabled();
  });
});
