import { readFileSync } from "fs";
import { join } from "path";
import { loadEnv } from "./load-env";
import { completeText, getGenerationModel, getLlmTimeoutMs } from "../src/lib/llm";
import { fetchVideoDetails } from "../src/lib/youtube/data-api";
import { loadSeedFile, saveSeedFile } from "../src/lib/seed-lesson";

loadEnv();

const PROMPT_VERSION = "generate-lesson-notes-v1";
const force = process.argv.includes("--force");

function loadSystemPrompt(): string {
  const path = join(process.cwd(), "src", "lib", "prompts", `${PROMPT_VERSION}.txt`);
  return readFileSync(path, "utf-8");
}

async function main() {
  const system = loadSystemPrompt();
  const data = loadSeedFile();
  const rows: {
    lessonId: string;
    action: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
  }[] = [];

  for (const lesson of data.lessons) {
    if (!force && lesson.lessonNotes?.trim() && lesson.lessonNotesNeedsReview === false) {
      rows.push({
        lessonId: lesson.id,
        action: "skipped (reviewed)",
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
      });
      continue;
    }

    const detailsMap = await fetchVideoDetails([lesson.youtubeId]);
    const video = detailsMap.get(lesson.youtubeId);
    const videoTitle = video?.title ?? lesson.videoTitle ?? lesson.title;
    const description = video?.description?.slice(0, 4000) ?? "";

    const user = [
      `Catalog lesson title: ${lesson.title}`,
      `Learning goal: ${lesson.learningGoal}`,
      `Video title: ${videoTitle}`,
      `Video description:\n${description || "(no description available)"}`,
    ].join("\n\n");

    const result = await completeText({
      system,
      user,
      model: getGenerationModel(),
      timeoutMs: getLlmTimeoutMs(),
    });
    lesson.lessonNotes = result.text;
    lesson.lessonNotesNeedsReview = true;

    rows.push({
      lessonId: lesson.id,
      action: force ? "regenerated (--force)" : "generated",
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: result.latencyMs,
    });
  }

  saveSeedFile(data);

  console.log("\ngenerate-lesson-notes summary\n");
  console.table(rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
