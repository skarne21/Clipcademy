import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it, vi } from "vitest";
import type { LessonOutput } from "@/lib/schemas/lesson-output";
import { validatePython } from "./python";
import type { ValidatorContext } from "./types";

const fixtures = JSON.parse(
  readFileSync(join(__dirname, "fixtures/malformed-openai-tests.json"), "utf-8"),
) as Record<
  string,
  {
    visible_tests: string[];
    hidden_tests: string[];
    referenceSolution: string;
    function_name: string;
    starter_code: string;
  }
>;

const catalog: ValidatorContext["catalog"] = [
  { id: "py-loops-range-01", difficulty: "beginner" },
  { id: "py-loops-while-01", difficulty: "beginner" },
  { id: "py-loops-for-01", difficulty: "beginner" },
];

function outputFor(lessonId: string): LessonOutput {
  const f = fixtures[lessonId];
  return {
    lesson_id: lessonId,
    learner_level: "beginner",
    explanation: "Loops lesson explanation with while and range keywords.",
    task: {
      type: "code",
      prompt: "Write a function for the lesson.",
      function_name: f.function_name,
      starter_code: f.starter_code,
      visible_tests: f.visible_tests,
      hidden_tests: f.hidden_tests,
    },
    hint_targets: ["other"],
    follow_up: { lesson_id: "py-loops-for-01", reason: "Next lesson." },
  };
}

const noopSandbox = {
  runSandbox: vi.fn(),
  generateReference: vi.fn(async () => ({
    code: fixtures["py-loops-while-01"].referenceSolution,
    usage: { model: "mock", latencyMs: 1, inputTokens: 1, outputTokens: 1 },
  })),
};

describe("real OpenAI malformed test fixtures", () => {
  it("py-loops-while-01 prose tests fail before sandbox with clear errors", async () => {
    const result = await validatePython(outputFor("py-loops-while-01"), {
      lesson: {
        id: "py-loops-while-01",
        topicTags: ["while", "loops"],
        lessonNotes: "While loops",
        learningGoal: "Use while",
      },
      catalog,
      learnerLevel: "beginner",
    }, noopSandbox);

    expect(result.ok).toBe(false);
    expect(noopSandbox.runSandbox).not.toHaveBeenCalled();
    expect(noopSandbox.generateReference).not.toHaveBeenCalled();
    expect(result.errors[0]).toMatch(/Test 1 is not valid Python:/);
    expect(result.errors[0]).toContain("countdown(3) should print");
    expect(
      result.errors.some((e) => e.includes("Reference solution: test 1 failed")),
    ).toBe(false);
  });

  it("py-loops-range-01 prose visible tests fail with clear errors", async () => {
    noopSandbox.runSandbox.mockClear();
    noopSandbox.generateReference.mockClear();

    const result = await validatePython(outputFor("py-loops-range-01"), {
      lesson: {
        id: "py-loops-range-01",
        topicTags: ["range", "loops"],
        lessonNotes: "range()",
        learningGoal: "Use range",
      },
      catalog,
      learnerLevel: "beginner",
    }, noopSandbox);

    expect(result.ok).toBe(false);
    expect(noopSandbox.runSandbox).not.toHaveBeenCalled();
    expect(result.errors.some((e) => e.match(/Test 1 is not valid Python:/))).toBe(true);
    expect(result.errors.some((e) => e.includes("should print the action"))).toBe(true);
  });
});
