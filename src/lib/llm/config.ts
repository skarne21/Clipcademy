export type LlmProviderName = "openai" | "mock";

export function getLlmProviderName(): LlmProviderName {
  const raw = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (raw === "mock") return "mock";
  return "openai";
}

export function getLlmTimeoutMs(): number {
  const n = Number(process.env.LLM_TIMEOUT_MS ?? 60_000);
  return Number.isFinite(n) && n > 0 ? n : 60_000;
}

export function getGenerationMaxTokens(): number {
  const n = Number(process.env.OPENAI_GENERATION_MAX_TOKENS ?? 2048);
  return Number.isFinite(n) && n > 0 ? n : 2048;
}

export function getGenerationModel(): string {
  return process.env.OPENAI_GENERATION_MODEL?.trim() || "gpt-4o-mini";
}

export function getJudgeModel(): string {
  return process.env.OPENAI_JUDGE_MODEL?.trim() || "gpt-4o-mini";
}

/** @deprecated Use getGenerationModel — kept for scripts that only need one model. */
export function getOpenAiTextModel(): string {
  return getGenerationModel();
}

export function isDevSkipValidation(): boolean {
  return process.env.DEV_SKIP_VALIDATION === "true";
}
