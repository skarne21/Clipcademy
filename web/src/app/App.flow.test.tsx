import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { apiUrl } from "../api/config";
import { topics } from "../fixtures/topics";
import { server } from "../mocks/server";
import {
  loadParticipantCode,
  loadProgress,
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
