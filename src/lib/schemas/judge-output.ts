import { z } from "zod";

export const judgeOutputSchema = z
  .object({
    pass: z.boolean(),
    reason: z.string(),
  })
  .strict();

export type JudgeOutput = z.infer<typeof judgeOutputSchema>;
