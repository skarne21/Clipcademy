import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { buildGenerationPrompts } from "./build-context";
import { getStubLearnerLevel, getStubRecentHistory } from "./learner-stub";
import { createPythonBeginnerRules } from "@/lib/subject-rules/python-beginner";
import { completeStructured, resetLlmProvider } from "@/lib/llm";
import { lessonOutputSchema } from "@/lib/schemas/lesson-output";

describe("buildGenerationPrompts", () => {
  it("includes all four inputs in the built prompts", () => {
    const subjectRules = createPythonBeginnerRules([
      "py-conditionals-01",
      "py-loops-for-01",
    ]);

    const prompts = buildGenerationPrompts({
      lesson: {
        id: "py-conditionals-01",
        title: "If statements in Python",
        topicTags: ["conditionals", "python"],
        difficulty: "beginner",
        learningGoal: "Write if/else branches.",
        lessonNotes: "If runs when the condition is True.",
      },
      learnerLevel: getStubLearnerLevel(),
      recentHistory: getStubRecentHistory(),
      subjectRules,
    });

    expect(prompts.promptVersion).toBe("v1");
    expect(prompts.system).toContain("1200");
    expect(prompts.user).toContain("py-conditionals-01");
    expect(prompts.user).toContain("If statements in Python");
    expect(prompts.user).toContain("conditionals");
    expect(prompts.user).toContain("Write if/else branches.");
    expect(prompts.user).toContain("If runs when the condition is True.");
    expect(prompts.user).toContain("beginner");
    expect(prompts.user).toContain("(none yet)");
    expect(prompts.user).toContain("python-beginner");
    expect(prompts.user).toContain("py-loops-for-01");
  });
});

describe("mock LLM structured generation", () => {
  const prevProvider = process.env.LLM_PROVIDER;

  beforeEach(() => {
    process.env.LLM_PROVIDER = "mock";
    resetLlmProvider();
  });

  afterEach(() => {
    process.env.LLM_PROVIDER = prevProvider;
    resetLlmProvider();
  });

  it("returns fixture JSON that passes the schema", async () => {
    const prompts = buildGenerationPrompts({
      lesson: {
        id: "py-conditionals-01",
        title: "If statements",
        topicTags: ["conditionals"],
        difficulty: "beginner",
        learningGoal: "Use if.",
        lessonNotes: "Notes.",
      },
      learnerLevel: "beginner",
      recentHistory: [],
      subjectRules: createPythonBeginnerRules(["py-conditionals-01"]),
    });

    const result = await completeStructured({
      schema: lessonOutputSchema,
      schemaName: "lesson_output",
      system: prompts.system,
      user: prompts.user,
      context: { lessonId: "py-conditionals-01" },
    });

    expect(result.data.lesson_id).toBe("py-conditionals-01");
    expect(result.data.task.hidden_tests.length).toBeGreaterThan(0);
  });
});
