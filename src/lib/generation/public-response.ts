import type { Lesson } from "@prisma/client";
import type { LearnerLevel } from "@prisma/client";
import type { LessonOutput } from "@/lib/schemas/lesson-output";

export type PublicCodeTask = {
  prompt: string;
  type: "code";
  function_name: string;
  starter_code: string;
  visible_tests: string[];
};

export type GenerateLessonResponse = {
  lessonId: string;
  learnerLevel: LearnerLevel;
  explanation: string;
  task: PublicCodeTask;
  source: "generated" | "fallback";
};

type FallbackTaskJson = {
  prompt: string;
  type: "code";
  function_name: string;
  starter_code: string;
  visible_tests: string[];
  hidden_tests?: string[];
};

export function buildFallbackResponse(
  lesson: Pick<Lesson, "id" | "fallbackExplanation" | "fallbackTask">,
  learnerLevel: LearnerLevel = "beginner",
): GenerateLessonResponse {
  const task = lesson.fallbackTask as FallbackTaskJson;
  return {
    lessonId: lesson.id,
    learnerLevel,
    explanation: lesson.fallbackExplanation,
    task: {
      prompt: task.prompt,
      type: "code",
      function_name: task.function_name,
      starter_code: task.starter_code,
      visible_tests: task.visible_tests ?? [],
    },
    source: "fallback",
  };
}

export function buildGeneratedClientResponse(output: LessonOutput): GenerateLessonResponse {
  return {
    lessonId: output.lesson_id,
    learnerLevel: output.learner_level,
    explanation: output.explanation,
    task: {
      prompt: output.task.prompt,
      type: "code",
      function_name: output.task.function_name,
      starter_code: output.task.starter_code,
      visible_tests: output.task.visible_tests,
    },
    source: "generated",
  };
}
