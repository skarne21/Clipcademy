import "dotenv/config";
import { execSync } from "node:child_process";
import type { LessonOutput } from "../src/lib/schemas/lesson-output";
import { validateLessonOutput } from "../src/lib/validator";
import { runPythonInSandbox } from "../src/lib/sandbox";

const goodOutput: LessonOutput = {
  lesson_id: "py-conditionals-01",
  learner_level: "beginner",
  explanation:
    "Conditionals in Python use if and else. When a score is at least 60, treat it as a pass.",
  task: {
    prompt: 'Write grade_label(score) returning "pass" if score is at least 60, else "fail".',
    type: "code",
    function_name: "grade_label",
    starter_code: "def grade_label(score):\n    pass\n",
    visible_tests: [
      'assert grade_label(60) == "pass"',
      'assert grade_label(59) == "fail"',
    ],
    hidden_tests: ['assert grade_label(0) == "fail"'],
  },
  hint_targets: ["missing_return"],
  follow_up: { lesson_id: "py-loops-for-01", reason: "Loops are next." },
};

const context = {
  lesson: {
    id: "py-conditionals-01",
    topicTags: ["conditionals", "python"],
    lessonNotes: "If statements run indented blocks when a condition is True.",
    learningGoal: "Write if/else branches.",
  },
  catalog: [
    { id: "py-conditionals-01", difficulty: "beginner" as const },
    { id: "py-loops-for-01", difficulty: "beginner" as const },
  ],
  learnerLevel: "beginner" as const,
};

type Check = { id: string; pass: boolean; detail: string };
const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function solutionCode(): string {
  return 'def grade_label(score):\n    return "pass" if score >= 60 else "fail"\n';
}

async function main() {
  console.log("\nPhase 3 verification\n");

  process.env.LLM_PROVIDER = "mock";

  const sandboxDeps = {
    runSandbox: runPythonInSandbox,
    generateReference: async () => ({
      code: solutionCode(),
      usage: { model: "verify-ref", latencyMs: 1, inputTokens: 1, outputTokens: 1 },
    }),
  };

  try {
    const good = await validateLessonOutput(goodOutput, context, sandboxDeps);
    record(
      "validator.known_good",
      good.ok,
      good.ok ? "Known-good output validated" : good.errors.join("; "),
    );
  } catch (error) {
    record(
      "validator.known_good",
      false,
      error instanceof Error ? error.message : "Validator threw",
    );
  }

  const badFollowUp = {
    ...goodOutput,
    follow_up: { lesson_id: "does-not-exist", reason: "bad" },
  };
  const follow = await validateLessonOutput(badFollowUp, context, sandboxDeps);
  record(
    "validator.bad_follow_up",
    !follow.ok && follow.errors.some((e) => e.includes("not in the catalog")),
    follow.errors.join("; ") || "no errors",
  );

  const badTopic = {
    ...goodOutput,
    explanation: "Decorators use @ syntax to wrap functions.",
  };
  const topic = await validateLessonOutput(badTopic, context, sandboxDeps);
  record(
    "validator.off_topic",
    !topic.ok,
    topic.errors.join("; ") || "expected failure",
  );

  const badTests = {
    ...goodOutput,
    task: {
      ...goodOutput.task,
      starter_code: solutionCode(),
    },
  };
  const trivial = await validateLessonOutput(badTests, context, sandboxDeps);
  record(
    "validator.trivial_tests",
    !trivial.ok && trivial.errors.some((e) => e.includes("trivially passable")),
    trivial.errors.join("; ") || "expected failure",
  );

  const timeoutRun = await runPythonInSandbox({
    code: "while True:\n    pass\n",
    tests: ["assert True"],
    timeoutSeconds: 1,
  });
  record(
    "sandbox.timeout",
    timeoutRun.status === "timeout",
    `status=${timeoutRun.status}`,
  );

  const syntaxRun = await runPythonInSandbox({
    code: "def broken(:\n    pass",
    tests: ["assert True"],
  });
  record(
    "sandbox.syntax_error",
    syntaxRun.status === "syntax_error",
    `status=${syntaxRun.status}`,
  );

  try {
    const image = process.env.SANDBOX_DOCKER_IMAGE?.trim() || "clipcademy-python-sandbox";
    const inspect = execSync(`docker image inspect ${image}`, { encoding: "utf-8" });
    record("sandbox.image_exists", inspect.includes("Id"), image);
    const networkNone = execSync(
      `docker run --rm --network none ${image} python -c "print('ok')"`,
      { encoding: "utf-8" },
    );
    record("sandbox.network_none", networkNone.includes("ok"), "Container runs with --network none");
  } catch (error) {
    record(
      "sandbox.docker",
      false,
      `Build the image first: docker compose --profile sandbox build python-sandbox (${error instanceof Error ? error.message : error})`,
    );
  }

  const failed = checks.filter((c) => !c.pass).length;
  console.log(`\nSummary: ${checks.length - failed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
