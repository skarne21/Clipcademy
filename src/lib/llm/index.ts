import type { z } from "zod";
import { getLlmProviderName } from "./config";
import type { StructuredCompletionContext } from "./types";
import { MockLlmProvider } from "./mock-provider";
import { OpenAiLlmProvider } from "./openai-provider";
import type { LlmProvider } from "./types";

export type {
  LlmProvider,
  LlmTextResult,
  LlmUsage,
  StructuredCompletionResult,
} from "./types";
export { LlmRefusalError, LlmStructuredOutputError } from "./errors";
export {
  getGenerationMaxTokens,
  getGenerationModel,
  getJudgeModel,
  getLlmProviderName,
  getLlmTimeoutMs,
  getOpenAiTextModel,
  isDevSkipValidation,
} from "./config";

let providerSingleton: LlmProvider | null = null;

export function getLlmProvider(): LlmProvider {
  if (providerSingleton) return providerSingleton;
  providerSingleton =
    getLlmProviderName() === "mock" ? new MockLlmProvider() : new OpenAiLlmProvider();
  return providerSingleton;
}

/** Reset provider (tests). */
export function resetLlmProvider(): void {
  providerSingleton = null;
}

export async function completeText(
  options: Parameters<LlmProvider["completeText"]>[0],
): Promise<import("./types").LlmTextResult> {
  return getLlmProvider().completeText(options);
}

export async function completeStructured<T>(options: {
  schema: z.ZodType<T>;
  schemaName: string;
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
  context?: StructuredCompletionContext;
}): Promise<import("./types").StructuredCompletionResult<T>> {
  return getLlmProvider().completeStructured<T>(options);
}
