import "dotenv/config";
import { GenerationOutcome, PrismaClient } from "@prisma/client";
import { generateLessonContent } from "../src/lib/generation/generate-lesson";
import { buildFallbackResponse } from "../src/lib/generation/public-response";
import { resetLlmProvider } from "../src/lib/llm";

const BASE_URL = process.env.VERIFY_BASE_URL?.trim() || "http://localhost:3000";

/** Key names that must never appear in client-facing /api/generate JSON (any depth). */
const SERVER_ONLY_KEYS = new Set(
  [
    "hidden_tests",
    "hiddenTests",
    "reference_solution",
    "referenceSolution",
    "lessonNotes",
    "lesson_notes",
    "fallbackExplanation",
    "fallback_explanation",
    "fallbackTask",
    "fallback_task",
    "transcript",
    "rawOutput",
    "raw_output",
    "hint_targets",
    "hintTargets",
    "follow_up",
    "followUp",
    "tests",
  ].map((k) => k.toLowerCase()),
);

type Check = { id: string; pass: boolean; detail: string };

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  const label = pass ? "PASS" : "FAIL";
  console.log(`${label}  ${id}${detail ? ` — ${detail}` : ""}`);
}

function findServerOnlyLeaks(value: unknown, path = "$"): string[] {
  const leaks: string[] = [];
  if (value === null || value === undefined) return leaks;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      leaks.push(...findServerOnlyLeaks(value[i], `${path}[${i}]`));
    }
    return leaks;
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (SERVER_ONLY_KEYS.has(key.toLowerCase())) {
        leaks.push(`${path}.${key}`);
      }
      leaks.push(...findServerOnlyLeaks(child, `${path}.${key}`));
    }
  }

  return leaks;
}

async function withEnv<T>(
  overrides: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const snapshot: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(overrides)) {
    snapshot[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  resetLlmProvider();
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    resetLlmProvider();
  }
}

function isMockModel(modelName: string | null | undefined): boolean {
  if (!modelName) return false;
  return modelName.toLowerCase().includes("mock");
}

