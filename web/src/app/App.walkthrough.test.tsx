import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import type { AttemptRequest, Question } from "../api/types";
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
import { server } from "../mocks/server";
import {
  createMemoryStorage,
  eventsNamed,
  refreshApp,
  renderApp,
  sentEvents,
} from "./testUtils";

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

const WALKTHROUGH_EVENTS = [
  "app_opened",
  "topic_selected",
  "video_started",
  "video_completed",
  "question_answered",
  "followup_requested",
  "objective_completed",
] as const;

async function waitForTopicsLoaded() {
  await waitFor(() => {
    expect(screen.getByRole("checkbox", { name: "DNA Replication" })).toBeInTheDocument();
  });
}

describe("App presentation walkthrough", () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it("runs the synthesis walkthrough end to end with tracked events", async () => {
    const user = userEvent.setup();
    let postIndex = 0;
    let followupJobCreates = 0;

    server.use(
      http.get(apiUrl("/questions/:questionId"), ({ params }) => {
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
          { error: "not_found", message: "missing" },
          { status: 404 },
        );
      }),
      http.post(apiUrl("/attempts"), async ({ request }) => {
        const body = (await request.json()) as AttemptRequest;
        postIndex += 1;
        if (postIndex === 1) {
          return HttpResponse.json({
            ...attemptContinue,
            attempt_id: body.attempt_id,
          });
        }
        if (postIndex === 2) {
          return HttpResponse.json({
            ...attemptReviewAgain,
            attempt_id: body.attempt_id,
          });
        }
        return HttpResponse.json({
          ...attemptComplete,
          attempt_id: body.attempt_id,
          question_id: body.question_id,
        });
      }),
      http.post(apiUrl("/video-jobs"), async ({ request }) => {
        const body = (await request.json()) as { variant_id: string };
        if (body.variant_id === "primer_followup") {
          followupJobCreates += 1;
          return HttpResponse.json({
            ...videoJobQueued,
            job_id: "walkthrough-followup-1",
            variant_id: "primer_followup",
          });
        }
        return HttpResponse.json(videoJobQueued);
      }),
      http.get(apiUrl("/video-jobs/:jobId"), ({ params }) => {
        const jobId = params.jobId as string;
        if (jobId === "walkthrough-followup-1") {
          return HttpResponse.json({
            ...videoJobReady,
            job_id: jobId,
            variant_id: "primer_followup",
            video_url: "https://example.com/walkthrough-followup.mp4",
          });
        }
        if (jobId === "video-001") {
          return HttpResponse.json({
            ...videoJobReady,
            variant_id: "initial",
            video_url: "https://example.com/walkthrough-initial.mp4",
          });
        }
        return HttpResponse.json(
          { error: "not_found", message: "missing" },
          { status: 404 },
        );
      }),
    );

    const storage = createMemoryStorage();
    const { send } = renderApp({ storage });

    await user.type(screen.getByLabelText("Participant code"), "P001");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await waitForTopicsLoaded();
    await user.click(screen.getByRole("checkbox", { name: "DNA Replication" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.click(
      screen.getByRole("button", {
        name: "Start, Synthesis direction and primer requirement",
      }),
    );
    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toBeInTheDocument();
    });
    fireEvent.play(screen.getByLabelText("Lesson video"));
    fireEvent.ended(screen.getByLabelText("Lesson video"));

    await user.click(screen.getByRole("button", { name: "Answer question" }));
    await waitFor(() => {
      expect(screen.getByRole("group", { name: repQ1.prompt })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("radio", { name: "3′ end" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await user.click(screen.getByRole("button", { name: "Next question" }));

    await waitFor(() => {
      expect(screen.getByRole("group", { name: repQ2.prompt })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("radio", { name: "Helicase" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await user.click(
      screen.getByRole("button", { name: "Watch a short follow-up" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Preparing a short follow-up" }),
      ).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Lesson video")).toHaveAttribute(
        "src",
        "https://example.com/walkthrough-followup.mp4",
      );
    });

    await user.click(screen.getByRole("button", { name: "Answer question" }));
    await waitFor(() => {
      expect(screen.getByRole("group", { name: repR2.prompt })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("radio", { name: "DNA polymerase" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await user.click(screen.getByRole("button", { name: "See summary" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Objective complete" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Back to home" }));
    await waitFor(() => {
      expect(screen.getByText("Objective complete.")).toBeInTheDocument();
    });

    refreshApp({ storage, participantCode: "P001", selectedTopicIds: ["dna_replication"] });
    await waitFor(() => {
      expect(screen.getByText("Objective complete.")).toBeInTheDocument();
    });

    for (const eventName of WALKTHROUGH_EVENTS) {
      expect(eventsNamed(send, eventName).length).toBeGreaterThanOrEqual(1);
    }

    for (const event of sentEvents(send)) {
      if (WALKTHROUGH_EVENTS.includes(event.event_name as (typeof WALKTHROUGH_EVENTS)[number])) {
        expect(event.participant_code).toBe("P001");
        expect(event.build_id).toBe("test-build");
      }
    }
  });
});
