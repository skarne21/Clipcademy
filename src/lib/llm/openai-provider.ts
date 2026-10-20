import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { LlmRefusalError, LlmStructuredOutputError } from "./errors";
import type { LlmProvider, LlmTextResult, StructuredCompletionResult } from "./types";

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return key;
}

export class OpenAiLlmProvider implements LlmProvider {
  readonly name = "openai";
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({ apiKey: getApiKey() });
    }
    return this.client;
  }

  async completeText(options: {
    system: string;
    user: string;
    model?: string;
    maxTokens?: number;
    timeoutMs?: number;
  }): Promise<LlmTextResult> {
    const started = Date.now();
    const client = this.getClient();
    const completion = await client.chat.completions.create(
      {
        model: options.model ?? "gpt-4o-mini",
        max_tokens: options.maxTokens ?? 512,
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.user },
        ],
      },
      { timeout: options.timeoutMs ?? 60_000 },
    );

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) {
      throw new LlmStructuredOutputError("OpenAI returned empty text");
    }

    return {
      text,
      model: completion.model,
      latencyMs: Date.now() - started,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    };
  }

  async completeStructured<T>(options: {
    schema: z.ZodType<T>;
    schemaName: string;
    system: string;
    user: string;
    model?: string;
    maxTokens?: number;
    timeoutMs?: number;
  }): Promise<StructuredCompletionResult<T>> {
    const started = Date.now();
    const client = this.getClient();

    const completion = await client.chat.completions.parse(
      {
        model: options.model ?? "gpt-4o-mini",
        max_tokens: options.maxTokens ?? 2048,
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.user },
        ],
        response_format: zodResponseFormat(options.schema, options.schemaName),
      },
      { timeout: options.timeoutMs ?? 60_000 },
    );

    const message = completion.choices[0]?.message;
    if (message?.refusal) {
      throw new LlmRefusalError(message.refusal);
    }

    const parsed = message?.parsed;
    if (parsed === null || parsed === undefined) {
      const finish = completion.choices[0]?.finish_reason;
      throw new LlmStructuredOutputError(
        `OpenAI structured parse failed (finish_reason=${finish ?? "unknown"})`,
      );
    }

    const validated = options.schema.safeParse(parsed);
    if (!validated.success) {
      throw new LlmStructuredOutputError(
        "OpenAI output failed Zod validation",
        validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      );
    }

    return {
      data: validated.data,
      raw: parsed,
      model: completion.model,
      latencyMs: Date.now() - started,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    };
  }
}
