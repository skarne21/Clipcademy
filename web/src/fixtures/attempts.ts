import type { AttemptResult } from "../api/types";

export const attemptContinue: AttemptResult = {
  attempt_id: "attempt-001",
  question_id: "rep-q1",
  correct: true,
  action: "continue_questions",
  feedback: "Correct. DNA polymerase adds nucleotides to the 3′ end.",
  misconception_id: null,
  next_video_request: null,
  next_question_id: "rep-q2",
  remediation_state: {
    objective_status: "in_progress",
    expected_question_id: "rep-q2",
    remediation_count: 0,
    satisfied_question_ids: ["rep-q1"],
    asked_retry_ids: [],
  },
  source_refs: ["L19-p1", "L19-p2"],
};

export const attemptReviewAgain: AttemptResult = {
  attempt_id: "attempt-001",
  question_id: "rep-q2",
  correct: false,
  action: "review_again",
  feedback:
    "Ligase joins pieces of DNA. It does not add the new bases. DNA polymerase extends a primer that primase made.",
  misconception_id: "primer_requirement",
  next_video_request: {
    topic_id: "dna_replication",
    objective_id: "synthesis_direction_and_primer",
    variant_id: "primer_followup",
    teaching_goal: "Explain why DNA polymerase needs a primer",
    source_refs: ["L19-p1", "L19-p2"],
  },
  next_question_id: "rep-r2",
  remediation_state: {
    objective_status: "in_progress",
    expected_question_id: "rep-r2",
    remediation_count: 1,
    satisfied_question_ids: ["rep-q1"],
    asked_retry_ids: ["rep-r2"],
  },
  source_refs: ["L19-p1", "L19-p2"],
};

export const attemptComplete: AttemptResult = {
  attempt_id: "attempt-002",
  question_id: "rep-q3",
  correct: true,
  action: "complete",
  feedback: "Objective complete.",
  misconception_id: null,
  next_video_request: null,
  next_question_id: null,
  remediation_state: {
    objective_status: "complete",
    expected_question_id: null,
    remediation_count: 0,
    satisfied_question_ids: ["rep-q1", "rep-q2", "rep-q3"],
    asked_retry_ids: [],
  },
  source_refs: ["L19-p1", "L19-p2", "L19-p3"],
};

export const attemptNeedsReview: AttemptResult = {
  attempt_id: "attempt-003",
  question_id: "rep-r2",
  correct: false,
  action: "needs_review",
  feedback: "Let's pause and review the key ideas before continuing.",
  misconception_id: "primer_requirement",
  next_video_request: null,
  next_question_id: null,
  remediation_state: {
    objective_status: "needs_review",
    expected_question_id: null,
    remediation_count: 2,
    satisfied_question_ids: ["rep-q1"],
    asked_retry_ids: ["rep-r2", "rep-r2"],
  },
  source_refs: ["L19-p1", "L19-p2"],
  key_points: [
    "DNA polymerase can only extend from a 3′ OH.",
    "Primase synthesizes a short RNA primer to start synthesis.",
  ],
};
