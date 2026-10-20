import { GenerationOutcome, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type GenerationLogInput = {
  lessonId: string;
  userId?: string | null;
  attemptNumber: number;
  promptVersion: string | null;
  modelName: string | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  rawOutput?: Prisma.InputJsonValue | null;
  errors: string[];
  outcome: GenerationOutcome;
};

export async function writeGenerationLog(input: GenerationLogInput): Promise<string> {
  const row = await prisma.generationLog.create({
    data: {
      lessonId: input.lessonId,
      userId: input.userId ?? null,
      attemptNumber: input.attemptNumber,
      promptVersion: input.promptVersion,
      modelName: input.modelName,
      latencyMs: input.latencyMs,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      rawOutput:
        input.rawOutput === undefined || input.rawOutput === null
          ? Prisma.JsonNull
          : input.rawOutput,
      errors: input.errors,
      outcome: input.outcome,
    },
  });
  return row.id;
}
