import { http, HttpResponse } from "msw";
import type { Question, VideoJob } from "../api/types";
import { apiUrl } from "../api/config";
import {
  attemptComplete,
  attemptContinue,
  attemptReviewAgain,
} from "../fixtures/attempts";
import { repQ1 } from "../fixtures/questions";
import {
  videoJobQueued,
  videoJobReady,
} from "../fixtures/videoJobs";

const repQ2: Question = {
  question_id: "rep-q2",
  objective_id: "synthesis_direction_and_primer",
  prompt: "Why is a primer needed?",
  choices: [
    {
      choice_id: "A",
      text: "DNA polymerase needs an existing complementary strand to extend",
    },
    { choice_id: "B", text: "Ligase adds all new bases" },
    { choice_id: "C", text: "DNA is synthesized only 3′ to 5′" },
  ],
};

const repR2: Question = {
  question_id: "rep-r2",
  objective_id: "synthesis_direction_and_primer",
  prompt: "Which enzyme makes the RNA primer?",
  choices: [
    { choice_id: "A", text: "Ligase" },
    { choice_id: "B", text: "Primase" },
    { choice_id: "C", text: "DNA polymerase" },
  ],
};

export const walkthroughQuestions: Record<string, Question> = {
  "rep-q2": repQ2,
  "rep-r2": repR2,
};

export function isWalkthroughScenario(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).get("scenario") === "walkthrough";
}

type AttemptBody = {
  attempt_id: string;
  question_id: string;
};

let walkthroughAttemptStep = 0;
let walkthroughJobCounter = 0;

type JobRecord = {
  startedAt: number;
  variant_id: string;
  source_refs: string[];
};

const walkthroughJobs = new Map<string, JobRecord>();

const QUEUED_MS = 700;
const RUNNING_MS = 1400;

function walkthroughAttemptResponse(body: AttemptBody) {
  const step = walkthroughAttemptStep;
  walkthroughAttemptStep += 1;

  if (step === 0) {
    return {
      ...attemptContinue,
      attempt_id: body.attempt_id,
      question_id: body.question_id,
    };
  }
  if (step === 1) {
    return {
      ...attemptReviewAgain,
      attempt_id: body.attempt_id,
      question_id: body.question_id,
    };
  }
  return {
    ...attemptComplete,
    attempt_id: body.attempt_id,
    question_id: body.question_id,
  };
}

function walkthroughJobStatus(jobId: string): VideoJob | null {
  const record = walkthroughJobs.get(jobId);
  if (!record) {
    return null;
  }
  const elapsed = Date.now() - record.startedAt;
  const base = {
    job_id: jobId,
    variant_id: record.variant_id,
    source_refs: record.source_refs,
  };
  if (elapsed < QUEUED_MS) {
    return { ...base, status: "queued" as const };
  }
  if (elapsed < RUNNING_MS) {
    return { ...base, status: "running" as const };
  }
  return {
    ...base,
    status: "ready" as const,
    video_url: videoJobReady.video_url,
    transcript: videoJobReady.transcript,
  };
}

export const walkthroughHandlers = [
  http.get(apiUrl("/questions/:questionId"), ({ params }) => {
    const questionId = params.questionId as string;
    if (questionId === "rep-q1") {
      return HttpResponse.json(repQ1);
    }
    const question = walkthroughQuestions[questionId];
    if (!question) {
      return HttpResponse.json(
        { error: "not_found", message: `Question not found: ${questionId}` },
        { status: 404 },
      );
    }
    return HttpResponse.json(question);
  }),

  http.post(apiUrl("/attempts"), async ({ request }) => {
    const body = (await request.json()) as AttemptBody;
    return HttpResponse.json(walkthroughAttemptResponse(body));
  }),

  http.post(apiUrl("/video-jobs"), async ({ request }) => {
    const body = (await request.json()) as {
      variant_id: string;
      source_refs: string[];
    };
    walkthroughJobCounter += 1;
    const job_id = `walkthrough-video-${walkthroughJobCounter}`;
    walkthroughJobs.set(job_id, {
      startedAt: Date.now(),
      variant_id: body.variant_id,
      source_refs: body.source_refs,
    });
    return HttpResponse.json({
      ...videoJobQueued,
      job_id,
      variant_id: body.variant_id,
      source_refs: body.source_refs,
    });
  }),

  http.get(apiUrl("/video-jobs/:jobId"), ({ params }) => {
    const jobId = params.jobId as string;
    const status = walkthroughJobStatus(jobId);
    if (!status) {
      return HttpResponse.json(
        { error: "not_found", message: `Video job not found: ${jobId}` },
        { status: 404 },
      );
    }
    return HttpResponse.json(status);
  }),
];
