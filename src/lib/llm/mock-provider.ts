import { readFileSync } from "fs";
import { join } from "path";
import type { z } from "zod";
import { LlmStructuredOutputError } from "./errors";
import type {
  LlmProvider,
  LlmTextResult,
  StructuredCompletionContext,
  StructuredCompletionResult,
} from "./types";

const FIXTURE_PATH = join(process.cwd(), "src/lib/llm/fixtures/generate-lesson.json");

const REFERENCE_SOLUTIONS: Record<string, string> = {
  grade_label: 'def grade_label(score):\n    return "pass" if score >= 60 else "fail"\n',
  halve_until_one:
    "def halve_until_one(n):\n    count = 0\n    while n > 1:\n        n //= 2\n        count += 1\n    return count\n",
  count_positive:
    "def count_positive(numbers):\n    return sum(1 for n in numbers if n > 0)\n",
};

function loadFixture(): Record<string, unknown> {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf-8")) as Record<string, unknown>;
}

function referenceSolutionForPrompt(user: string): string {
  const fnMatch = /Function name:\s*(\w+)/.exec(user);
  const fn = fnMatch?.[1] ?? "grade_label";
  return REFERENCE_SOLUTIONS[fn] ?? REFERENCE_SOLUTIONS.grade_label;
}

function structuredPayload(
  schemaName: string,
  context?: StructuredCompletionContext,
  user?: string,
): Record<string, unknown> {
  if (schemaName === "judge_output") {
    return { pass: true, reason: "" };
  }
  if (schemaName === "reference_solution") {
    return {
      solution_code: referenceSolutionForPrompt(user ?? ""),
    };
  }

  const rawFixture = loadFixture();
  if (context?.lessonId) {
    rawFixture.lesson_id = context.lessonId;
  }
  return rawFixture;
}

export class MockLlmProvider implements LlmProvider {
  readonly name = "mock";

  async completeText(options: {
    system: string;
    user: string;
    model?: string;
    maxTokens?: number;
    timeoutMs?: number;
  }): Promise<LlmTextResult> {
    return {
      text: `Mock lesson notes generated for prompt (${options.user.length} chars).`,
      model: options.model ?? "mock-text",
      latencyMs: 1,
      inputTokens: 10,
      outputTokens: 20,
    };
  }

  async completeStructured<T>(options: {
    schema: z.ZodType<T>;
    schemaName: string;
    system: string;
    user: string;
    model?: string;
    maxTokens?: number;
    timeoutMs?: number;
    context?: StructuredCompletionContext;
  }): Promise<StructuredCompletionResult<T>> {
    const rawFixture = structuredPayload(options.schemaName, options.context, options.user);

    const parsed = options.schema.safeParse(rawFixture);
    if (!parsed.success) {
      throw new LlmStructuredOutputError(
        "Mock fixture does not match schema",
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      );
    }

    return {
      data: parsed.data,
      raw: rawFixture,
      model: options.model ?? `mock-${options.schemaName}`,
      latencyMs: 2,
      inputTokens: 50,
      outputTokens: 120,
    };
  }
}
