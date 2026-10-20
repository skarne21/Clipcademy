import { describe, expect, it, vi, beforeEach } from "vitest";
import type { LessonOutput } from "@/lib/schemas/lesson-output";
import { resetLlmProvider } from "@/lib/llm";
import { validateLessonOutput } from "./index";
import type { ValidatorContext } from "./types";

const baseOutput: LessonOutput = {
  lesson_id: "py-conditionals-01",
  learner_level: "beginner",
  explanation:
    "Conditionals in Python use if and else. Compare values before you branch on a boolean condition.",
  task: {
    prompt: 'Write grade_label(score) returning "pass" if score is at least 60, else "fail".',
    type: "code",
    function_name: "grade_label",
    starter_code: "def grade_label(score):\n    pass\n",
    visible_tests: [
      'assert grade_label(60) == "pass"',
      'assert grade_label(59) == "fail"',
    ],
    hidden_tests: ['assert grade_label(0) == "fail"', 'assert grade_label(100) == "pass"'],
  },
  hint_targets: ["missing_return"],
  follow_up: { lesson_id: "py-loops-for-01", reason: "Next up: loops." },
};

const context: ValidatorContext = {
  lesson: {
    id: "py-conditionals-01",
    topicTags: ["conditionals", "python"],
    lessonNotes: "If statements check conditions and run indented blocks.",
    learningGoal: "Write if/else branches.",
  },
  catalog: [
    { id: "py-conditionals-01", difficulty: "beginner" },
    { id: "py-loops-for-01", difficulty: "beginner" },
  ],
  learnerLevel: "beginner",
};

const passingSandbox = {
  runSandbox: vi.fn(async (input: { code: string; tests: string[] }) => {
    const isStarter = !input.code.includes("return");
    if (isStarter) {
      return {
        ok: false,
        status: "completed" as const,
        error: "failed",
        results: input.tests.map((_, index) => ({
          index,
          passed: false,
          stdout: "",
          error: "AssertionError",
        })),
      };
    }
    return {
      ok: true,
      status: "completed" as const,
      error: null,
      results: input.tests.map((_, index) => ({
        index,
        passed: true,
        stdout: "",
        error: null,
      })),
    };
  }),
  generateReference: vi.fn(async () => ({
    code: 'def grade_label(score):\n    return "pass" if score >= 60 else "fail"\n',
    usage: {
      model: "mock-ref",
      latencyMs: 1,
      inputTokens: 1,
      outputTokens: 1,
    },
  })),
};

describe("validateLessonOutput", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.LLM_PROVIDER = "mock";
    resetLlmProvider();
  });

  it("accepts a known-good output with mocked sandbox", async () => {
    const result = await validateLessonOutput(baseOutput, context, passingSandbox);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a nonexistent follow_up lesson", async () => {
    const bad = {
      ...baseOutput,
      follow_up: { lesson_id: "missing-lesson", reason: "nope" },
    };
    const result = await validateLessonOutput(bad, context, passingSandbox);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("not in the catalog"))).toBe(true);
  });

  it("allows on-topic content without the literal tag word conditionals", async () => {
    const output = {
      ...baseOutput,
      explanation:
        "Use an if branch when a score is at least 60. Otherwise use else for the fail path.",
    };
    const result = await validateLessonOutput(output, context, passingSandbox);
    expect(result.ok).toBe(true);
  });

  it("rejects off-topic explanations via the judge", async () => {
    const judge = await import("@/lib/llm");
    const spy = vi.spyOn(judge, "completeStructured").mockImplementation(async (options) => {
      if (options.schemaName === "judge_output") {
        return {
          data: { pass: false, reason: "Discusses decorators, not conditionals." },
          raw: {},
          model: "mock-judge",
          latencyMs: 1,
          inputTokens: 1,
          outputTokens: 1,
        };
      }
      return {
        data: {
          solution_code: 'def grade_label(score):\n    return "pass" if score >= 60 else "fail"\n',
        },
        raw: {},
        model: "mock-ref",
        latencyMs: 1,
        inputTokens: 1,
        outputTokens: 1,
      } as never;
    });

    const bad = {
      ...baseOutput,
      explanation: "Decorators wrap functions with @ syntax for metaprogramming.",
    };
    const result = await validateLessonOutput(bad, context, passingSandbox);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("judge failed"))).toBe(true);
    spy.mockRestore();
    resetLlmProvider();
  });

  it("rejects print-based reference solutions when tests assert return values", async () => {
    const printRefSandbox = {
      ...passingSandbox,
      generateReference: vi.fn(async () => ({
        code: "def grade_label(score):\n    print(score)\n    return 'pass'\n",
        usage: { model: "mock", latencyMs: 1, inputTokens: 1, outputTokens: 1 },
      })),
    };
    const result = await validateLessonOutput(baseOutput, context, printRefSandbox);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Task must return a value instead of printing");
    expect(printRefSandbox.generateReference).toHaveBeenCalled();
  });

  it("runs reference solutions wrapped in markdown code fences", async () => {
    const fencedSandbox = {
      ...passingSandbox,
      generateReference: vi.fn(async () => ({
        code: '```python\ndef grade_label(score):\n    return "pass" if score >= 60 else "fail"\n```',
        usage: { model: "mock", latencyMs: 1, inputTokens: 1, outputTokens: 1 },
      })),
    };
    const result = await validateLessonOutput(baseOutput, context, fencedSandbox);
    expect(result.ok).toBe(true);
  });

  it("rejects trivial tests when starter passes", async () => {
    const trivialSandbox = {
      ...passingSandbox,
      runSandbox: vi.fn(async () => ({
        ok: true,
        status: "completed",
        error: null,
        results: [{ index: 0, passed: true, stdout: "", error: null }],
      })),
    };
    const result = await validateLessonOutput(baseOutput, context, trivialSandbox);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("trivially passable"))).toBe(true);
  });
});
