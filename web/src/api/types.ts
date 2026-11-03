export type TopicAvailability = "available" | "coming_soon";

export type TopicObjective = {
  objective_id: string;
  label: string;
};

export type Topic = {
  topic_id: string;
  label: string;
  source_refs: string[];
  availability: TopicAvailability;
  objectives: TopicObjective[];
};

export type QuestionChoice = {
  choice_id: string;
  text: string;
};

export type Question = {
  question_id: string;
  objective_id: string;
  prompt: string;
  choices: QuestionChoice[];
};

export type ObjectiveStatus = "not_started" | "in_progress" | "complete" | "needs_review";

export type RemediationState = {
  objective_status: ObjectiveStatus;
  expected_question_id: string | null;
  remediation_count: number;
  satisfied_question_ids: string[];
  asked_retry_ids: string[];
};

export type VideoRequest = {
  topic_id: string;
  objective_id: string;
  variant_id: string;
  teaching_goal: string;
  source_refs: string[];
};

export type AttemptRequest = {
  attempt_id: string;
  question_id: string;
  selected_choice_id: string;
  objective_id: string;
  remediation_state: RemediationState;
};

export type AttemptAction =
  | "continue_questions"
  | "review_again"
  | "complete"
  | "needs_review";

export type AttemptResult = {
  attempt_id: string;
  question_id: string;
  correct: boolean;
  action: AttemptAction;
  feedback: string;
  misconception_id: string | null;
  next_video_request: VideoRequest | null;
  next_question_id: string | null;
  remediation_state: RemediationState;
  source_refs: string[];
  /** TODO: pending Member 2 confirmation, needed for needs_review summary */
  key_points?: string[];
};

export type VideoJobStatus = "queued" | "running" | "ready" | "failed";

export type VideoJob = {
  job_id: string;
  status: VideoJobStatus;
  variant_id: string;
  video_url?: string;
  transcript?: string;
  source_refs: string[];
  error?: string;
};

/** TODO: column list pending Member 2 confirmation of events.csv */
export type ActivityEvent = {
  event_id: string;
  event_name: string;
  participant_code: string;
  build_id: string;
  session_id: string;
  client_timestamp: string;
  topic_id?: string;
  variant_id?: string;
  question_id?: string;
  correct?: boolean;
  objective_id?: string;
};

export type ApiError = {
  error: string;
  message: string;
};
