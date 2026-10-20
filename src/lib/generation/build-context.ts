import type { LearnerLevel, Lesson } from "@prisma/client";
import { loadPromptTemplate, renderTemplate } from "@/lib/prompts/load-prompt";
import type { SubjectRules } from "@/lib/subject-rules/python-beginner";
import type { RecentAttemptSummary } from "./learner-stub";

export type GenerationContextInput = {
  lesson: Pick<
    Lesson,
    | "id"
    | "title"
    | "topicTags"
    | "difficulty"
    | "learningGoal"
    | "lessonNotes"
  >;
  learnerLevel: LearnerLevel;
  recentHistory: RecentAttemptSummary[];
  subjectRules: SubjectRules;
};

export type BuiltGenerationPrompts = {
  promptVersion: string;
  system: string;
  user: string;
};

function formatRecentHistory(recentHistory: RecentAttemptSummary[]): string {
  if (recentHistory.length === 0) {
    return "(none yet)";
  }
  return recentHistory
    .map(
      (a) =>
        `- ${a.lessonId}: ${a.passed ? "passed" : "failed"}` +
        (a.mistakeType ? ` (${a.mistakeType})` : ""),
    )
    .join("\n");
}

/**
 * Builds generation prompts from exactly four inputs:
 * lesson, learner level, recent history, and subject rules (including catalog IDs).
 */
export function buildGenerationPrompts(input: GenerationContextInput): BuiltGenerationPrompts {
  const rules = input.subjectRules;
  const systemTemplate = loadPromptTemplate("generate-lesson.system.txt");
  const userTemplate = loadPromptTemplate("generate-lesson.user.txt");

  const system = renderTemplate(systemTemplate, {
    explanation_max_chars: rules.explanationMaxChars,
    task_prompt_max_chars: rules.taskPromptMaxChars,
    tone: rules.tone,
    grading_method: rules.gradingMethod,
  });

  const user = renderTemplate(userTemplate, {
    lesson_id: input.lesson.id,
    lesson_title: input.lesson.title,
    topic_tags: input.lesson.topicTags.join(", "),
    lesson_difficulty: input.lesson.difficulty,
    learning_goal: input.lesson.learningGoal,
    lesson_notes: input.lesson.lessonNotes,
    learner_level: input.learnerLevel,
    recent_attempts: formatRecentHistory(input.recentHistory),
    subject_id: rules.subjectId,
    output_format: rules.outputFormat,
    catalog_lesson_ids: rules.catalogLessonIds.join(", "),
  });

  return {
    promptVersion: "v1",
    system,
    user,
  };
}
