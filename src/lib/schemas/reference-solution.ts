import { z } from "zod";

export const referenceSolutionSchema = z
  .object({
    solution_code: z.string().min(1),
  })
  .strict();

export type ReferenceSolution = z.infer<typeof referenceSolutionSchema>;
