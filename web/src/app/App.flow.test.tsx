import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import type { AttemptRequest, Question } from "../api/types";
import { apiUrl } from "../api/config";
import {
  attemptComplete,
  attemptContinue,
  attemptNeedsReview,
  attemptReviewAgain,
} from "../fixtures/attempts";
import { repQ1 } from "../fixtures/questions";
import { topics } from "../fixtures/topics";
import {
  videoJobFailed,
  videoJobQueued,
  videoJobReady,
  videoJobRunning,
} from "../fixtures/videoJobs";
import { server } from "../mocks/server";
import {
  createDefaultProgressState,
  loadParticipantCode,
  loadProgress,
  saveParticipantCode,
  saveProgress,
  saveRemediationState,
} from "../storage/progress";
import {
  createMemoryStorage,
  eventsNamed,
  renderApp,
} from "./testUtils";

async function waitForTopicsLoaded() {
  await waitFor(() => {
    expect(screen.getByRole("checkbox", { name: "DNA Replication" })).toBeInTheDocument();
  });
}

async function enterParticipantCode(user: ReturnType<typeof userEvent.setup>, code = "P001") {
  await user.type(screen.getByLabelText("Participant code"), code);
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() => {
    expect(screen.getByRole("heading", { name: "Which topics are on your exam?" })).toBeInTheDocument();
  });
}

async function goToHomeFromTopics(user: ReturnType<typeof userEvent.setup>) {
  await waitForTopicsLoaded();
  await user.click(screen.getByRole("checkbox", { name: "DNA Replication" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() => {
    expect(screen.getByRole("heading", { name: "Review home" })).toBeInTheDocument();
  });
}

const initialRemediationState = {
  objective_status: "not_started" as const,
  expected_question_id: null,
  remediation_count: 0,
  satisfied_question_ids: [] as string[],
  asked_retry_ids: [] as string[],
};

async function goToHome(user: ReturnType<typeof userEvent.setup>) {
  await enterParticipantCode(user, "P001");
  await goToHomeFromTopics(user);
}

async function startSynthesisObjective(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", {
      name: "Start, Synthesis direction and primer requirement",
    }),
  );
  await waitFor(() => {
    expect(screen.getByText(/Preparing your video/)).toBeInTheDocument();
  });
}

function attemptPostHandler(
  onPost: (body: AttemptRequest) => Response,
) {
  return http.post(apiUrl("/attempts"), async ({ request }) => {
    const body = (await request.json()) as AttemptRequest;
    return onPost(body);
  });
}

const repQ2: Question = {
  question_id: "rep-q2",
  objective_id: "synthesis_direction_and_primer",
  prompt: "Which enzyme synthesizes the RNA primer?",
  choices: [
    { choice_id: "A", text: "Primase" },
    { choice_id: "B", text: "Helicase" },
  ],
};

const repR2: Question = {
  question_id: "rep-r2",
  objective_id: "synthesis_direction_and_primer",
  prompt: "Which enzyme extends the primer?",
  choices: [
    { choice_id: "A", text: "DNA polymerase" },
    { choice_id: "B", text: "Primase" },
  ],
};

function synthesisQuestionsHandler() {
  return http.get(apiUrl("/questions/:questionId"), ({ params }) => {
    const questionId = params.questionId as string;
    if (questionId === "rep-q1") {
      return HttpResponse.json(repQ1);
    }
    if (questionId === "rep-q2") {
      return HttpResponse.json(repQ2);
    }
    if (questionId === "rep-r2") {
      return HttpResponse.json(repR2);
    }
    return HttpResponse.json(
      { error: "not_found", message: `Question not found: ${questionId}` },
      { status: 404 },
    );
  });
}

async function reachRepQ2Question(user: ReturnType<typeof userEvent.setup>) {
  await goToHome(user);
  await startSynthesisObjective(user);
  await waitFor(() => {
    expect(screen.getByLabelText("Lesson video")).toBeInTheDocument();
  });
  await user.click(screen.getByRole("button", { name: "Answer question" }));
  await waitFor(() => {
    expect(screen.getByRole("group", { name: repQ1.prompt })).toBeInTheDocument();
  });
  await user.click(screen.getByRole("radio", { name: "3′ end" }));
  await user.click(screen.getByRole("button", { name: "Submit" }));
  await waitFor(() => {
    expect(screen.getByRole("heading", { name: "Correct" })).toBeInTheDocument();
  });
  await user.click(screen.getByRole("button", { name: "Next question" }));
  await waitFor(() => {
    expect(screen.getByRole("group", { name: repQ2.prompt })).toBeInTheDocument();
  });
}

