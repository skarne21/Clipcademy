import { z } from "zod";

export const learnerLevelSchema = z.enum(["beginner", "intermediate"]);

export const mistakeTypeSchema = z.enum([
  "off_by_one",
  "missing_return",
  "wrong_type",
  "infinite_loop",
  "syntax_error",
  "other",
]);

export const generatedTaskSchema = z.object({
  prompt: z.string().min(1),
  type: z.literal("code"),
  function_name: z.string().min(1),
  starter_code: z.string(),
  visible_tests: z.array(z.string().min(1)).min(1),
  hidden_tests: z.array(z.string().min(1)).min(1),
});

export const followUpSchema = z.object({
  lesson_id: z.string().min(1),
  reason: z.string().min(1),
});

/** Full structured output from the lesson generation model (server-side). */
export const lessonOutputSchema = z
  .object({
    lesson_id: z.string().min(1),
    learner_level: learnerLevelSchema,
    explanation: z.string().min(1),
    task: generatedTaskSchema,
    hint_targets: z.array(mistakeTypeSchema),
    follow_up: followUpSchema,
  })
  .strict();

export type LessonOutput = z.infer<typeof lessonOutputSchema>;
