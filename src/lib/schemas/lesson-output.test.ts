import { describe, expect, it } from "vitest";
import { lessonOutputSchema } from "./lesson-output";

const valid = {
  lesson_id: "py-conditionals-01",
  learner_level: "beginner",
  explanation: "Short explanation of if statements.",
  task: {
    prompt: "Write grade_label(score).",
    type: "code",
    function_name: "grade_label",
    starter_code: "def grade_label(score):\n    pass\n",
    visible_tests: ['assert grade_label(60) == "pass"'],
    hidden_tests: ['assert grade_label(0) == "fail"'],
  },
  hint_targets: ["missing_return"],
  follow_up: { lesson_id: "py-loops-for-01", reason: "Next topic." },
};

describe("lessonOutputSchema", () => {
  it("accepts valid output", () => {
    const parsed = lessonOutputSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("rejects missing fields", () => {
    const rest = { ...valid };
    delete (rest as { explanation?: string }).explanation;
    const parsed = lessonOutputSchema.safeParse(rest);
    expect(parsed.success).toBe(false);
  });

  it("rejects extra fields", () => {
    const parsed = lessonOutputSchema.safeParse({
      ...valid,
      reference_solution: "def grade_label(score): return 'pass'",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects wrong types", () => {
    const parsed = lessonOutputSchema.safeParse({
      ...valid,
      learner_level: "expert",
    });
    expect(parsed.success).toBe(false);
  });
});