async function main() {
  const prisma = new PrismaClient();
  const runStarted = new Date();

  console.log(`\nPhase 2 verification — ${BASE_URL}\n`);

  try {
    const health = await fetch(`${BASE_URL}/api/lessons`);
    if (!health.ok) {
      record(
        "preflight.server",
        false,
        `GET /api/lessons returned ${health.status}. Start the dev server first.`,
      );
      printSummary();
      process.exit(1);
    }
    record("preflight.server", true, "Dev server reachable");

    const lessonsBody = (await health.json()) as { lessons: { id: string }[] };
    const lessonIds = lessonsBody.lessons.map((l) => l.id);
    if (lessonIds.length === 0) {
      record("preflight.lessons", false, "No lessons in catalog");
      printSummary();
      process.exit(1);
    }
    record("preflight.lessons", true, `${lessonIds.length} lesson(s)`);

    console.log(
      "Note: the dev server must run with DEV_SKIP_VALIDATION=true for HTTP checks (see README).\n",
    );

    const httpLogIds: string[] = [];

    for (const lessonId of lessonIds) {
      const res = await fetch(`${BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });

      if (!res.ok) {
        record(`no_leaks.${lessonId}`, false, `POST /api/generate → ${res.status}`);
        record(`logging.${lessonId}`, false, "Skipped (request failed)");
        continue;
      }

      const body = (await res.json()) as Record<string, unknown>;
      const leaks = findServerOnlyLeaks(body);
      record(
        `no_leaks.${lessonId}`,
        leaks.length === 0,
        leaks.length === 0 ? "No server-only keys in response" : leaks.join(", "),
      );

      const log = await prisma.generationLog.findFirst({
        where: { lessonId, createdAt: { gte: runStarted } },
        orderBy: { createdAt: "desc" },
      });

      if (!log) {
        record(
          `logging.${lessonId}`,
          false,
          "No GenerationLog row for this run (is the dev server using DEV_SKIP_VALIDATION=true?)",
        );
        continue;
      }

      httpLogIds.push(log.id);

      const loggingOk =
        log.promptVersion != null &&
        log.promptVersion.length > 0 &&
        log.modelName != null &&
        log.modelName.length > 0 &&
        log.latencyMs != null &&
        log.latencyMs > 0 &&
        (isMockModel(log.modelName) ||
          ((log.inputTokens ?? 0) > 0 && (log.outputTokens ?? 0) > 0));

      record(
        `logging.${lessonId}`,
        loggingOk,
        loggingOk
          ? `model=${log.modelName}, latency=${log.latencyMs}ms`
          : `promptVersion=${log.promptVersion}, model=${log.modelName}, latency=${log.latencyMs}, tokens=${log.inputTokens}/${log.outputTokens}`,
      );

      record(
        `outcome.${lessonId}`,
        log.outcome === GenerationOutcome.unvalidated,
        `outcome=${log.outcome}`,
      );
    }

    if (httpLogIds.length === 0) {
      record(
        "outcome.no_validated_labels",
        false,
        "No HTTP generation logs to inspect (dev server likely has DEV_SKIP_VALIDATION=false)",
      );
    } else {
      const validatedAmongHttp = await prisma.generationLog.count({
        where: {
          id: { in: httpLogIds },
          outcome: GenerationOutcome.validated,
        },
      });
      record(
        "outcome.no_validated_labels",
        validatedAmongHttp === 0,
        validatedAmongHttp === 0
          ? "No HTTP-generation rows labeled validated"
          : `${validatedAmongHttp} row(s) incorrectly labeled validated`,
      );
    }

    const sampleLessonId = lessonIds[0];
    const sampleLesson = await prisma.lesson.findUnique({ where: { id: sampleLessonId } });
    if (!sampleLesson) {
      record("fallback_mode", false, "Sample lesson missing from DB");
    } else {
      await withEnv({ DEV_SKIP_VALIDATION: "false" }, async () => {
        const { response, logId } = await generateLessonContent(sampleLessonId);
        const expected = buildFallbackResponse(sampleLesson);
        const matches =
          response.source === "fallback" &&
          response.explanation === expected.explanation &&
          JSON.stringify(response.task) === JSON.stringify(expected.task) &&
          logId === null;
        record(
          "fallback_mode",
          matches,
          matches
            ? "Direct service call returned approved fallback with DEV_SKIP_VALIDATION=false"
            : `source=${response.source}, logId=${logId ?? "null"}`,
        );
      });
    }

    await withEnv(
      {
        LLM_PROVIDER: "openai",
        OPENAI_API_KEY: "sk-invalid-verify-phase2",
        DEV_SKIP_VALIDATION: "true",
      },
      async () => {
        const lessonId = sampleLessonId;
        const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
        if (!lesson) {
          record("invalid_key_fallback", false, "Sample lesson missing");
          return;
        }

        const before = new Date();
        let threw = false;
        let result: Awaited<ReturnType<typeof generateLessonContent>> | null = null;
        try {
          result = await generateLessonContent(lessonId);
        } catch {
          threw = true;
        }

        const expected = buildFallbackResponse(lesson);
        const responseOk =
          !threw &&
          result != null &&
          result.response.source === "fallback" &&
          result.response.explanation === expected.explanation;

        const log = await prisma.generationLog.findFirst({
          where: { lessonId, createdAt: { gte: before }, outcome: GenerationOutcome.failed },
          orderBy: { createdAt: "desc" },
        });

        const logOk =
          log != null &&
          log.errors.length > 0 &&
          result?.logId === log.id;

        record(
          "invalid_key_fallback",
          responseOk && logOk,
          responseOk && logOk
            ? `Fallback served; logged ${log!.errors.length} error(s)`
            : `threw=${threw}, responseOk=${responseOk}, logOk=${logOk}`,
        );
      },
    );
  } finally {
    await prisma.$disconnect();
  }

  printSummary();
  const failed = checks.filter((c) => !c.pass).length;
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary() {
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  console.log(`\nSummary: ${passed} passed, ${failed} failed (${checks.length} checks)\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
