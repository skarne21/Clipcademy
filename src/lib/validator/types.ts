import type { LessonOutput } from "@/lib/schemas/lesson-output";
import type { LlmUsage } from "@/lib/llm/types";

export type CatalogLesson = {
  id: string;
  difficulty: "beginner" | "intermediate";
};

export type ValidatorLesson = {
  id: string;
  topicTags: string[];
  lessonNotes: string;
  learningGoal: string;
};

export type ValidatorContext = {
  lesson: ValidatorLesson;
  catalog: CatalogLesson[];
  learnerLevel: "beginner" | "intermediate";
};

export type ValidationResult = {
  ok: boolean;
  errors: string[];
  llmCalls: LlmUsage[];
};

export type ValidateOutputFn = (
  output: LessonOutput,
  context: ValidatorContext,
) => Promise<ValidationResult>;
