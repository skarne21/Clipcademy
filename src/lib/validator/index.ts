import type { LessonOutput } from "@/lib/schemas/lesson-output";
import { validateGeneral } from "./general";
import { validatePython, type PythonValidatorDeps } from "./python";
import type { ValidatorContext, ValidationResult } from "./types";

export type { ValidatorContext, ValidationResult, CatalogLesson, ValidatorLesson } from "./types";
export { validateGeneral } from "./general";
export { validatePython, type PythonValidatorDeps } from "./python";

export type FullValidatorDeps = PythonValidatorDeps;

export async function validateLessonOutput(
  output: LessonOutput,
  context: ValidatorContext,
  deps?: FullValidatorDeps,
): Promise<ValidationResult> {
  const general = await validateGeneral(output, context);
  if (!general.ok) {
    return general;
  }

  const python = await validatePython(output, context, deps);
  return {
    ok: python.ok,
    errors: [...general.errors, ...python.errors],
    llmCalls: [...general.llmCalls, ...python.llmCalls],
  };
}
