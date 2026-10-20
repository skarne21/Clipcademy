import "dotenv/config";
import { GenerationOutcome, PrismaClient, type GenerationLog } from "@prisma/client";

type LogRow = GenerationLog;

type LlmCallMeta = {
  model?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
};

type RawOutputShape = {
  llmCalls?: LlmCallMeta[];
  output?: unknown;
  error?: string[];
  validationErrors?: string[];
};

type GenerationRequest = {
  lessonId: string;
  startedAt: Date;
  endedAt: Date;
  attempts: LogRow[];
  terminalOutcome: GenerationOutcome;
};

const TERMINAL_OUTCOMES = new Set<GenerationOutcome>([
  GenerationOutcome.validated,
  GenerationOutcome.fallback,
  GenerationOutcome.unvalidated,
]);

function parseArgs(argv: string[]) {
  let sinceMinutes: number | null = null;
  let lessonId: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--since" && argv[i + 1]) {
      sinceMinutes = Number(argv[++i]);
    } else if (arg === "--lesson" && argv[i + 1]) {
      lessonId = argv[++i];
    }
  }

  return { sinceMinutes, lessonId };
}

function latencyForRow(row: LogRow): number {
  const raw = row.rawOutput as RawOutputShape | null;
  if (raw?.llmCalls?.length) {
    return raw.llmCalls.reduce((sum, call) => sum + (call.latencyMs ?? 0), 0);
  }
  return row.latencyMs ?? 0;
}

function requestTotalLatency(request: GenerationRequest): number {
  return request.attempts.reduce((sum, row) => sum + latencyForRow(row), 0);
}

function groupIntoRequests(rows: LogRow[]): GenerationRequest[] {
  const byLesson = new Map<string, LogRow[]>();
  for (const row of rows) {
    const list = byLesson.get(row.lessonId) ?? [];
    list.push(row);
    byLesson.set(row.lessonId, list);
  }

  const requests: GenerationRequest[] = [];

  for (const [lessonId, lessonRows] of byLesson) {
    lessonRows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    let buffer: LogRow[] = [];

    const flush = (terminal: GenerationOutcome) => {
      if (buffer.length === 0) return;
      requests.push({
        lessonId,
        startedAt: buffer[0].createdAt,
        endedAt: buffer[buffer.length - 1].createdAt,
        attempts: buffer,
        terminalOutcome: terminal,
      });
      buffer = [];
    };

    for (const row of lessonRows) {
      if (buffer.length > 0 && row.attemptNumber === 1) {
        flush(buffer[buffer.length - 1].outcome);
      }

      buffer.push(row);

      if (TERMINAL_OUTCOMES.has(row.outcome)) {
        flush(row.outcome);
      }
    }

    if (buffer.length > 0) {
      const last = buffer[buffer.length - 1];
      flush(last.outcome);
    }
  }

  requests.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  return requests;
}

function classifyError(error: string): string {
  const e = error.toLowerCase();
  if (e.includes("lesson notes judge failed") || e.includes("judge failed")) {
    return "judge_contradiction";
  }
  if (e.startsWith("reference solution:")) {
    return "reference_solution_failed";
  }
  if (e.includes("trivially passable") || e.includes("starter code passes")) {
    return "starter_passed";
  }
  if (e.includes("edge case")) {
    return "missing_edge_case";
  }
  if (e.includes("boundary")) {
    return "missing_boundary_test";
  }
  if (e.includes("not in the catalog") || e.includes("follow_up")) {
    return "invalid_follow_up";
  }
  if (e.startsWith("schema:") || e.includes("schema")) {
    return "schema_mismatch";
  }
  if (e.startsWith("refusal:")) {
    return "model_refusal";
  }
  if (e.includes("topic tags") || e.includes("does not appear to match")) {
    return "off_topic";
  }
  if (e.includes("exceeds") && e.includes("characters")) {
    return "length_limit";
  }
  if (e.includes("lesson_id mismatch")) {
    return "lesson_id_mismatch";
  }
  if (e.includes("openai") || e.includes("api failed")) {
    return "llm_api_error";
  }
  return "other";
}

function tallyErrors(requests: GenerationRequest[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const request of requests) {
    for (const attempt of request.attempts) {
      for (const err of attempt.errors) {
        const key = classifyError(err);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return counts;
}

function printPerLessonSummary(requests: GenerationRequest[]) {
  console.log("\n=== Per lesson ===\n");

  const byLesson = new Map<string, GenerationRequest[]>();
  for (const req of requests) {
    const list = byLesson.get(req.lessonId) ?? [];
    list.push(req);
    byLesson.set(req.lessonId, list);
  }

  const rows = [...byLesson.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([lessonId, list]) => {
      const validated = list.filter((r) => r.terminalOutcome === GenerationOutcome.validated).length;
      const fallback = list.filter((r) => r.terminalOutcome === GenerationOutcome.fallback).length;
      const avgAttempts =
        list.reduce((sum, r) => sum + r.attempts.length, 0) / (list.length || 1);
      const avgLatency =
        list.reduce((sum, r) => sum + requestTotalLatency(r), 0) / (list.length || 1);

      return {
        lessonId,
        requests: list.length,
        validated,
        fallback,
        avgAttempts: Math.round(avgAttempts * 100) / 100,
        avgLatencyMs: Math.round(avgLatency),
      };
    });

  console.table(rows);
}

function printFallbackDetails(requests: GenerationRequest[]) {
  const fallbackRequests = requests.filter(
    (r) => r.terminalOutcome === GenerationOutcome.fallback,
  );

  console.log("\n=== Fallback requests (errors by attempt) ===\n");

  if (fallbackRequests.length === 0) {
    console.log("(none)\n");
    return;
  }

  for (const req of fallbackRequests) {
    console.log(`Lesson: ${req.lessonId}`);
    console.log(`  Window: ${req.startedAt.toISOString()} → ${req.endedAt.toISOString()}`);
    for (const attempt of req.attempts) {
      const errs = attempt.errors.length > 0 ? attempt.errors : ["(no errors recorded)"];
      console.log(`  Attempt ${attempt.attemptNumber} [${attempt.outcome}]:`);
      for (const err of errs) {
        console.log(`    - ${err}`);
      }
    }
    console.log("");
  }
}

function printErrorTally(counts: Map<string, number>) {
  console.log("\n=== Error type tally (all attempts) ===\n");
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    console.log("(no errors)\n");
    return;
  }
  console.table(
    sorted.map(([type, count]) => ({ errorType: type, count })),
  );
}

async function main() {
  const { sinceMinutes, lessonId } = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  const where: {
    lessonId?: string;
    createdAt?: { gte: Date };
  } = {};

  if (lessonId) where.lessonId = lessonId;
  if (sinceMinutes != null && Number.isFinite(sinceMinutes) && sinceMinutes > 0) {
    where.createdAt = { gte: new Date(Date.now() - sinceMinutes * 60_000) };
  }

  const rows = await prisma.generationLog.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });

  await prisma.$disconnect();

  console.log("\nGeneration log report");
  if (sinceMinutes) console.log(`Filter: last ${sinceMinutes} minutes`);
  if (lessonId) console.log(`Filter: lesson ${lessonId}`);
  console.log(`Rows loaded: ${rows.length}`);

  if (rows.length === 0) {
    console.log("\nNo generation logs match the filters.\n");
    return;
  }

  const requests = groupIntoRequests(rows);
  console.log(`Grouped into ${requests.length} generation request(s).`);

  printPerLessonSummary(requests);
  printFallbackDetails(requests);
  printErrorTally(tallyErrors(requests));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
