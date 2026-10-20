import type { Difficulty } from "@prisma/client";

/** Catalog fields safe to send to the client (no lessonNotes, fallback, or hidden tests). */
export type PublicLesson = {
  id: string;
  title: string;
  videoUrl: string;
  youtubeId: string;
  topicTags: string[];
  difficulty: Difficulty;
  learningGoal: string;
  sortOrder: number;
};

export function toPublicLesson(lesson: {
  id: string;
  title: string;
  videoUrl: string;
  youtubeId: string;
  topicTags: string[];
  difficulty: Difficulty;
  learningGoal: string;
  sortOrder: number;
}): PublicLesson {
  return {
    id: lesson.id,
    title: lesson.title,
    videoUrl: lesson.videoUrl,
    youtubeId: lesson.youtubeId,
    topicTags: lesson.topicTags,
    difficulty: lesson.difficulty,
    learningGoal: lesson.learningGoal,
    sortOrder: lesson.sortOrder,
  };
}
