const PYTHON_BEGINNER_RULES_BASE = {
  subjectId: "python-beginner",
  tone: "Friendly, concise, and encouraging. No jargon without a one-line explanation.",
  explanationMaxChars: 1200,
  taskPromptMaxChars: 600,
  gradingMethod:
    "Python code tasks are graded by running assert statements on the function's return value in an isolated sandbox. " +
    "Every task must ask the learner to return a result (never use print() for the answer). " +
    "Tests must call the learner's function by name and compare the returned value, or use assert raises(ExcType, fn, *args) for expected exceptions.",
  outputFormat:
    "Return JSON only. The task must include visible_tests (shown to the learner) and " +
    "hidden_tests (server-only). Each test is one line starting with assert. " +
    "For exceptions use assert raises(ExcType, fn, *args) (raises is built into the sandbox). " +
    "The function must return a value tested with assert (e.g. assert foo(0) == []). " +
    "Do not assign print-based tasks; prefer returning a list, string, number, or tuple. " +
    "Include at least one edge case across all tests.",
} as const;

export const PYTHON_BEGINNER_LIMITS = {
  explanationMaxChars: PYTHON_BEGINNER_RULES_BASE.explanationMaxChars,
  taskPromptMaxChars: PYTHON_BEGINNER_RULES_BASE.taskPromptMaxChars,
};

/** Topic-tag keywords for lightweight alignment (ambiguous cases defer to the LLM judge). */
export const TOPIC_TAG_KEYWORDS: Record<string, string[]> = {
  conditionals: ["if", "elif", "else", "condition", "boolean", "comparison", "branch"],
  loops: ["loop", "for", "while", "iterate", "repeat", "range"],
  for: ["for", "loop", "iterate", "sequence", "each"],
  while: ["while", "loop", "condition", "repeat"],
  range: ["range", "loop", "index", "count"],
  functions: ["function", "def", "parameter", "return", "call"],
  lists: ["list", "append", "index", "element", "sequence"],
  python: ["python"],
};

export type SubjectRules = {
  subjectId: string;
  tone: string;
  explanationMaxChars: number;
  taskPromptMaxChars: number;
  gradingMethod: string;
  outputFormat: string;
  /** Approved catalog lesson IDs the model may recommend as follow-up. */
  catalogLessonIds: string[];
};

export function createPythonBeginnerRules(catalogLessonIds: string[]): SubjectRules {
  return {
    ...PYTHON_BEGINNER_RULES_BASE,
    catalogLessonIds,
  };
}
