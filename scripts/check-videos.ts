import { loadEnv } from "./load-env";
import { PrismaClient } from "@prisma/client";
import { fetchVideoDetails, formatDuration, validateVideoDetails } from "../src/lib/youtube/data-api";
import { loadSeedFile } from "../src/lib/seed-lesson";

loadEnv();

type Issue = {
  source: string;
  lessonId: string;
  youtubeId: string;
  problems: string;
};

async function main() {
  const seed = loadSeedFile();
  const ids = new Set<string>();

  for (const lesson of seed.lessons) {
    ids.add(lesson.youtubeId);
    for (const alt of lesson.videoAlternates ?? []) {
      ids.add(alt.youtubeId);
    }
  }

  const prisma = new PrismaClient();
  let dbLessons: { id: string; youtubeId: string }[] = [];
  try {
    dbLessons = await prisma.lesson.findMany({
      select: { id: true, youtubeId: true },
    });
  } catch (error) {
    console.warn(
      "Skipping database check (is Postgres running and DATABASE_URL set?):",
      error instanceof Error ? error.message : error,
    );
  } finally {
    await prisma.$disconnect();
  }

  for (const row of dbLessons) {
    ids.add(row.youtubeId);
  }

  const detailsMap = await fetchVideoDetails([...ids]);
  const issues: Issue[] = [];

  function check(source: string, lessonId: string, youtubeId: string) {
    const details = detailsMap.get(youtubeId);
    if (!details) {
      issues.push({ source, lessonId, youtubeId, problems: "not found or unavailable" });
      return;
    }
    const validation = validateVideoDetails(details);
    if (!validation.ok) {
      issues.push({ source, lessonId, youtubeId, problems: validation.reasons.join("; ") });
    }
  }

  for (const lesson of seed.lessons) {
    check("seed:primary", lesson.id, lesson.youtubeId);
    for (const alt of lesson.videoAlternates ?? []) {
      check(`seed:alternate`, lesson.id, alt.youtubeId);
    }
  }

  for (const row of dbLessons) {
    check("database", row.id, row.youtubeId);
  }

  console.log(`\nChecked ${ids.size} unique video ID(s).\n`);

  if (issues.length === 0) {
    console.log("All videos are public, embeddable, and under 10 minutes.\n");
    return;
  }

  console.table(
    issues.map((i) => ({
      source: i.source,
      lessonId: i.lessonId,
      youtubeId: i.youtubeId,
      problems: i.problems,
    })),
  );

  const validSample = [...detailsMap.values()].filter((d) => validateVideoDetails(d).ok);
  if (validSample[0]) {
    console.log(
      "\nExample valid video:",
      validSample[0].title,
      `(${formatDuration(validSample[0].durationSeconds)})`,
    );
  }

  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
