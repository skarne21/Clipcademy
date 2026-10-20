import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Lesson } from "@prisma/client";
import * as validator from "@/lib/validator";

vi.mock("@/lib/db", () => ({
  prisma: {
    lesson: {
      findMany: vi.fn().mockResolvedValue([
        { id: "py-conditionals-01", difficulty: "beginner" },
        { id: "py-loops-for-01", difficulty: "beginner" },
      ]),
    },
    generationLog: {
      create: vi.fn().mockResolvedValue({ id: "test-log-id" }),
    },
  },
}));

import { runCorrectionLoop } from "./correction-loop";

const lesson = {
  id: "py-conditionals-01",
  title: "If statements",
  videoUrl: "https://example.com",
  youtubeId: "x",
  videoTitle: null,
  videoChannel: null,
  videoDuration: null,
  videoDurationSeconds: null,
  lessonNotes: "If statements check conditions.",
  lessonNotesNeedsReview: false,
  topicTags: ["conditionals", "python"],
  difficulty: "beginner",
  learningGoal: "Use if.",
  fallbackExplanation: "fallback",
  fallbackTask: {},
  sortOrder: 1,
} as Lesson;

describe("runCorrectionLoop", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.LLM_PROVIDER = "mock";
    process.env.GENERATION_MAX_RETRIES = "2";
  });

  it("passes on first try when validation succeeds", async () => {
    vi.spyOn(validator, "validateLessonOutput").mockResolvedValue({
      ok: true,
      errors: [],
      llmCalls: [],
    });

    const result = await runCorrectionLoop({
      lesson,
      learnerLevel: "beginner",
      recentHistory: [],
      subjectRules: {
        subjectId: "python-beginner",
        tone: "",
        explanationMaxChars: 1200,
        taskPromptMaxChars: 600,
        gradingMethod: "",
        outputFormat: "",
        catalogLessonIds: ["py-conditionals-01", "py-loops-for-01"],
      },
      userId: null,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.lesson_id).toBe("py-conditionals-01");
    }
  });

  it("retries after validation failure then passes", async () => {
    const validate = vi
      .spyOn(validator, "validateLessonOutput")
      .mockResolvedValueOnce({ ok: false, errors: ["test 2 fails on an empty list"], llmCalls: [] })
      .mockResolvedValueOnce({ ok: true, errors: [], llmCalls: [] });

    const result = await runCorrectionLoop({
      lesson,
      learnerLevel: "beginner",
      recentHistory: [],
      subjectRules: {
        subjectId: "python-beginner",
        tone: "",
        explanationMaxChars: 1200,
        taskPromptMaxChars: 600,
        gradingMethod: "",
        outputFormat: "",
        catalogLessonIds: ["py-conditionals-01"],
      },
      userId: null,
    });

    expect(validate).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it("stops retrying when validation errors repeat", async () => {
    const validate = vi.spyOn(validator, "validateLessonOutput").mockResolvedValue({
      ok: false,
      errors: ["test 2 fails on an empty list"],
      llmCalls: [],
    });

    const result = await runCorrectionLoop({
      lesson,
      learnerLevel: "beginner",
      recentHistory: [],
      subjectRules: {
        subjectId: "python-beginner",
        tone: "",
        explanationMaxChars: 1200,
        taskPromptMaxChars: 600,
        gradingMethod: "",
        outputFormat: "",
        catalogLessonIds: ["py-conditionals-01"],
      },
      userId: null,
    });

    expect(validate).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(false);
  });

  it("falls through after max retries", async () => {
    vi.spyOn(validator, "validateLessonOutput")
      .mockResolvedValueOnce({ ok: false, errors: ["failure attempt 1"], llmCalls: [] })
      .mockResolvedValueOnce({ ok: false, errors: ["failure attempt 2"], llmCalls: [] })
      .mockResolvedValueOnce({ ok: false, errors: ["failure attempt 3"], llmCalls: [] });

    const result = await runCorrectionLoop({
      lesson,
      learnerLevel: "beginner",
      recentHistory: [],
      subjectRules: {
        subjectId: "python-beginner",
        tone: "",
        explanationMaxChars: 1200,
        taskPromptMaxChars: 600,
        gradingMethod: "",
        outputFormat: "",
        catalogLessonIds: ["py-conditionals-01"],
      },
      userId: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("failure attempt 3");
    }
  });
});
