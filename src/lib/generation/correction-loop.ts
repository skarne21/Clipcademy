import { GenerationOutcome, Prisma } from "@prisma/client";
import type { Lesson } from "@prisma/client";
import { buildGenerationPrompts } from "@/lib/generation/build-context";
import { writeGenerationLog } from "@/lib/generation/log";
import type { LearnerLevel } from "@prisma/client";
import type { RecentAttemptSummary } from "@/lib/generation/learner-stub";
import type { SubjectRules } from "@/lib/subject-rules/python-beginner";
import {
  completeStructured,
  getGenerationMaxTokens,
  getGenerationModel,
  getLlmTimeoutMs,
  LlmRefusalError,
  LlmStructuredOutputError,
} from "@/lib/llm";
import { loadPromptTemplate, renderTemplate } from "@/lib/prompts/load-prompt";
import { lessonOutputSchema, type LessonOutput } from "@/lib/schemas/lesson-output";
import { validateLessonOutput, type ValidatorContext } from "@/lib/validator";
import { enrichValidationErrorsForRevision } from "@/lib/validator/python-code";
import type { LlmUsage } from "@/lib/llm/types";

export type CorrectionLoopResult =
  | { ok: true; output: LessonOutput; attemptNumber: number; logId: string }
  | { ok: false; attemptNumber: number; logId: string; errors: string[] };

export type CorrectionLoopInput = {
  lesson: Lesson;
  learnerLevel: LearnerLevel;
  recentHistory: RecentAttemptSummary[];
  subjectRules: SubjectRules;
  userId: string | null;
};

function getMaxRetries(): number {
  const n = Number(process.env.GENERATION_MAX_RETRIES ?? 2);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 2;
}

function formatGenerationError(error: unknown): string[] {
  if (error instanceof LlmRefusalError) return [`refusal: ${error.refusal}`];
  if (error instanceof LlmStructuredOutputError) {
    return [error.message, ...error.details];
  }
  if (error instanceof Error) return [error.message];
  return ["Unknown generation error"];
}

function toValidatorContext(
  lesson: Lesson,
  catalog: { id: string; difficulty: "beginner" | "intermediate" }[],
  learnerLevel: "beginner" | "intermediate",
): ValidatorContext {
  return {
    lesson: {
      id: lesson.id,
      topicTags: lesson.topicTags,
      lessonNotes: lesson.lessonNotes,
      learningGoal: lesson.learningGoal,
    },
    catalog,
    learnerLevel,
  };
}

async function generateOnce(options: {
  system: string;
  user: string;
  lessonId: string;
}): Promise<{ output: LessonOutput; usage: LlmUsage; raw: unknown }> {
  const started = Date.now();
  try {
    const result = await completeStructured<LessonOutput>({
      schema: lessonOutputSchema,
      schemaName: "lesson_output",
      system: options.system,
      user: options.user,
      model: getGenerationModel(),
      maxTokens: getGenerationMaxTokens(),
      timeoutMs: getLlmTimeoutMs(),
      context: { lessonId: options.lessonId },
    });
    return { output: result.data, usage: result, raw: result.raw };
  } catch (error) {
    const latencyMs = Date.now() - started;
    throw Object.assign(error instanceof Error ? error : new Error("Generation failed"), {
      latencyMs,
    });
  }
}

