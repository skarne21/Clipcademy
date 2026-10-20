import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { isAssertTest, normalizePythonTest, testsAssertReturnValue } from "./python-code";

type SeedLesson = {
  id: string;
  fallbackTask: {
    prompt: string;
    visible_tests: string[];
    hidden_tests: string[];
  };
};

describe("lessons.seed.json fallback tasks", () => {
  const seed = JSON.parse(
    readFileSync(join(process.cwd(), "data/lessons.seed.json"), "utf-8"),
  ) as { lessons: SeedLesson[] };

  it("uses return-value asserts and no print-based prompts", () => {
    for (const lesson of seed.lessons) {
      const task = lesson.fallbackTask;
      const tests = [...task.visible_tests, ...task.hidden_tests];

      expect(task.prompt.toLowerCase()).not.toMatch(/\bprint\s*\(/);
      expect(task.prompt).not.toMatch(/should print/i);

      for (const raw of tests) {
        const line = normalizePythonTest(raw);
        expect(isAssertTest(line), `${lesson.id}: ${raw}`).toBe(true);
      }

      expect(testsAssertReturnValue(tests), `${lesson.id} tests compare return values`).toBe(true);
    }
  });
});
