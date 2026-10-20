import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toPublicLesson } from "@/lib/lessons-public";

export async function GET() {
  try {
    const lessons = await prisma.lesson.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        videoUrl: true,
        youtubeId: true,
        topicTags: true,
        difficulty: true,
        learningGoal: true,
        sortOrder: true,
      },
    });

    return NextResponse.json({
      lessons: lessons.map(toPublicLesson),
    });
  } catch (error) {
    console.error("GET /api/lessons failed:", error);
    return NextResponse.json(
      { error: "Failed to load lessons. Is the database running and migrated?" },
      { status: 500 },
    );
  }
}
