import type { LessonOutput } from "@/lib/schemas/lesson-output";
import { referenceSolutionSchema } from "@/lib/schemas/reference-solution";
import { loadPromptTemplate, renderTemplate } from "@/lib/prompts/load-prompt";
import {
  completeStructured,
  getGenerationMaxTokens,
  getGenerationModel,
  getLlmTimeoutMs,
} from "@/lib/llm";
import { runPythonInSandbox, type SandboxRunResult } from "@/lib/sandbox";
import type { LlmUsage } from "@/lib/llm/types";
import {
  normalizePythonSource,
  prepareLessonTests,
  validateReturnValueTaskSemantics,
} from "@/lib/validator/python-code";
import type { ValidatorContext, ValidationResult } from "./types";

const EDGE_CASE_PATTERNS = [
  /\[\s*\]/,
  /==\s*0\b/,
  /<\s*=\s*0\b/,
  /\(0\)/,
  /empty/i,
  /len\([^)]*\)\s*==\s*0/,
];

function formatTestFailures(result: SandboxRunResult, label: string): string[] {
  if (result.status === "syntax_error") {
    return [`${label}: ${result.error ?? "invalid Python"}`];
  }
  if (result.status === "test_syntax_error") {
    const fromResults = result.results
      .filter((t) => !t.passed && t.error)
      .map((t) => t.error as string);
    if (fromResults.length > 0) return fromResults;
    return [result.error ?? `${label}: invalid test syntax`];
  }
  if (result.status === "timeout") {
    return [`${label}: ${result.error ?? "execution timed out"}`];
  }
  const errors: string[] = [];
  for (const test of result.results) {
    if (!test.passed) {
      errors.push(
        `${label}: test ${test.index + 1} failed${test.error ? ` — ${test.error}` : ""}`,
      );
    }
  }
  return errors;
}

function referenceSyntaxErrorMessage(result: SandboxRunResult, code: string): string {
  if (result.error?.includes(":")) {
    return `Reference solution has a syntax error. ${result.error}\nFull code:\n${code}`;
  }
  return `Reference solution has a syntax error. Code:\n${code}`;
}

async function validateReferenceSolution(
  code: string,
  tests: string[],
  runSandbox: typeof runPythonInSandbox,
  taskPrompt: string,
): Promise<{ errors: string[]; result?: SandboxRunResult }> {
  const normalized = normalizePythonSource(code);

  const returnSemantics = validateReturnValueTaskSemantics({
    taskPrompt,
    tests,
    referenceCode: normalized,
  });
  if (returnSemantics.length > 0) {
    return { errors: returnSemantics };
  }

  const syntaxOnly = await runSandbox({ code: normalized, tests: [] });
  if (syntaxOnly.status === "syntax_error") {
    return {
      errors: [referenceSyntaxErrorMessage(syntaxOnly, normalized)],
    };
  }

  const refRun = await runSandbox({ code: normalized, tests });
  if (refRun.status === "syntax_error") {
    return {
      errors: [referenceSyntaxErrorMessage(refRun, normalized)],
      result: refRun,
    };
  }
  if (refRun.status === "test_syntax_error") {
    return { errors: formatTestFailures(refRun, "Reference solution"), result: refRun };
  }

  const failures = formatTestFailures(refRun, "Reference solution");
  return { errors: failures, result: refRun };
}

function hasEdgeCaseTest(tests: string[]): boolean {
  return tests.some((t) => EDGE_CASE_PATTERNS.some((p) => p.test(t)));
}

function extractBoundaryLiterals(prompt: string): number[] {
  const matches = prompt.match(/\b\d+\b/g) ?? [];
  const nums = [...new Set(matches.map((m) => Number(m)))].filter((n) => !Number.isNaN(n));
  return nums.filter((n) => [0, 1, 18, 60, 100].includes(n) || n <= 3);
}

function hasBoundaryTest(tests: string[], prompt: string): boolean {
  const literals = extractBoundaryLiterals(prompt);
  if (literals.length === 0) return true;
  return tests.some((t) => literals.some((n) => t.includes(String(n))));
}

