/** Normalize model-produced Python before sandbox execution. */
export function normalizePythonSource(raw: string): string {
  let code = raw.trim();

  const fenced = /^```(?:python)?\s*\n?([\s\S]*?)\n?```\s*$/i.exec(code);
  if (fenced) {
    code = fenced[1].trim();
  }

  const defIndex = code.search(/^(def |class |import |from )/m);
  if (defIndex > 0) {
    code = code.slice(defIndex).trim();
  }

  return code;
}

/** Normalize a single assert test string from model output. */
export function normalizePythonTest(raw: string): string {
  let line = raw.trim();

  const fenced = /^```(?:python)?\s*\n?([\s\S]*?)\n?```\s*$/i.exec(line);
  if (fenced) {
    line = fenced[1].trim();
  }

  line = line.replace(/^\s*[-*]\s+/, "");
  line = line.replace(/^\d+\.\s*/, "");

  const firstLine = line.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? line;
  line = firstLine;

  const assertStart = line.search(/\bassert\s+/i);
  if (assertStart > 0) {
    line = line.slice(assertStart).trim();
  }

  return line;
}

export function isAssertTest(line: string): boolean {
  const trimmed = line.trim();
  return /^assert\s+/i.test(trimmed) || /^assert\s+raises\s*\(/i.test(trimmed);
}

export const RAISES_TEST_USAGE_HINT =
  "Exception tests must use the sandbox helper: assert raises(IndexError, function_name, arg1, arg2)";

const INVALID_ASSERT_TRAILING_RAISES = /^assert\s+.+\braises\s+[A-Za-z_]/i;
const VALID_ASSERT_RAISES = /^assert\s+raises\s*\(/i;

export type PreparedTests = {
  normalized: string[];
  errors: string[];
};

/** Validate and normalize all task tests before sandbox runs. */
export function prepareLessonTests(rawTests: string[]): PreparedTests {
  const normalized: string[] = [];
  const errors: string[] = [];

  rawTests.forEach((raw, index) => {
    const testNumber = index + 1;
    const line = normalizePythonTest(raw);
    if (!line) {
      errors.push(`Test ${testNumber} is not valid Python: ${raw}`);
      normalized.push(raw);
      return;
    }
    if (INVALID_ASSERT_TRAILING_RAISES.test(line) && !VALID_ASSERT_RAISES.test(line)) {
      errors.push(`Test ${testNumber} is not valid Python: ${raw}. ${RAISES_TEST_USAGE_HINT}`);
    } else if (!isAssertTest(line)) {
      errors.push(`Test ${testNumber} is not valid Python: ${raw}`);
    }
    if (line.includes("\n")) {
      errors.push(
        `Test ${testNumber} must be a single line; got multi-line: ${raw.replace(/\n/g, " ")}`,
      );
    }
    normalized.push(line);
  });

  return { normalized, errors };
}

/** True when tests compare the function's return value (typical assert grading). */
export function testsAssertReturnValue(tests: string[]): boolean {
  return tests.some((raw) => {
    const line = normalizePythonTest(raw);
    if (!isAssertTest(line)) return false;
    return /\s==\s/.test(line) || /\s!=\s/.test(line) || /\sis\snot\s/.test(line);
  });
}

export function pythonCodeUsesPrint(code: string): boolean {
  const normalized = normalizePythonSource(code);
  return /\bprint\s*\(/.test(normalized);
}

const PRINT_TASK_PROMPT =
  /\bprint\s*\(|\bprints?\b|\bprinting\b|should print|use print/i;

/** Fail when return-value asserts are paired with print-based task wording or code. */
export function validateReturnValueTaskSemantics(options: {
  taskPrompt: string;
  tests: string[];
  referenceCode?: string;
}): string[] {
  if (!testsAssertReturnValue(options.tests)) return [];

  const promptSuggestsPrint = PRINT_TASK_PROMPT.test(options.taskPrompt);
  const referenceUsesPrint =
    Boolean(options.referenceCode) && pythonCodeUsesPrint(options.referenceCode!);
  if (promptSuggestsPrint || referenceUsesPrint) {
    return ["Task must return a value instead of printing"];
  }
  return [];
}

/** Add revision hints for common test syntax mistakes. */
export function enrichValidationErrorsForRevision(errors: string[]): string[] {
  const out = [...errors];
  const needsRaisesHint = errors.some(
    (e) =>
      (/\braises\b/i.test(e) && /not valid Python/i.test(e)) ||
      INVALID_ASSERT_TRAILING_RAISES.test(e),
  );
  if (needsRaisesHint && !out.some((e) => e.includes("assert raises("))) {
    out.push(RAISES_TEST_USAGE_HINT);
  }
  return out;
}
