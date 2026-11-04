import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import type { AttemptRequest } from "../api/types";
import { apiUrl } from "../api/config";
import {
  attemptComplete,
  attemptContinue,
  attemptReviewAgain,
} from "../fixtures/attempts";
import { repQ1 } from "../fixtures/questions";
import { videoJobReady } from "../fixtures/videoJobs";
import { getObjectiveStart } from "../content/objectiveMap";
import { server } from "../mocks/server";
import {
  createDefaultProgressState,
  loadParticipantCode,
  loadProgress,
  recordAttemptRequest,
  saveParticipantCode,
  saveProgress,
} from "../storage/progress";
import {
  createMemoryStorage,
  eventsNamed,
  refreshApp,
  renderApp,
} from "./testUtils";

const TOPIC_ID = "dna_replication";
const OBJECTIVE_ID = "synthesis_direction_and_primer";

function lessonContextFields() {
  const start = getObjectiveStart(OBJECTIVE_ID)!;
  return {
    topic_id: TOPIC_ID,
    objective_id: OBJECTIVE_ID,
    initial_video_request: start.initial_video_request,
    initial_first_question_id: start.first_question_id,
  };
}

function seedParticipantAndTopics(storage: Storage) {
  saveParticipantCode("P001", storage);
  saveProgress(
    {
      ...createDefaultProgressState(),
      selected_topic_ids: [TOPIC_ID],
    },
    storage,
  );
}