function validateFollowUp(output: LessonOutput, context: ValidatorContext): string[] {
  const errors: string[] = [];
  const follow = context.catalog.find((c) => c.id === output.follow_up.lesson_id);
  if (!follow) {
    errors.push(`follow_up.lesson_id "${output.follow_up.lesson_id}" is not in the catalog`);
    return errors;
  }

  const order = { beginner: 0, intermediate: 1 };
  if (order[follow.difficulty] > order[context.learnerLevel]) {
    errors.push(
      `follow_up lesson ${follow.id} is ${follow.difficulty}, which is above learner level ${context.learnerLevel}`,
    );
  }
  return errors;
}

async function generateReferenceSolution(
  output: LessonOutput,
): Promise<{ code: string; usage: LlmUsage }> {
  const rawTests = [...output.task.visible_tests, ...output.task.hidden_tests];
  const { normalized } = prepareLessonTests(rawTests);
  const system = loadPromptTemplate("reference-solution.system.txt");
  const user = renderTemplate(loadPromptTemplate("reference-solution.user.txt"), {
    function_name: output.task.function_name,
    task_prompt: output.task.prompt,
    starter_code: output.task.starter_code,
    tests: normalized.join("\n"),
  });

  const result = await completeStructured({
    schema: referenceSolutionSchema,
    schemaName: "reference_solution",
    system,
    user,
    model: getGenerationModel(),
    maxTokens: getGenerationMaxTokens(),
    timeoutMs: getLlmTimeoutMs(),
  });

  return { code: result.data.solution_code, usage: result };
}

export type PythonValidatorDeps = {
  runSandbox: typeof runPythonInSandbox;
  generateReference: typeof generateReferenceSolution;
};

const defaultDeps: PythonValidatorDeps = {
  runSandbox: runPythonInSandbox,
  generateReference: generateReferenceSolution,
};

export async function validatePython(
  output: LessonOutput,
  context: ValidatorContext,
  deps: PythonValidatorDeps = defaultDeps,
): Promise<ValidationResult> {
  const llmCalls: LlmUsage[] = [];
  const errors: string[] = [];

  const followUpErrors = validateFollowUp(output, context);
  errors.push(...followUpErrors);

  const rawAllTests = [...output.task.visible_tests, ...output.task.hidden_tests];
  const prepared = prepareLessonTests(rawAllTests);
  const allTests = prepared.normalized;
  errors.push(...prepared.errors);

  if (followUpErrors.length > 0 || prepared.errors.length > 0) {
    return { ok: false, errors, llmCalls };
  }

  errors.push(
    ...validateReturnValueTaskSemantics({
      taskPrompt: output.task.prompt,
      tests: allTests,
    }),
  );
  if (errors.length > 0) {
    return { ok: false, errors, llmCalls };
  }

  if (!hasEdgeCaseTest(allTests)) {
    errors.push("Tests must include at least one edge case (e.g. empty list or zero)");
  }
  if (!hasBoundaryTest(allTests, output.task.prompt)) {
    errors.push(
      "Tests must include at least one boundary value from the task prompt (e.g. 0, 18, 60)",
    );
  }

  const starterRun = await deps.runSandbox({
    code: output.task.starter_code,
    tests: allTests,
  });
  if (starterRun.status === "test_syntax_error") {
    errors.push(...formatTestFailures(starterRun, "Starter code run"));
    return { ok: false, errors, llmCalls };
  }
  const starterPassesAll =
    starterRun.status === "completed" && starterRun.results.every((r) => r.passed);
  if (starterPassesAll) {
    errors.push("Starter code passes all tests; tests must not be trivially passable");
  }

  let referenceCode: string | null = null;
  try {
    const ref = await deps.generateReference(output);
    referenceCode = ref.code;
    llmCalls.push(ref.usage);
  } catch (error) {
    errors.push(
      error instanceof Error
        ? `Reference solution generation failed: ${error.message}`
        : "Reference solution generation failed",
    );
    return { ok: false, errors, llmCalls };
  }

  let refValidation = await validateReferenceSolution(
    referenceCode,
    allTests,
    deps.runSandbox,
    output.task.prompt,
  );
  if (refValidation.errors.length > 0) {
    try {
      const retry = await deps.generateReference(output);
      llmCalls.push(retry.usage);
      referenceCode = retry.code;
      refValidation = await validateReferenceSolution(
        referenceCode,
        allTests,
        deps.runSandbox,
        output.task.prompt,
      );
    } catch {
      // keep first validation errors
    }
  }

  errors.push(...refValidation.errors);

  return { ok: errors.length === 0, errors, llmCalls };
}
