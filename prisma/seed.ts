import { Prisma, PrismaClient, Difficulty } from "@prisma/client";
import { loadSeedFile, type SeedLesson } from "../src/lib/seed-lesson";

const prisma = new PrismaClient();

async function main() {
  const data = loadSeedFile();

  for (const lesson of data.lessons) {
    await upsertLesson(lesson);
  }

  console.log(`Seeded ${data.lessons.length} lessons.`);
}

async function upsertLesson(lesson: SeedLesson) {
  const payload = {
    title: lesson.title,
    videoUrl: lesson.videoUrl,
    youtubeId: lesson.youtubeId,
    videoTitle: lesson.videoTitle ?? null,
    videoChannel: lesson.videoChannel ?? null,
    videoDuration: lesson.videoDuration ?? null,
    videoDurationSeconds: lesson.videoDurationSeconds ?? null,
    lessonNotes: lesson.lessonNotes,
    lessonNotesNeedsReview: lesson.lessonNotesNeedsReview,
    topicTags: lesson.topicTags,
    difficulty: lesson.difficulty as Difficulty,
    learningGoal: lesson.learningGoal,
    fallbackExplanation: lesson.fallbackExplanation,
    fallbackTask: lesson.fallbackTask as Prisma.InputJsonValue,
    sortOrder: lesson.sortOrder,
  };

  await prisma.lesson.upsert({
    where: { id: lesson.id },
    create: { id: lesson.id, ...payload },
    update: payload,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
