import { http, HttpResponse } from "msw";
import { apiUrl } from "../api/config";
import { attemptContinue } from "../fixtures/attempts";
import { questions } from "../fixtures/questions";
import { topics } from "../fixtures/topics";
import { videoJobQueued, videoJobReady } from "../fixtures/videoJobs";

export const handlers = [
  http.get(apiUrl("/topics"), () => HttpResponse.json(topics)),

  http.get(apiUrl("/questions/:questionId"), ({ params }) => {
    const questionId = params.questionId as string;
    const question = questions[questionId];
    if (!question) {
      return HttpResponse.json(
        { error: "not_found", message: `Question not found: ${questionId}` },
        { status: 404 },
      );
    }
    return HttpResponse.json(question);
  }),

  http.post(apiUrl("/attempts"), () => HttpResponse.json(attemptContinue)),

  http.post(apiUrl("/video-jobs"), () => HttpResponse.json(videoJobQueued)),

  http.get(apiUrl("/video-jobs/:jobId"), ({ params }) => {
    const jobId = params.jobId as string;
    if (jobId === "video-001") {
      return HttpResponse.json(videoJobReady);
    }
    return HttpResponse.json(
      { error: "not_found", message: `Video job not found: ${jobId}` },
      { status: 404 },
    );
  }),

  http.post(apiUrl("/events"), () => new HttpResponse(null, { status: 204 })),
];
