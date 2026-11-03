import { describe, expect, it } from "vitest";
import { attemptContinue, attemptComplete, attemptNeedsReview, attemptReviewAgain } from "./attempts";
import { questions } from "./questions";
import { topics } from "./topics";
import { videoJobs } from "./videoJobs";

describe("fixtures contract samples", () => {
  it("has exactly four topics", () => {
    expect(topics).toHaveLength(4);
  });

  it("only marks dna_replication and dna_repair as available", () => {
    const available = topics.filter((t) => t.availability === "available");
    expect(available).toHaveLength(2);
    expect(available.map((t) => t.topic_id).sort()).toEqual(["dna_repair", "dna_replication"]);
    const comingSoon = topics.filter((t) => t.availability === "coming_soon");
    expect(comingSoon).toHaveLength(2);
    expect(comingSoon.map((t) => t.topic_id).sort()).toEqual(["transcription", "translation"]);
  });

  it("does not expose answer keys on question fixtures", () => {
    for (const question of Object.values(questions)) {
      const keys = Object.keys(question).map((k) => k.toLowerCase());
      expect(keys.some((k) => k.includes("correct"))).toBe(false);
      expect(keys.some((k) => k.includes("answer"))).toBe(false);
    }
  });

  it("requires next_video_request on review_again attempt results", () => {
    expect(attemptReviewAgain.action).toBe("review_again");
    expect(attemptReviewAgain.next_video_request).not.toBeNull();

    const reviewAgainFixtures = [attemptReviewAgain].filter((a) => a.action === "review_again");
    for (const attempt of reviewAgainFixtures) {
      expect(attempt.next_video_request).not.toBeNull();
    }
  });

  it("requires video_url on ready video jobs", () => {
    const readyJobs = Object.values(videoJobs).filter((job) => job.status === "ready");
    expect(readyJobs.length).toBeGreaterThan(0);
    for (const job of readyJobs) {
      expect(job.video_url).toBeTruthy();
    }
  });

  it("includes all four attempt action fixtures", () => {
    expect(attemptContinue.action).toBe("continue_questions");
    expect(attemptReviewAgain.action).toBe("review_again");
    expect(attemptComplete.action).toBe("complete");
    expect(attemptNeedsReview.action).toBe("needs_review");
  });
});