export async function runCorrectionLoop(
  input: CorrectionLoopInput,
): Promise<CorrectionLoopResult> {
  const maxRetries = getMaxRetries();
  const totalAttempts = 1 + maxRetries;

  const catalogRows = await import("@/lib/db").then((m) =>
    m.prisma.lesson.findMany({
      select: { id: true, difficulty: true },
      orderBy: { sortOrder: "asc" },
    }),
  );

  const prompts = buildGenerationPrompts({
    lesson: input.lesson,
    learnerLevel: input.learnerLevel,
    recentHistory: input.recentHistory,
    subjectRules: input.subjectRules,
  });

  const validatorContext = toValidatorContext(
    input.lesson,
    catalogRows,
    input.learnerLevel,
  );

  let previous: LessonOutput | null = null;
  let lastErrors: string[] = [];

  const errorFingerprint = (errs: string[]) => JSON.stringify([...errs].sort());

  for (let attemptNumber = 1; attemptNumber <= totalAttempts; attemptNumber++) {
    const genStarted = Date.now();
    let output: LessonOutput | null = null;
    let genUsage: LlmUsage | null = null;
    let raw: unknown = null;
    const llmCalls: LlmUsage[] = [];

    try {
      if (attemptNumber === 1 || !previous) {
        const generated = await generateOnce({
          system: prompts.system,
          user: prompts.user,
          lessonId: input.lesson.id,
        });
        output = generated.output;
        genUsage = generated.usage;
        raw = generated.raw;
        llmCalls.push(generated.usage);
      } else {
        const system = loadPromptTemplate("revise-lesson.system.txt");
        const revisionErrors = enrichValidationErrorsForRevision(lastErrors);
        const user = renderTemplate(loadPromptTemplate("revise-lesson.user.txt"), {
          errors: revisionErrors.map((e) => `- ${e}`).join("\n"),
          previous_json: JSON.stringify(previous, null, 2),
          catalog_lesson_ids: input.subjectRules.catalogLessonIds.join(", "),
          lesson_id: input.lesson.id,
          learner_level: input.learnerLevel,
        });
        const generated = await generateOnce({
          system,
          user,
          lessonId: input.lesson.id,
        });
        output = generated.output;
        genUsage = generated.usage;
        raw = generated.raw;
        llmCalls.push(generated.usage);
      }
    } catch (error) {
      const latencyMs =
        typeof (error as { latencyMs?: number }).latencyMs === "number"
          ? (error as { latencyMs: number }).latencyMs
          : Date.now() - genStarted;
      const errors = formatGenerationError(error);
      const logId = await writeGenerationLog({
        lessonId: input.lesson.id,
        userId: input.userId,
        attemptNumber,
        promptVersion: prompts.promptVersion,
        modelName: getGenerationModel(),
        latencyMs,
        inputTokens: null,
        outputTokens: null,
        rawOutput: { llmCalls, error: errors } as Prisma.InputJsonValue,
        errors,
        outcome: GenerationOutcome.failed,
      });
      lastErrors = errors;
      previous = null;
      if (attemptNumber === totalAttempts) {
        return { ok: false, attemptNumber, logId, errors };
      }
      continue;
    }

    if (!output || output.lesson_id !== input.lesson.id) {
      lastErrors = [
        `lesson_id mismatch: expected ${input.lesson.id}, got ${output?.lesson_id ?? "missing"}`,
      ];
      const logId = await writeGenerationLog({
        lessonId: input.lesson.id,
        userId: input.userId,
        attemptNumber,
        promptVersion: prompts.promptVersion,
        modelName: genUsage?.model ?? getGenerationModel(),
        latencyMs: genUsage?.latencyMs ?? Date.now() - genStarted,
        inputTokens: genUsage?.inputTokens ?? null,
        outputTokens: genUsage?.outputTokens ?? null,
        rawOutput: { output: raw, llmCalls } as Prisma.InputJsonValue,
        errors: lastErrors,
        outcome: GenerationOutcome.failed,
      });
      previous = output;
      if (attemptNumber === totalAttempts) {
        return { ok: false, attemptNumber, logId, errors: lastErrors };
      }
      continue;
    }

    const validation = await validateLessonOutput(output, validatorContext);
    llmCalls.push(...validation.llmCalls);

    if (validation.ok) {
      const logId = await writeGenerationLog({
        lessonId: input.lesson.id,
        userId: input.userId,
        attemptNumber,
        promptVersion: prompts.promptVersion,
        modelName: genUsage?.model ?? getGenerationModel(),
        latencyMs: genUsage?.latencyMs ?? Date.now() - genStarted,
        inputTokens: genUsage?.inputTokens ?? null,
        outputTokens: genUsage?.outputTokens ?? null,
        rawOutput: { output, llmCalls } as Prisma.InputJsonValue,
        errors: [],
        outcome: GenerationOutcome.validated,
      });
      return { ok: true, output, attemptNumber, logId };
    }

    if (
      attemptNumber > 1 &&
      lastErrors.length > 0 &&
      errorFingerprint(validation.errors) === errorFingerprint(lastErrors)
    ) {
      const logId = await writeGenerationLog({
        lessonId: input.lesson.id,
        userId: input.userId,
        attemptNumber,
        promptVersion: prompts.promptVersion,
        modelName: genUsage?.model ?? getGenerationModel(),
        latencyMs: genUsage?.latencyMs ?? Date.now() - genStarted,
        inputTokens: genUsage?.inputTokens ?? null,
        outputTokens: genUsage?.outputTokens ?? null,
        rawOutput: {
          output,
          llmCalls,
          duplicateErrors: true,
        } as Prisma.InputJsonValue,
        errors: validation.errors,
        outcome: GenerationOutcome.failed,
      });
      return { ok: false, attemptNumber, logId, errors: validation.errors };
    }

    lastErrors = validation.errors;
    previous = output;

    const logId = await writeGenerationLog({
      lessonId: input.lesson.id,
      userId: input.userId,
      attemptNumber,
      promptVersion: prompts.promptVersion,
      modelName: genUsage?.model ?? getGenerationModel(),
      latencyMs: genUsage?.latencyMs ?? Date.now() - genStarted,
      inputTokens: genUsage?.inputTokens ?? null,
      outputTokens: genUsage?.outputTokens ?? null,
      rawOutput: { output, llmCalls } as Prisma.InputJsonValue,
      errors: lastErrors,
      outcome: GenerationOutcome.failed,
    });

    if (attemptNumber === totalAttempts) {
      return { ok: false, attemptNumber, logId, errors: lastErrors };
    }
  }

  return {
    ok: false,
    attemptNumber: totalAttempts,
    logId: "",
    errors: lastErrors.length > 0 ? lastErrors : ["Generation failed"],
  };
}