describe("App refresh restore", () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it("returns to the same question after a refresh on the question screen", async () => {
    const storage = createMemoryStorage();
    seedParticipantAndTopics(storage);
    saveProgress(
      {
        ...loadProgress(storage),
        current_step: {
          screen: "question",
          question_id: "rep-q1",
          ...lessonContextFields(),
        },
      },
      storage,
    );

    renderApp({ storage, participantCode: "P001", selectedTopicIds: [TOPIC_ID] });
    await waitFor(() => {
      expect(screen.getByRole("group", { name: repQ1.prompt })).toBeInTheDocument();
    });

    refreshApp({ storage, participantCode: "P001", selectedTopicIds: [TOPIC_ID] });
    await waitFor(() => {
      expect(screen.getByRole("group", { name: repQ1.prompt })).toBeInTheDocument();
    });
  });

  it("returns to the question after submit before the result arrives, and resubmit reuses attempt_id", async () => {
    const user = userEvent.setup();
    const storage = createMemoryStorage();
    seedParticipantAndTopics(storage);
    const pendingAttemptId = "gen-restore-pending";
    const request: AttemptRequest = {
      attempt_id: pendingAttemptId,
      question_id: "rep-q1",
      selected_choice_id: "B",
      objective_id: OBJECTIVE_ID,
      remediation_state: {
        objective_status: "not_started",
        expected_question_id: null,
        remediation_count: 0,
        satisfied_question_ids: [],
        asked_retry_ids: [],
      },
    };
    recordAttemptRequest(request, storage);
    saveProgress(
      {
        ...loadProgress(storage),
        current_step: {
          screen: "question",
          question_id: "rep-q1",
          attempt_id: pendingAttemptId,
          ...lessonContextFields(),
        },
      },
      storage,
    );

    const attemptIds: string[] = [];
    server.use(
      http.post(apiUrl("/attempts"), async ({ request: req }) => {
        const body = (await req.json()) as AttemptRequest;
        attemptIds.push(body.attempt_id);
        return HttpResponse.json({
          ...attemptContinue,
          attempt_id: body.attempt_id,
        });
      }),
    );

    renderApp({ storage, participantCode: "P001", selectedTopicIds: [TOPIC_ID] });
    await waitFor(() => {
      expect(screen.getByRole("group", { name: repQ1.prompt })).toBeInTheDocument();
    });

    refreshApp({ storage, participantCode: "P001", selectedTopicIds: [TOPIC_ID] });
    await waitFor(() => {
      expect(screen.getByRole("group", { name: repQ1.prompt })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("radio", { name: "3′ end" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Correct" })).toBeInTheDocument();
    });
    expect(attemptIds).toEqual([pendingAttemptId]);
  });

  it("returns to feedback with the same result after a refresh", async () => {
    const storage = createMemoryStorage();
    seedParticipantAndTopics(storage);
    const result = {
      ...attemptContinue,
      attempt_id: "gen-feedback-restore",
    };
    saveProgress(
      {
        ...loadProgress(storage),
        attempts: {
          [result.attempt_id]: {
            request: {
              attempt_id: result.attempt_id,
              question_id: "rep-q1",
              selected_choice_id: "B",
              objective_id: OBJECTIVE_ID,
              remediation_state: result.remediation_state,
            },
            result,
          },
        },
        current_step: {
          screen: "feedback",
          attempt_id: result.attempt_id,
          question_id: "rep-q1",
          ...lessonContextFields(),
        },
      },
      storage,
    );

    renderApp({ storage, participantCode: "P001", selectedTopicIds: [TOPIC_ID] });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Correct" })).toBeInTheDocument();
    });

    refreshApp({ storage, participantCode: "P001", selectedTopicIds: [TOPIC_ID] });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Correct" })).toBeInTheDocument();
      expect(screen.getByText(result.feedback)).toBeInTheDocument();
    });
  });

  it("resumes follow-up preparing polling the saved job and then plays the follow-up", async () => {
    const storage = createMemoryStorage();
    seedParticipantAndTopics(storage);
    saveProgress(
      {
        ...loadProgress(storage),
        current_step: {
          screen: "followup_preparing",
          video_job_id: "video-followup-restore",
          video_request: attemptReviewAgain.next_video_request!,
          pending_question_id: "rep-r2",
          ...lessonContextFields(),
        },
      },
      storage,
    );

    server.use(
      http.get(apiUrl("/video-jobs/:jobId"), ({ params }) => {
        const jobId = params.jobId as string;
        if (jobId === "video-followup-restore") {
          return HttpResponse.json({
            ...videoJobReady,
            job_id: jobId,
            variant_id: "primer_followup",
            video_url: "https://example.com/followup-restore.mp4",
          });
        }
        return HttpResponse.json(
          { error: "not_found", message: "missing" },
          { status: 404 },
        );
      }),
    );

    renderApp({ storage, participantCode: "P001", selectedTopicIds: [TOPIC_ID] });
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Preparing a short follow-up" }),
      ).toBeInTheDocument();
    });

    refreshApp({ storage, participantCode: "P001", selectedTopicIds: [TOPIC_ID] });
    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toHaveAttribute(
        "src",
        "https://example.com/followup-restore.mp4",
      );
    });
  });

  it("on a ready lesson refresh shows preparing, re-fetches the job, then plays", async () => {
    const storage = createMemoryStorage();
    seedParticipantAndTopics(storage);
    const start = getObjectiveStart(OBJECTIVE_ID)!;
    saveProgress(
      {
        ...loadProgress(storage),
        current_step: {
          screen: "lesson",
          video_job_id: "video-001",
          video_kind: "initial",
          pending_question_id: "rep-q1",
          video_request: start.initial_video_request,
          ...lessonContextFields(),
        },
      },
      storage,
    );

    renderApp({ storage, participantCode: "P001", selectedTopicIds: [TOPIC_ID] });
    await waitFor(() => {
      expect(screen.getByText(/Preparing your video/)).toBeInTheDocument();
    });

    refreshApp({ storage, participantCode: "P001", selectedTopicIds: [TOPIC_ID] });
    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toBeInTheDocument();
    });
  });

  it("keeps the summary after refresh, and Restart still works", async () => {
    const user = userEvent.setup();
    const storage = createMemoryStorage();
    seedParticipantAndTopics(storage);
    const result = {
      ...attemptComplete,
      attempt_id: "gen-summary-restore",
      question_id: "rep-r2",
    };
    saveProgress(
      {
        ...loadProgress(storage),
        remediation_states: {
          [OBJECTIVE_ID]: result.remediation_state,
        },
        attempts: {
          [result.attempt_id]: {
            request: {
              attempt_id: result.attempt_id,
              question_id: "rep-r2",
              selected_choice_id: "A",
              objective_id: OBJECTIVE_ID,
              remediation_state: {
                objective_status: "in_progress",
                expected_question_id: "rep-r2",
                remediation_count: 1,
                satisfied_question_ids: ["rep-q1"],
                asked_retry_ids: [],
              },
            },
            result,
          },
        },
        current_step: {
          screen: "summary",
          attempt_id: result.attempt_id,
          ...lessonContextFields(),
        },
      },
      storage,
    );

    renderApp({ storage, participantCode: "P001", selectedTopicIds: [TOPIC_ID] });
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Objective complete" }),
      ).toBeInTheDocument();
    });

    refreshApp({ storage, participantCode: "P001", selectedTopicIds: [TOPIC_ID] });
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Objective complete" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Restart this objective" }));
    await waitFor(() => {
      expect(screen.getByText(/Preparing your video/)).toBeInTheDocument();
    });
  });

  it("starts a new session_id on app_opened after a refresh", async () => {
    const user = userEvent.setup();
    const storage = createMemoryStorage();

    const { send: sendFirst } = renderApp({ storage });
    await user.type(screen.getByLabelText("Participant code"), "P001");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(eventsNamed(sendFirst, "app_opened").length).toBeGreaterThanOrEqual(1);
    });
    const firstSessionId = eventsNamed(sendFirst, "app_opened")[0]!.session_id;

    const { send: sendSecond } = refreshApp({
      storage,
      participantCode: "P001",
      selectedTopicIds: [TOPIC_ID],
    });
    await waitFor(() => {
      expect(eventsNamed(sendSecond, "app_opened").length).toBeGreaterThanOrEqual(1);
    });
    const secondSessionId = eventsNamed(sendSecond, "app_opened")[0]!.session_id;

    expect(secondSessionId).not.toBe(firstSessionId);
  });

  it("after Reset demo, refresh shows topics with participant code kept", async () => {
    const user = userEvent.setup();
    const storage = createMemoryStorage();

    const { send } = renderApp({ storage });
    await user.type(screen.getByLabelText("Participant code"), "P001");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "DNA Replication" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("checkbox", { name: "DNA Replication" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Review home" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "DNA Replication" })).toBeInTheDocument();
    });

    refreshApp({ storage, participantCode: "P001" });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Which topics are on your exam?" })).toBeInTheDocument();
      expect(loadParticipantCode(storage)).toBe("P001");
    });
    expect(eventsNamed(send, "demo_reset").length).toBeGreaterThanOrEqual(1);
  });
});