describe("App shell flow (Part 1)", () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it("shows participant code first; submitting saves the code and goes to topics", async () => {
    const user = userEvent.setup();
    const { storage } = renderApp();

    expect(screen.getByLabelText("Participant code")).toBeInTheDocument();

    await enterParticipantCode(user, "  study-42  ");

    expect(loadParticipantCode(storage)).toBe("study-42");
    await waitForTopicsLoaded();
  });

  it("sends app_opened with the participant code after it is entered", async () => {
    const user = userEvent.setup();
    const { send } = renderApp();

    await enterParticipantCode(user, "P001");

    await waitFor(() => {
      const opened = eventsNamed(send, "app_opened");
      expect(opened.length).toBeGreaterThanOrEqual(1);
      expect(opened.some((event) => event.participant_code === "P001")).toBe(true);
    });
  });

  it("opens on home when a participant code and topic selections are already saved", async () => {
    const storage = createMemoryStorage();
    renderApp({
      storage,
      participantCode: "P001",
      selectedTopicIds: ["dna_replication"],
    });

    await waitFor(() => {
      expect(screen.queryByLabelText("Participant code")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "Start, Synthesis direction and primer requirement",
        }),
      ).toBeInTheDocument();
    });
  });

  it("loads topics; shows Retry on error and Retry loads topics", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    server.use(
      http.get(apiUrl("/topics"), () => {
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json(
            { error: "server_error", message: "Topics unavailable" },
            { status: 500 },
          );
        }
        return HttpResponse.json(topics);
      }),
    );

    renderApp();
    await enterParticipantCode(user, "P001");

    expect(await screen.findByText("Topics unavailable")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitForTopicsLoaded();
  });

  it("tracks topic_selected only when a topic is turned on; selections persist", async () => {
    const user = userEvent.setup();
    const { send, storage } = renderApp();
    await enterParticipantCode(user, "P001");
    await waitForTopicsLoaded();

    await user.click(screen.getByRole("checkbox", { name: "DNA Replication" }));

    await waitFor(() => {
      expect(eventsNamed(send, "topic_selected")).toEqual([
        expect.objectContaining({
          event_name: "topic_selected",
          topic_id: "dna_replication",
          participant_code: "P001",
        }),
      ]);
    });

    await user.click(screen.getByRole("checkbox", { name: "DNA Replication" }));
    expect(eventsNamed(send, "topic_selected")).toHaveLength(1);

    expect(loadProgress(storage).selected_topic_ids).toEqual([]);
    await user.click(screen.getByRole("checkbox", { name: "DNA Replication" }));
    expect(loadProgress(storage).selected_topic_ids).toEqual(["dna_replication"]);
  });

  it("confirming topics shows home with replication startable and repair coming soon", async () => {
    const user = userEvent.setup();
    renderApp();
    await enterParticipantCode(user, "P001");
    await waitForTopicsLoaded();

    await user.click(screen.getByRole("checkbox", { name: "DNA Replication" }));
    await user.click(screen.getByRole("checkbox", { name: "DNA Repair" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(screen.getByText("Not started")).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "Start, Synthesis direction and primer requirement",
        }),
      ).toBeInTheDocument();
      expect(screen.getByText("Coming soon")).toBeInTheDocument();
    });
  });

  it("Reset demo from home returns to topics, keeps participant code, clears selections, and sends demo_reset", async () => {
    const user = userEvent.setup();
    const { send, storage } = renderApp();
    await enterParticipantCode(user, "P001");
    await goToHomeFromTopics(user);

    await user.click(screen.getByRole("button", { name: "Reset demo" }));

    await waitForTopicsLoaded();
    expect(loadParticipantCode(storage)).toBe("P001");
    expect(loadProgress(storage).selected_topic_ids).toEqual([]);

    await waitFor(() => {
      expect(eventsNamed(send, "demo_reset").length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("App lesson and question flow (Part 2)", () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it("starts a lesson, shows preparing, then the video when the job becomes ready", async () => {
    const user = userEvent.setup();
    let polls = 0;
    server.use(
      http.get(apiUrl("/video-jobs/:jobId"), () => {
        polls += 1;
        if (polls === 1) {
          return HttpResponse.json({
            ...videoJobRunning,
            variant_id: "initial",
          });
        }
        return HttpResponse.json({
          ...videoJobReady,
          variant_id: "initial",
          video_url: "https://example.com/lesson.mp4",
        });
      }),
    );

    renderApp();
    await goToHome(user);
    await startSynthesisObjective(user);

    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toHaveAttribute(
        "src",
        "https://example.com/lesson.mp4",
      );
    });
  });

  it("shows Try again on a failed job; retry creates a new job and reaches ready", async () => {
    const user = userEvent.setup();
    let jobCreates = 0;
    let pollsAfterRetry = 0;

    server.use(
      http.post(apiUrl("/video-jobs"), () => {
        jobCreates += 1;
        return HttpResponse.json({
          ...videoJobQueued,
          job_id: jobCreates === 1 ? "video-fail-1" : "video-retry-1",
        });
      }),
      http.get(apiUrl("/video-jobs/:jobId"), ({ params }) => {
        const jobId = params.jobId as string;
        if (jobId === "video-fail-1") {
          return HttpResponse.json({
            ...videoJobFailed,
            job_id: jobId,
            variant_id: "initial",
          });
        }
        pollsAfterRetry += 1;
        if (pollsAfterRetry === 1) {
          return HttpResponse.json({
            ...videoJobRunning,
            job_id: jobId,
            variant_id: "initial",
          });
        }
        return HttpResponse.json({
          ...videoJobReady,
          job_id: jobId,
          variant_id: "initial",
          video_url: "https://example.com/retry-lesson.mp4",
        });
      }),
    );

    renderApp();
    await goToHome(user);
    await startSynthesisObjective(user);

    await user.click(await screen.findByRole("button", { name: "Try again" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toHaveAttribute(
        "src",
        "https://example.com/retry-lesson.mp4",
      );
    });
    expect(jobCreates).toBeGreaterThanOrEqual(2);
  });

  it("sends video_started and video_completed with variant_id initial on play and ended", async () => {
    const user = userEvent.setup();
    const { send } = renderApp();
    await goToHome(user);
    await startSynthesisObjective(user);

    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toBeInTheDocument();
    });

    const video = screen.getByLabelText("Lesson video");
    fireEvent.play(video);
    fireEvent.ended(video);

    await waitFor(() => {
      expect(eventsNamed(send, "video_started")).toEqual([
        expect.objectContaining({ variant_id: "initial" }),
      ]);
      expect(eventsNamed(send, "video_completed")).toEqual([
        expect.objectContaining({ variant_id: "initial" }),
      ]);
    });
  });

  it("submits rep-q1, shows feedback, and sends question_answered", async () => {
    const user = userEvent.setup();
    const attemptBodies: AttemptRequest[] = [];
    server.use(
      attemptPostHandler((body) => {
        attemptBodies.push(body);
        return HttpResponse.json({
          ...attemptContinue,
          attempt_id: body.attempt_id,
        });
      }),
    );

    const { send } = renderApp();
    await goToHome(user);
    await startSynthesisObjective(user);

    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Answer question" }));

    await waitFor(() => {
      expect(
        screen.getByRole("group", { name: repQ1.prompt }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("radio", { name: "3′ end" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Correct" })).toBeInTheDocument();
    });

    expect(attemptBodies).toHaveLength(1);
    expect(attemptBodies[0]!.question_id).toBe("rep-q1");
    expect(attemptBodies[0]!.remediation_state).toEqual(initialRemediationState);

    await waitFor(() => {
      expect(eventsNamed(send, "question_answered")).toEqual([
        expect.objectContaining({
          question_id: "rep-q1",
          correct: true,
        }),
      ]);
    });
  });

  it("shows a submit error on 500 and retries with the same attempt_id", async () => {
    const user = userEvent.setup();
    let postCount = 0;
    const attemptIds: string[] = [];

    server.use(
      attemptPostHandler((body) => {
        postCount += 1;
        attemptIds.push(body.attempt_id);
        if (postCount === 1) {
          return HttpResponse.json(
            { error: "server_error", message: "Submit failed" },
            { status: 500 },
          );
        }
        return HttpResponse.json({
          ...attemptContinue,
          attempt_id: body.attempt_id,
        });
      }),
    );

    renderApp();
    await goToHome(user);
    await startSynthesisObjective(user);
    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Answer question" }));
    await waitFor(() => {
      expect(screen.getByRole("group", { name: repQ1.prompt })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("radio", { name: "3′ end" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Submit failed");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Correct" })).toBeInTheDocument();
    });
    expect(attemptIds).toHaveLength(2);
    expect(attemptIds[0]).toBe(attemptIds[1]);
  });

  it("shows an error and stays on the question when the result attempt_id does not match", async () => {
    const user = userEvent.setup();
    server.use(
      attemptPostHandler(() => HttpResponse.json(attemptContinue)),
    );

    renderApp();
    await goToHome(user);
    await startSynthesisObjective(user);
    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Answer question" }));
    await waitFor(() => {
      expect(screen.getByRole("group", { name: repQ1.prompt })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("radio", { name: "3′ end" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The server returned an unexpected attempt.",
    );
    expect(screen.getByRole("group", { name: repQ1.prompt })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Correct" })).not.toBeInTheDocument();
  });

  it("sends only one POST /attempts when Submit is double-clicked", async () => {
    const user = userEvent.setup();
    let postCount = 0;
    server.use(
      attemptPostHandler((body) => {
        postCount += 1;
        return HttpResponse.json({
          ...attemptContinue,
          attempt_id: body.attempt_id,
        });
      }),
    );

    renderApp();
    await goToHome(user);
    await startSynthesisObjective(user);
    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Answer question" }));
    await waitFor(() => {
      expect(screen.getByRole("group", { name: repQ1.prompt })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("radio", { name: "3′ end" }));
    await user.dblClick(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Correct" })).toBeInTheDocument();
    });
    expect(postCount).toBe(1);
  });

  it("persists remediation state from the attempt result exactly", async () => {
    const user = userEvent.setup();
    const { storage } = renderApp();
    await goToHome(user);
    await startSynthesisObjective(user);
    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Answer question" }));
    await waitFor(() => {
      expect(screen.getByRole("group", { name: repQ1.prompt })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("radio", { name: "3′ end" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Correct" })).toBeInTheDocument();
    });

    expect(
      loadProgress(storage).remediation_states.synthesis_direction_and_primer,
    ).toEqual(attemptContinue.remediation_state);
  });

  it("uses expected_question_id rep-r2 as the first question when saved state is in progress", async () => {
    const user = userEvent.setup();
    const storage = createMemoryStorage();
    saveParticipantCode("P001", storage);
    saveProgress(
      {
        ...createDefaultProgressState(),
        selected_topic_ids: ["dna_replication"],
      },
      storage,
    );
    saveRemediationState(
      "synthesis_direction_and_primer",
      {
        objective_status: "in_progress",
        expected_question_id: "rep-r2",
        remediation_count: 1,
        satisfied_question_ids: ["rep-q1"],
        asked_retry_ids: [],
      },
      storage,
    );

    server.use(
      http.get(apiUrl("/questions/:questionId"), ({ params }) => {
        const questionId = params.questionId as string;
        if (questionId === "rep-r2") {
          return HttpResponse.json({
            question_id: "rep-r2",
            objective_id: "synthesis_direction_and_primer",
            prompt: "Which enzyme extends the primer?",
            choices: [
              { choice_id: "A", text: "DNA polymerase" },
              { choice_id: "B", text: "Primase" },
            ],
          });
        }
        return HttpResponse.json(
          { error: "not_found", message: "missing" },
          { status: 404 },
        );
      }),
    );

    renderApp({ storage, participantCode: "P001", selectedTopicIds: ["dna_replication"] });
    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "Start, Synthesis direction and primer requirement",
        }),
      ).toBeInTheDocument();
    });
    await startSynthesisObjective(user);
    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Answer question" }));

    await waitFor(() => {
      expect(
        screen.getByRole("group", { name: "Which enzyme extends the primer?" }),
      ).toBeInTheDocument();
    });
  });
});

describe("App follow-up and summary flow (Part 3)", () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it("after a wrong answer, follow-up preparing, follow-up lesson, and rep-r2 question", async () => {
    const user = userEvent.setup();
    server.use(
      synthesisQuestionsHandler(),
      attemptPostHandler((body) => {
        if (body.question_id === "rep-q1") {
          return HttpResponse.json({
            ...attemptContinue,
            attempt_id: body.attempt_id,
          });
        }
        return HttpResponse.json({
          ...attemptReviewAgain,
          attempt_id: body.attempt_id,
        });
      }),
      http.post(apiUrl("/video-jobs"), async ({ request }) => {
        const body = (await request.json()) as { variant_id: string };
        if (body.variant_id === "primer_followup") {
          return HttpResponse.json({
            ...videoJobQueued,
            job_id: "followup-job-1",
            variant_id: "primer_followup",
          });
        }
        return HttpResponse.json(videoJobQueued);
      }),
      http.get(apiUrl("/video-jobs/:jobId"), ({ params }) => {
        const jobId = params.jobId as string;
        if (jobId === "followup-job-1") {
          return HttpResponse.json({
            ...videoJobRunning,
            job_id: jobId,
            variant_id: "primer_followup",
          });
        }
        if (jobId === "video-001") {
          return HttpResponse.json({
            ...videoJobReady,
            variant_id: "initial",
            video_url: "https://example.com/initial.mp4",
          });
        }
        return HttpResponse.json(
          { error: "not_found", message: "missing" },
          { status: 404 },
        );
      }),
    );

    const { send } = renderApp();
    await reachRepQ2Question(user);

    await user.click(screen.getByRole("radio", { name: "Helicase" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Not quite" })).toBeInTheDocument();
    });
    await user.click(
      screen.getByRole("button", { name: "Watch a short follow-up" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Preparing a short follow-up" }),
      ).toBeInTheDocument();
    });

    expect(eventsNamed(send, "followup_requested")).toEqual([
      expect.objectContaining({ variant_id: "primer_followup" }),
    ]);

    server.use(
      http.get(apiUrl("/video-jobs/:jobId"), ({ params }) => {
        const jobId = params.jobId as string;
        if (jobId === "followup-job-1") {
          return HttpResponse.json({
            ...videoJobReady,
            job_id: jobId,
            variant_id: "primer_followup",
            video_url: "https://example.com/followup.mp4",
          });
        }
        if (jobId === "video-001") {
          return HttpResponse.json({
            ...videoJobReady,
            variant_id: "initial",
            video_url: "https://example.com/initial.mp4",
          });
        }
        return HttpResponse.json(
          { error: "not_found", message: "missing" },
          { status: 404 },
        );
      }),
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toBeInTheDocument();
      expect(
        screen.getByText("This short clip focuses on the idea from the last question."),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Answer question" }));
    await waitFor(() => {
      expect(screen.getByRole("group", { name: repR2.prompt })).toBeInTheDocument();
    });
  });

  it("does not send followup_requested again when retrying a failed follow-up job", async () => {
    const user = userEvent.setup();
    let followupJobCreates = 0;

    server.use(
      synthesisQuestionsHandler(),
      attemptPostHandler((body) => {
        if (body.question_id === "rep-q1") {
          return HttpResponse.json({
            ...attemptContinue,
            attempt_id: body.attempt_id,
          });
        }
        return HttpResponse.json({
          ...attemptReviewAgain,
          attempt_id: body.attempt_id,
        });
      }),
      http.post(apiUrl("/video-jobs"), async ({ request }) => {
        const body = (await request.json()) as { variant_id: string };
        if (body.variant_id === "primer_followup") {
          followupJobCreates += 1;
          return HttpResponse.json({
            ...videoJobQueued,
            job_id:
              followupJobCreates === 1 ? "followup-fail-1" : "followup-retry-1",
            variant_id: "primer_followup",
          });
        }
        return HttpResponse.json(videoJobQueued);
      }),
      http.get(apiUrl("/video-jobs/:jobId"), ({ params }) => {
        const jobId = params.jobId as string;
        if (jobId === "followup-fail-1") {
          return HttpResponse.json({
            ...videoJobFailed,
            job_id: jobId,
            variant_id: "primer_followup",
          });
        }
        if (jobId === "followup-retry-1") {
          return HttpResponse.json({
            ...videoJobReady,
            job_id: jobId,
            variant_id: "primer_followup",
            video_url: "https://example.com/followup-retry.mp4",
          });
        }
        if (jobId === "video-001") {
          return HttpResponse.json({
            ...videoJobReady,
            variant_id: "initial",
            video_url: "https://example.com/initial.mp4",
          });
        }
        return HttpResponse.json(
          { error: "not_found", message: "missing" },
          { status: 404 },
        );
      }),
    );

    const { send } = renderApp();
    await reachRepQ2Question(user);
    await user.click(screen.getByRole("radio", { name: "Helicase" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await user.click(
      screen.getByRole("button", { name: "Watch a short follow-up" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /follow-up video couldn't be prepared/i,
      );
    });

    expect(eventsNamed(send, "followup_requested")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toHaveAttribute(
        "src",
        "https://example.com/followup-retry.mp4",
      );
    });
    expect(eventsNamed(send, "followup_requested")).toHaveLength(1);
  });

  it("shows summary and objective_completed when the objective is complete", async () => {
    const user = userEvent.setup();
    server.use(
      synthesisQuestionsHandler(),
      attemptPostHandler((body) =>
        HttpResponse.json({
          ...attemptComplete,
          attempt_id: body.attempt_id,
          question_id: body.question_id,
        }),
      ),
    );

    const { send } = renderApp();
    await goToHome(user);
    await startSynthesisObjective(user);
    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Answer question" }));
    await waitFor(() => {
      expect(screen.getByRole("group", { name: repQ1.prompt })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("radio", { name: "3′ end" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Correct" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "See summary" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Objective complete" }),
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(eventsNamed(send, "objective_completed")).toEqual([
        expect.objectContaining({
          objective_id: "synthesis_direction_and_primer",
        }),
      ]);
    });

    await user.click(screen.getByRole("button", { name: "Back to home" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Review home" })).toBeInTheDocument();
      expect(
        screen.getByText(
          "Objective complete: Synthesis direction and primer requirement",
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows needs_review summary with key points and sends objective_needs_review", async () => {
    const user = userEvent.setup();
    server.use(
      synthesisQuestionsHandler(),
      attemptPostHandler((body) =>
        HttpResponse.json({
          ...attemptNeedsReview,
          attempt_id: body.attempt_id,
          question_id: body.question_id,
        }),
      ),
    );

    const { send } = renderApp();
    await goToHome(user);
    await startSynthesisObjective(user);
    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Answer question" }));
    await waitFor(() => {
      expect(screen.getByRole("group", { name: repQ1.prompt })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("radio", { name: "3′ end" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Not quite" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "See summary" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Let's review this one" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Key points" })).toBeInTheDocument();
      expect(
        screen.getByText("DNA polymerase can only extend from a 3′ OH."),
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(eventsNamed(send, "objective_needs_review")).toEqual([
        expect.objectContaining({
          objective_id: "synthesis_direction_and_primer",
        }),
      ]);
    });
  });

  it("restart from summary returns to the initial lesson with initial remediation on submit", async () => {
    const user = userEvent.setup();
    const attemptBodies: AttemptRequest[] = [];

    server.use(
      synthesisQuestionsHandler(),
      attemptPostHandler((body) => {
        attemptBodies.push(body);
        if (attemptBodies.length === 1) {
          return HttpResponse.json({
            ...attemptComplete,
            attempt_id: body.attempt_id,
            question_id: body.question_id,
          });
        }
        return HttpResponse.json({
          ...attemptContinue,
          attempt_id: body.attempt_id,
        });
      }),
    );

    renderApp();
    await goToHome(user);
    await startSynthesisObjective(user);
    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Answer question" }));
    await waitFor(() => {
      expect(screen.getByRole("group", { name: repQ1.prompt })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("radio", { name: "3′ end" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await user.click(screen.getByRole("button", { name: "See summary" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Objective complete" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Restart this objective" }));

    await waitFor(() => {
      expect(screen.getByText(/Preparing your video/)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Answer question" }));
    await waitFor(() => {
      expect(screen.getByRole("group", { name: repQ1.prompt })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("radio", { name: "3′ end" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(attemptBodies.length).toBeGreaterThanOrEqual(2);
    });
    expect(attemptBodies[1]!.remediation_state).toEqual(initialRemediationState);
  });

  it("ignores a stale video job after going home and starting again", async () => {
    const user = userEvent.setup();
    let jobCreates = 0;

    server.use(
      synthesisQuestionsHandler(),
      http.post(apiUrl("/video-jobs"), () => {
        jobCreates += 1;
        return HttpResponse.json({
          ...videoJobQueued,
          job_id: jobCreates === 1 ? "stale-job-1" : "fresh-job-2",
          variant_id: "initial",
        });
      }),
      http.get(apiUrl("/video-jobs/:jobId"), ({ params }) => {
        const jobId = params.jobId as string;
        if (jobId === "stale-job-1") {
          return HttpResponse.json({
            ...videoJobRunning,
            job_id: jobId,
            variant_id: "initial",
          });
        }
        if (jobId === "fresh-job-2") {
          return HttpResponse.json({
            ...videoJobReady,
            job_id: jobId,
            variant_id: "initial",
            video_url: "https://example.com/fresh-lesson.mp4",
          });
        }
        return HttpResponse.json(
          { error: "not_found", message: "missing" },
          { status: 404 },
        );
      }),
    );

    renderApp();
    await goToHome(user);
    await startSynthesisObjective(user);
    await waitFor(() => {
      expect(screen.getByText(/Preparing your video/)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Review home" })).toBeInTheDocument();
    });

    await startSynthesisObjective(user);
    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toHaveAttribute(
        "src",
        "https://example.com/fresh-lesson.mp4",
      );
    });
    expect(screen.queryByLabelText("Lesson video")).not.toHaveAttribute(
      "src",
      "https://example.com/stale-lesson.mp4",
    );
  });

  it("does not show a stale question after leaving home while a question is loading", async () => {
    const user = userEvent.setup();
    let repQ1Fetches = 0;
    let repQ1DelayMs = 200;

    server.use(
      http.get(apiUrl("/questions/:questionId"), async ({ params }) => {
        const questionId = params.questionId as string;
        if (questionId === "rep-q1") {
          repQ1Fetches += 1;
          await new Promise((resolve) => setTimeout(resolve, repQ1DelayMs));
          return HttpResponse.json(repQ1);
        }
        if (questionId === "rep-r2") {
          return HttpResponse.json(repR2);
        }
        return HttpResponse.json(
          { error: "not_found", message: "missing" },
          { status: 404 },
        );
      }),
    );

    const { storage } = renderApp();
    await goToHome(user);
    await startSynthesisObjective(user);
    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Answer question" }));
    expect(screen.getByRole("status", { name: "Loading question" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Review home" })).toBeInTheDocument();
    });

    saveRemediationState(
      "synthesis_direction_and_primer",
      {
        objective_status: "in_progress",
        expected_question_id: "rep-r2",
        remediation_count: 1,
        satisfied_question_ids: ["rep-q1"],
        asked_retry_ids: [],
      },
      storage,
    );
    repQ1DelayMs = 0;

    await startSynthesisObjective(user);
    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Answer question" }));

    await waitFor(() => {
      expect(screen.getByRole("group", { name: repR2.prompt })).toBeInTheDocument();
    });
    expect(screen.queryByRole("group", { name: repQ1.prompt })).not.toBeInTheDocument();
    expect(repQ1Fetches).toBeGreaterThanOrEqual(1);
  });

  it("sends video_started for each job even when the video_url is the same", async () => {
    const user = userEvent.setup();
    let jobCreates = 0;
    const sharedUrl = "https://example.com/shared-lesson.mp4";

    server.use(
      synthesisQuestionsHandler(),
      http.post(apiUrl("/video-jobs"), () => {
        jobCreates += 1;
        return HttpResponse.json({
          ...videoJobQueued,
          job_id: jobCreates === 1 ? "shared-url-a" : "shared-url-b",
          variant_id: "initial",
        });
      }),
      http.get(apiUrl("/video-jobs/:jobId"), ({ params }) => {
        const jobId = params.jobId as string;
        if (jobId === "shared-url-a" || jobId === "shared-url-b") {
          return HttpResponse.json({
            ...videoJobReady,
            job_id: jobId,
            variant_id: "initial",
            video_url: sharedUrl,
          });
        }
        return HttpResponse.json(
          { error: "not_found", message: "missing" },
          { status: 404 },
        );
      }),
    );

    const { send } = renderApp();
    await goToHome(user);

    await startSynthesisObjective(user);
    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toHaveAttribute("src", sharedUrl);
    });
    fireEvent.play(screen.getByLabelText("Lesson video"));
    await user.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Review home" })).toBeInTheDocument();
    });

    await startSynthesisObjective(user);
    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toHaveAttribute("src", sharedUrl);
    });
    fireEvent.play(screen.getByLabelText("Lesson video"));

    await waitFor(() => {
      expect(eventsNamed(send, "video_started")).toHaveLength(2);
      expect(eventsNamed(send, "video_started")).toEqual([
        expect.objectContaining({ variant_id: "initial" }),
        expect.objectContaining({ variant_id: "initial" }),
      ]);
    });
  });
});
