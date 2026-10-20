import type { z } from "zod";

export type LlmUsage = {
  model: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
};

export type LlmTextResult = LlmUsage & {
  text: string;
};

export type StructuredCompletionContext = {
  lessonId?: string;
};

export type StructuredCompletionResult<T> = LlmUsage & {
  data: T;
  raw: unknown;
};

export interface LlmProvider {
  readonly name: string;

  completeText(options: {
    system: string;
    user: string;
    model?: string;
    maxTokens?: number;
    timeoutMs?: number;
  }): Promise<LlmTextResult>;

  completeStructured<T>(options: {
    schema: z.ZodType<T>;
    schemaName: string;
    system: string;
    user: string;
    model?: string;
    maxTokens?: number;
    timeoutMs?: number;
    context?: StructuredCompletionContext;
  }): Promise<StructuredCompletionResult<T>>;
}
