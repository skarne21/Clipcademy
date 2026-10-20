import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

export type VideoCandidate = {
  youtubeId: string;
  title: string;
  channelTitle: string;
  duration: string;
  durationSeconds: number;
};

export type SeedLesson = {
  id: string;
  title: string;
  videoUrl: string;
  youtubeId: string;
  videoTitle?: string;
  videoChannel?: string;
  videoDuration?: string;
  videoDurationSeconds?: number;
  videoAlternates?: VideoCandidate[];
  topicTags: string[];
  difficulty: "beginner" | "intermediate";
  learningGoal: string;
  lessonNotes: string;
  lessonNotesNeedsReview: boolean;
  fallbackExplanation: string;
  fallbackTask: Record<string, unknown>;
  sortOrder: number;
};

export type SeedFile = { lessons: SeedLesson[] };

const SEED_PATH = join(process.cwd(), "data", "lessons.seed.json");

function normalizeLesson(raw: SeedLesson & { transcript?: string }): SeedLesson {
  if (!raw.lessonNotes && raw.transcript) {
    raw.lessonNotes = raw.transcript;
  }
  if (raw.lessonNotesNeedsReview === undefined) {
    raw.lessonNotesNeedsReview = true;
  }
  return raw;
}

export function loadSeedFile(path = SEED_PATH): SeedFile {
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw) as { lessons: (SeedLesson & { transcript?: string })[] };
  return { lessons: parsed.lessons.map(normalizeLesson) };
}

export function saveSeedFile(data: SeedFile, path = SEED_PATH): void {
  const lessons = data.lessons.map((lesson) => {
    const copy = { ...lesson } as SeedLesson & { transcript?: string };
    delete copy.transcript;
    return copy;
  });
  writeFileSync(path, `${JSON.stringify({ lessons }, null, 2)}\n`, "utf-8");
}

export function buildSearchQuery(lesson: SeedLesson): string {
  const tags = lesson.topicTags.filter((t) => t !== "python").join(" ");
  return `${lesson.title} Python tutorial ${tags}`.trim();
}

export function watchUrl(youtubeId: string): string {
  return `https://www.youtube.com/watch?v=${youtubeId}`;
}
