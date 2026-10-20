import { lessonOutputSchema, type LessonOutput } from "@/lib/schemas/lesson-output";
import { judgeOutputSchema } from "@/lib/schemas/judge-output";
import { PYTHON_BEGINNER_LIMITS, TOPIC_TAG_KEYWORDS } from "@/lib/subject-rules/python-beginner";
import { loadPromptTemplate, renderTemplate } from "@/lib/prompts/load-prompt";
import { completeStructured, getJudgeModel, getLlmTimeoutMs } from "@/lib/llm";
import type { LlmUsage } from "@/lib/llm/types";
import type { ValidatorContext, ValidationResult } from "./types";

function topicTagsForCheck(tags: string[]): string[] {
  return tags.filter((t) => t.toLowerCase() !== "python");
}

/**
 * Soft keyword alignment — does not fail when ambiguous; the LLM judge handles nuance.
 */
function validateTopicAlignment(output: LessonOutput, tags: string[]): string[] {
  const topicTags = topicTagsForCheck(tags);
  if (topicTags.length === 0) return [];

  const haystack = `${output.explanation} ${output.task.prompt}`.toLowerCase();

  const aligned = topicTags.some((tag) => {
    const keywords = TOPIC_TAG_KEYWORDS[tag] ?? [tag];
    return keywords.some((kw) => haystack.includes(kw.toLowerCase()));
  });

  if (aligned) return [];

  // No keyword hit: defer to judge (no hard failure on missing literal tag names).
  return [];
}

function validateLengths(output: LessonOutput): string[] {
  const errors: string[] = [];
  if (output.explanation.length > PYTHON_BEGINNER_LIMITS.explanationMaxChars) {
    errors.push(
      `Explanation exceeds ${PYTHON_BEGINNER_LIMITS.explanationMaxChars} characters`,
    );
  }
  if (output.task.prompt.length > PYTHON_BEGINNER_LIMITS.taskPromptMaxChars) {
    errors.push(`Task prompt exceeds ${PYTHON_BEGINNER_LIMITS.taskPromptMaxChars} characters`);
  }
  return errors;
}

async function runJudge(
  output: LessonOutput,
  context: ValidatorContext,
): Promise<{ errors: string[]; usage: LlmUsage | null }> {
  const system = loadPromptTemplate("judge-lesson-output.system.txt");
  const user = renderTemplate(loadPromptTemplate("judge-lesson-output.user.txt"), {
    lesson_notes: context.lesson.lessonNotes,
    learning_goal: context.lesson.learningGoal,
    explanation: output.explanation,
    task_prompt: output.task.prompt,
  });

  const result = await completeStructured({
    schema: judgeOutputSchema,
    schemaName: "judge_output",
    system,
    user,
    model: getJudgeModel(),
    maxTokens: 256,
    timeoutMs: getLlmTimeoutMs(),
  });

  if (!result.data.pass) {
    const reason = result.data.reason.trim() || "Judge flagged a contradiction with lesson notes";
    return {
      errors: [`Lesson notes judge failed: ${reason}`],
      usage: result,
    };
  }

  return { errors: [], usage: result };
}

export async function validateGeneral(
  output: LessonOutput,
  context: ValidatorContext,
): Promise<ValidationResult> {
  const llmCalls: LlmUsage[] = [];
  const errors: string[] = [];

  const parsed = lessonOutputSchema.safeParse(output);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `Schema: ${i.path.join(".")}: ${i.message}`),
      llmCalls,
    };
  }

  if (parsed.data.lesson_id !== context.lesson.id) {
    errors.push(`lesson_id must be ${context.lesson.id}`);
  }

  errors.push(...validateLengths(parsed.data));
  errors.push(...validateTopicAlignment(parsed.data, context.lesson.topicTags));

  if (errors.length > 0) {
    return { ok: false, errors, llmCalls };
  }

  try {
    const judge = await runJudge(parsed.data, context);
    if (judge.usage) llmCalls.push(judge.usage);
    errors.push(...judge.errors);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Judge call failed");
  }

  return { ok: errors.length === 0, errors, llmCalls };
}
