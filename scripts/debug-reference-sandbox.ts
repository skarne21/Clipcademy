/**
 * Print reference solution + tests that would reach the sandbox from a real GenerationLog.
 *
 * Usage:
 *   npx tsx scripts/debug-reference-sandbox.ts --log <generationLogId>
 *   npx tsx scripts/debug-reference-sandbox.ts py-loops-while-01   # latest OpenAI log for lesson
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { normalizePythonSource, prepareLessonTests } from "../src/lib/validator/python-code";
import { runPythonInSandbox } from "../src/lib/sandbox";

type TaskShape = {
  function_name: string;
  prompt: string;
  starter_code: string;
  visible_tests: string[];
  hidden_tests: string[];
};

type LogRawOutput = {
  output?: { task?: TaskShape };
  llmCalls?: Array<{
    raw?: { solution_code?: string };
    data?: { solution_code?: string };
  }>;
};

function referenceFromLog(raw: LogRawOutput | null): string | null {
  if (!raw?.llmCalls?.length) return null;
  for (let i = raw.llmCalls.length - 1; i >= 0; i--) {
    const call = raw.llmCalls[i];
    const code = call.data?.solution_code ?? call.raw?.solution_code;
    if (code) return code;
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const logFlag = args.indexOf("--log");
  const logId = logFlag >= 0 ? args[logFlag + 1] : undefined;
  const lessonId = logId ? undefined : (args[0] ?? "py-loops-while-01");

  const prisma = new PrismaClient();

  let log:
    | {
        id: string;
        lessonId: string;
        modelName: string | null;
        outcome: string;
        createdAt: Date;
        rawOutput: unknown;
      }
    | null
    | undefined;

  if (logId) {
    log = await prisma.generationLog.findUnique({
      where: { id: logId },
      select: {
        id: true,
        lessonId: true,
        modelName: true,
        outcome: true,
        createdAt: true,
        rawOutput: true,
      },
    });
  } else if (lessonId) {
    log = await prisma.generationLog.findFirst({
      where: {
        lessonId,
        modelName: { not: { startsWith: "mock" } },
        NOT: { modelName: null },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        lessonId: true,
        modelName: true,
        outcome: true,
        createdAt: true,
        rawOutput: true,
      },
    });
  }

  await prisma.$disconnect();

  if (!log) {
    console.error("GenerationLog not found. Pass --log <id> or a lesson id.");
    process.exit(1);
  }

  const raw = log.rawOutput as LogRawOutput;
  const task = raw.output?.task;
  if (!task) {
    console.error("Log has no output.task in rawOutput");
    process.exit(1);
  }

  const rawTests = [...task.visible_tests, ...task.hidden_tests];
  const prepared = prepareLessonTests(rawTests);
  const refRaw = referenceFromLog(raw);
  const refNormalized = refRaw ? normalizePythonSource(refRaw) : null;

  console.log(`GenerationLog: ${log.id}`);
  console.log(`Lesson: ${log.lessonId}`);
  console.log(`Model: ${log.modelName}  Outcome: ${log.outcome}  At: ${log.createdAt.toISOString()}`);

  console.log("\n--- Reference solution (raw from log llmCalls) ---\n");
  console.log(refRaw ?? "(none in log)");

  console.log("\n--- Reference solution (normalized for sandbox code) ---\n");
  console.log(refNormalized ?? "(none)");

  console.log("\n--- visible_tests (raw from model) ---\n");
  task.visible_tests.forEach((t, i) => console.log(`${i + 1}. ${JSON.stringify(t)}`));

  console.log("\n--- hidden_tests (raw from model) ---\n");
  task.hidden_tests.forEach((t, i) => console.log(`${i + 1}. ${JSON.stringify(t)}`));

  console.log("\n--- Tests after prepareLessonTests (sent to sandbox) ---\n");
  prepared.normalized.forEach((t, i) => console.log(`${i + 1}. ${JSON.stringify(t)}`));

  if (prepared.errors.length > 0) {
    console.log("\n--- prepareLessonTests errors (validator stops before reference run) ---\n");
    prepared.errors.forEach((e) => console.log(e));
  }

  if (refNormalized && prepared.errors.length === 0) {
    console.log("\n--- Sandbox run (normalized ref + prepared tests) ---\n");
    const result = await runPythonInSandbox({
      code: refNormalized,
      tests: prepared.normalized,
    });
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
