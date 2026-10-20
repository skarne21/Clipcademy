import { describe, expect, it } from "vitest";
import {
  enrichValidationErrorsForRevision,
  normalizePythonSource,
  normalizePythonTest,
  prepareLessonTests,
  RAISES_TEST_USAGE_HINT,
  validateReturnValueTaskSemantics,
} from "./python-code";

describe("normalizePythonSource", () => {
  it("strips markdown fences", () => {
    const raw = "```python\ndef foo():\n    return 1\n```";
    expect(normalizePythonSource(raw)).toBe("def foo():\n    return 1");
  });

  it("drops leading prose before def", () => {
    const raw = "Sure! Here is the solution:\ndef foo():\n    return 1";
    expect(normalizePythonSource(raw).startsWith("def foo")).toBe(true);
  });
});

describe("normalizePythonTest", () => {
  it("strips list numbering and extracts assert", () => {
    expect(normalizePythonTest('1. assert foo(0) == 0')).toBe("assert foo(0) == 0");
  });

  it("leaves prose unchanged for downstream validation", () => {
    expect(normalizePythonTest("countdown(3) should print: 3, 2, 1")).toBe(
      "countdown(3) should print: 3, 2, 1",
    );
  });
});

describe("validateReturnValueTaskSemantics", () => {
  it("rejects reference solutions that print when tests assert return values", () => {
    const errors = validateReturnValueTaskSemantics({
      taskPrompt: "Return a list of countdown numbers.",
      tests: ["assert countdown(3) == [3, 2, 1]"],
      referenceCode: "def countdown(n):\n    print(n)\n    return None\n",
    });
    expect(errors).toEqual(["Task must return a value instead of printing"]);
  });

  it("rejects print-based task prompts", () => {
    const errors = validateReturnValueTaskSemantics({
      taskPrompt: "Print each number in the countdown.",
      tests: ["assert countdown(3) == [3, 2, 1]"],
    });
    expect(errors).toEqual(["Task must return a value instead of printing"]);
  });
});

describe("prepareLessonTests", () => {
  it("rejects assert-trailing-raises with helper hint", () => {
    const { errors } = prepareLessonTests([
      "assert access_list_element([], 0) raises IndexError",
    ]);
    expect(errors[0]).toContain("not valid Python");
    expect(errors[0]).toContain("assert raises(IndexError");
  });

  it("flags prose tests from real OpenAI output", () => {
    const { errors } = prepareLessonTests([
      "repeat_action(3) should print the action 3 times.",
      'assert repeat_action(1) == "x"',
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Test 1 is not valid Python:");
  });
});

describe("enrichValidationErrorsForRevision", () => {
  it("appends raises helper hint for invalid exception test syntax", () => {
    const enriched = enrichValidationErrorsForRevision([
      "Test 2 is not valid Python: assert foo() raises IndexError",
    ]);
    expect(enriched).toContain(RAISES_TEST_USAGE_HINT);
  });
});
