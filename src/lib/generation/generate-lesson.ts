import { GenerationOutcome, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildGenerationPrompts } from "@/lib/generation/build-context";
import { runCorrectionLoop } from "@/lib/generation/correction-loop";
import {
  getStubLearnerLevel,
  getStubRecentHistory,
  getStubUserId,
} from "@/lib/generation/learner-stub";
import { createPythonBeginnerRules } from "@/lib/subject-rules/python-beginner";
import { writeGenerationLog } from "@/lib/generation/log";
import {
  buildFallbackResponse,
  buildGeneratedClientResponse,
  type GenerateLessonResponse,
} from "@/lib/generation/public-response";
import {
  completeStructured,
  getGenerationMaxTokens,
  getGenerationModel,
  getLlmTimeoutMs,
  isDevSkipValidation,
  LlmRefusalError,
  LlmStructuredOutputError,
} from "@/lib/llm";
import { lessonOutputSchema, type LessonOutput } from "@/lib/schemas/lesson-output";

export type GenerateLessonResult = {
  response: GenerateLessonResponse;
  logId: string | null;
};

function formatError(error: unknown): string[] {
  if (error instanceof LlmRefusalError) {
    return [`refusal: ${error.refusal}`];
  }
  if (error instanceof LlmStructuredOutputError) {
    return [error.message, ...error.details];
  }
  if (error instanceof Error) {
    return [error.message];
  }
  return ["Unknown generation error"];
}

async function runUnvalidatedPath(
  lessonId: string,
): Promise<GenerateLessonResult> {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) throw new Error("Lesson not found");

  const learnerLevel = getStubLearnerLevel();
  const recentHistory = getStubRecentHistory();
  const userId = getStubUserId();
  const fallback = buildFallbackResponse(lesson, learnerLevel);

  const catalogLessonIds = (
    await prisma.lesson.findMany({ select: { id: true }, orderBy: { sortOrder: "asc" } })
  ).map((l) => l.id);

  const prompts = buildGenerationPrompts({
    lesson,
    learnerLevel,
    recentHistory,
    subjectRules: createPythonBeginnerRules(catalogLessonIds),
  });

  const model = getGenerationModel();
  const attemptNumber = 1;
  const started = Date.now();

  try {
    const result = await completeStructured<LessonOutput>({
      schema: lessonOutputSchema,
      schemaName: "lesson_output",
      system: prompts.system,
      user: prompts.user,
      model,
      maxTokens: getGenerationMaxTokens(),
      timeoutMs: getLlmTimeoutMs(),
      context: { lessonId: lesson.id },
    });

    if (result.data.lesson_id !== lesson.id) {
      throw new LlmStructuredOutputError(
        `lesson_id mismatch: expected ${lesson.id}, got ${result.data.lesson_id}`,
      );
    }

    const logId = await writeGenerationLog({
      lessonId: lesson.id,
      userId,
      attemptNumber,
      promptVersion: prompts.promptVersion,
      modelName: result.model,
      latencyMs: result.latencyMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      rawOutput: { output: result.raw, llmCalls: [result] } as Prisma.InputJsonValue,
      errors: [],
      outcome: GenerationOutcome.unvalidated,
    });

    return {
      response: buildGeneratedClientResponse(result.data),
      logId,
    };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const errors = formatError(error);
    const logId = await writeGenerationLog({
      lessonId: lesson.id,
      userId,
      attemptNumber,
      promptVersion: prompts.promptVersion,
      modelName: model,
      latencyMs,
      inputTokens: null,
      outputTokens: null,
      rawOutput: { llmCalls: [], error: errors } as Prisma.InputJsonValue,
      errors,
      outcome: GenerationOutcome.failed,
    });

    return { response: fallback, logId };
  }
}

export async function generateLessonContent(lessonId: string): Promise<GenerateLessonResult> {
  if (isDevSkipValidation()) {
    return runUnvalidatedPath(lessonId);
  }

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) {
    throw new Error("Lesson not found");
  }

  const learnerLevel = getStubLearnerLevel();
  const recentHistory = getStubRecentHistory();
  const userId = getStubUserId();
  const fallback = buildFallbackResponse(lesson, learnerLevel);

  const catalogLessonIds = (
    await prisma.lesson.findMany({ select: { id: true }, orderBy: { sortOrder: "asc" } })
  ).map((l) => l.id);

  const loop = await runCorrectionLoop({
    lesson,
    learnerLevel,
    recentHistory,
    subjectRules: createPythonBeginnerRules(catalogLessonIds),
    userId,
  });

  if (loop.ok) {
    return {
      response: buildGeneratedClientResponse(loop.output),
      logId: loop.logId,
    };
  }

  const fallbackLogId = await writeGenerationLog({
    lessonId: lesson.id,
    userId,
    attemptNumber: loop.attemptNumber + 1,
    promptVersion: "v1",
    modelName: null,
    latencyMs: null,
    inputTokens: null,
    outputTokens: null,
    rawOutput: { validationErrors: loop.errors } as Prisma.InputJsonValue,
    errors: loop.errors,
    outcome: GenerationOutcome.fallback,
  });

  return { response: fallback, logId: fallbackLogId };
}
