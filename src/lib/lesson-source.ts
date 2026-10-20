/**
 * Approved catalog fields used by generation and validation (server-side only).
 * Replaces the former "transcript" with human-reviewed lesson notes.
 */
export type LessonSourceContent = {
  id: string;
  title: string;
  topicTags: string[];
  difficulty: string;
  learningGoal: string;
  lessonNotes: string;
  lessonNotesNeedsReview: boolean;
};
