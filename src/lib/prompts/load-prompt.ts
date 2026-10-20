import { readFileSync } from "fs";
import { join } from "path";

export const PROMPT_VERSION = "v1";

const PROMPT_DIR = join(process.cwd(), "src", "lib", "prompts", PROMPT_VERSION);

export function loadPromptTemplate(filename: string): string {
  return readFileSync(join(PROMPT_DIR, filename), "utf-8");
}

export function renderTemplate(
  template: string,
  variables: Record<string, string | number>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(variables)) {
    out = out.replaceAll(`{{${key}}}`, String(value));
  }
  return out;
}
