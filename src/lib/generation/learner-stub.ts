import type { LearnerLevel } from "@prisma/client";

export type RecentAttemptSummary = {
  lessonId: string;
  passed: boolean;
  mistakeType: string | null;
  createdAt: string;
};

/** Phase 2 stub — same fields Phase 4 will load from the database. */
export function getStubLearnerLevel(): LearnerLevel {
  return "beginner";
}

export function getStubRecentHistory(): RecentAttemptSummary[] {
  return [];
}

export function getStubUserId(): string | null {
  return null;
}
