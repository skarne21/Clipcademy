import { NextResponse } from "next/server";
import { generateLessonContent } from "@/lib/generation/generate-lesson";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { lessonId?: string };
    const lessonId = body.lessonId?.trim();
    if (!lessonId) {
      return NextResponse.json({ error: "lessonId is required" }, { status: 400 });
    }

    const { response } = await generateLessonContent(lessonId);
    return NextResponse.json(response);
  } catch (error) {
    console.error("POST /api/generate failed:", error);
    const message = error instanceof Error ? error.message : "Generation failed";
    const status = message === "Lesson not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
