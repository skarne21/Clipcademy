# Member 3 spec: student interface and application integration

Owner: Member 3 · Code folder: `web/` (this spec lives in `Context/`)
Source of truth: [Team_Spec.md](Team_Spec.md). If this file and Team_Spec disagree, Team_Spec wins until the team agrees on a change.
Subject: biology (confirmed). API shapes come from [Member2_SPEC.md](Member2_SPEC.md) and the real responses in [learning/samples/](../learning/samples/).

## What I own

- The application shell, navigation, and every screen the student sees
- The exam-topic picker and the review home page, with their availability and progress states
- The video, question, feedback, follow-up, and summary screens
- Browser storage: participant code, selected topics, `remediation_state` per objective, current step, attempts, and video job IDs
- Calling `/video-jobs` with the `next_video_request` Member 2 returns, and polling it until the clip is ready or failed
- Sending one event to `POST /events` for every action in Team_Spec's Activity events, with retries that never block the student
- Reset demo, and the one data-access module that switches between sample responses and the live services
- The development app's service configuration and final integration

Not mine: grading, next-action decisions, question content, or event storage (Member 2), and rendering or storing clips (Member 1). I never decide whether an answer is right. I show what `POST /attempts` returns and save the `remediation_state` it gives back.

## Task list

Work through these in order. Each task ends with something I can share.

| # | Task | Output | Share with | Checkpoint |
| --- | --- | --- | --- | --- |
| 1 | Agree on UI states and sample response shapes | this spec, screen list below | M1, M2 | Kickoff |
| 2 | Set up the static app and the data-access module, reading `learning/samples/` | `web/` scaffold, `web/src/api.js` | none | First independent build |
| 3 | Participant code screen (first open only) | participant code screen | none | First independent build |
| 4 | Exam-topic picker with four cards and saved selections | topics screen | none | First independent build |
| 5 | Review home with available, coming soon, in progress, complete, and needs review states | home screen | none | First independent build |
| 6 | Lesson screen: video with controls, transcript, back, and a question button | lesson screen, using a sample MP4 | M1 (video shape) | First independent build |
| 7 | Reusable question screen. Submit is disabled while waiting | question screen | none | First independent build |
| 8 | Feedback, follow-up preparing, failure-with-retry, and summary screens | remaining screens | none | First independent build |
| 9 | Save progress in browser storage, so a refresh resumes the last step | storage module | none | First independent build |
| 10 | Send activity events with a retry queue | events module | M2 | First connection |
| 11 | Switch the data-access module from samples to the live services | one base-path change | M1, M2 | First connection |
| 12 | Wire the wrong-answer path: feedback → follow-up clip → retry question | verified with M1 and M2 | M1, M2 | Adaptive connection |
| 13 | Reset demo, failure, persistence, and late-response checks; build for the host | checklist below is ticked, static build in `web/dist` | Team | Demo readiness |

**Progress:**
Tasks 2–11 and 13 are built in `web/` (Vite vanilla JS; the earlier React + TypeScript scaffold was dropped to match this spec). `web/src/api.js` runs in `live` or `samples` mode (`VITE_DATA_MODE=samples npm run dev`; `npm run check` tests samples mode). To develop against the hosted API, run `API_TARGET=https://clipcademy.pythonanywhere.com npm run dev`.

Test cases 1–14 pass with `npm run e2e` (headless Chrome, production build, local service; how to run it is at the top of `web/e2e/run.mjs`). `/video-jobs` is faked per case with a 2-second test clip, so playback, the transcript, and `video_started` / `video_completed` are tested too. Screens were also checked at 320 px wide with 200% text and reduced motion. Still open, all waiting on someone else:
- **Task 12 with real clips (Member 1):** `/video-jobs` returns `503` until `video/jobs.py` exists. Rerun `npm run e2e` once it does.
- **Case 15:** needs the build uploaded to PythonAnywhere and opened on a phone.
- **Build freeze:** set `BUILD_ID` in `web/src/config.js` and add it to the server's `CLIPCADEMY_BUILD_IDS`.
- **Classmate walkthrough** (first Done-when box): needs a real person. Member 1's `/video-jobs` returns `503` until `video/jobs.py` exists, so tasks 6 and 8 use a sample MP4 and a fake ready response in the data-access module until then.

## Stack

**Choice:** plain JavaScript, HTML, and CSS built with Vite (vanilla template). No framework, no UI library, and no state library.

The host constraints in Team_Spec (Hosting) decide most of this:
- The app must build to plain static files. PythonAnywhere serves `web/dist` at `/` and runs no Node.
- Call the API with **relative paths** (`/topics`, `/attempts`, …), so the same build works locally and hosted.
- Use **hash routes** (`/#/lesson`), never path routes. The host sends unknown paths to Member 2's API, so refreshing `/lesson` would 404.
- **Local development:** run Member 2's service with `python learning/app.py` (port 8000), and proxy the API paths (`/topics`, `/questions`, `/attempts`, `/events`, `/video-jobs`) to `http://localhost:8000` with Vite's `server.proxy`. Pre-rendered clips (`/media/…`) come from Member 1's folder.
- The app must work on a phone. Participants may use it on their own devices during Days 0–2.

## Data access

All network calls go through one module, `web/src/api.js`. Nothing else calls `fetch`. A single flag picks the source:

| Mode | Source |
| --- | --- |
| `samples` | The `response` field of each file in `learning/samples/` (copied into `web/public/samples/` or imported). Video jobs return a fake `ready` response with a sample MP4 |
| `live` | Relative paths on the same origin |

| Function | Calls | Returns |
| --- | --- | --- |
| `getTopics()` | `GET /topics` | `{topics: [...]}` |
| `getQuestion(id)` | `GET /questions/{id}` | prompt and choices, never the answer |
| `submitAttempt(body)` | `POST /attempts` | answer result (see Member2_SPEC.md) |
| `startVideo(request)` | `POST /video-jobs` | `{job_id, status}` |
| `getVideo(jobId)` | `GET /video-jobs/{job_id}` | `queued`, `running`, `ready` (with `video_url` and `transcript`), or `failed` |
| `sendEvent(event)` | `POST /events` | `201` stored, `200` duplicate |

Every 4xx has the body `{"error": {"field": "...", "message": "..."}}`. Show the message and keep the student on the current screen. `/video-jobs` returning `503` means the video service isn't mounted yet. Treat it like a `failed` job.

## Screens

Visual and interaction rules for every screen are in [UI_Guidelines.md](UI_Guidelines.md).

| Screen | Route | Visible elements | Next action |
| --- | --- | --- | --- |
| Participant code | `#/code` | Code entry (first open only) | Exam topics |
| Exam topics | `#/topics` | Four topic cards, selections, availability labels | Start a selected available topic |
| Review home | `#/home` | Selected topics, objective progress, Resume | Open initial lesson or resume saved step |
| Lesson | `#/lesson/{objective_id}` | Video, transcript, objective label, teaching goal | Open current question |
| Question | `#/question/{question_id}` | Prompt, choices, Submit | Feedback |
| Feedback | `#/feedback` | Correct or not, feedback text, source labels | Next question, watch follow-up, or summary |
| Follow-up preparing | `#/followup` | Preparing status, back navigation | Play ready clip, or Retry on failure |
| Summary | `#/summary/{objective_id}` | `complete`, or `needs_review` with the feedback and `review_points` | Return home, Restart, or another topic |

**Topic cards.** Show the `label` from `GET /topics`. A `coming_soon` topic shows "Coming soon," can be selected as an exam topic, and can't be started. Never show it as working or completed. Don't hard-code which topics are available. The frozen build's availability comes from topics.json (replication and DNA repair for the validation build). The picker must not suggest it knows the student's exam coverage.

**Progress labels** are per objective, not per topic: "Synthesis direction and the primer requirement: complete" is fine, "DNA replication: mastered" is not.

## Lesson flow

1. **Start.** The student opens an available topic's objective. Send `topic_selected`. Call `startVideo(objective.initial_video_request)`, save the `job_id`, and poll `getVideo` every 2 s until `ready` or `failed`.
2. **Watch.** Play `video_url` with native `<video controls>`, and show the transcript below it. Send `video_started` on first play and `video_completed` on `ended`. The question button is always available. Watching the whole clip isn't required.
3. **Answer.** Load the question with `getQuestion`. On a fresh start (state `{}`), that's `objective.required_question_ids[0]` from `GET /topics`. After that, it's always the last result's `next_question_id`. Submit is disabled until a choice is picked, and stays disabled while the request is in flight. Show no feedback, hint, or correctness before the answer is submitted (active recall).
4. **Result.** Save the returned `remediation_state` before showing anything, then send `question_answered`. Branch on `action`:

| `action` | Show | Then |
| --- | --- | --- |
| `continue_questions` | Feedback | Question `next_question_id` |
| `review_again` | Feedback, then "Watch explanation" | Send `followup_requested`, `startVideo(next_video_request)`, preparing screen, clip, then question `next_question_id` |
| `complete` | Feedback | Summary, send `objective_completed` |
| `needs_review` | Feedback | Summary with `feedback` and `review_points`, send `objective_needs_review` |

The client never picks the next question. It's always the server's `next_question_id`, which equals the saved `expected_question_id`.

5. **Restart.** From the summary, Restart clears that objective's saved state and sends `remediation_state: {}` with the next attempt. `complete` and `needs_review` objectives can't be continued without a restart (the server returns `409`).

### Attempts

- `attempt_id` is `crypto.randomUUID()`, new for each submission.
- Before sending, save the full request body as `pending_attempt`. If the request fails or the page is refreshed, resend the **same** body with the **same** `attempt_id`. Member 2 returns the stored result and doesn't count another cycle. Clear `pending_attempt` after the response is saved.
- Never generate a new `attempt_id` for a resend, and never change the choice of a pending attempt. A different body with the same ID gets `409`.
- Treat any `409` as out of sync with the server: `question_id` (wrong question for the state), `attempt_id` (same ID, different body), or `remediation_state.objective_status` (objective already finished). Show the error message and a Restart button.

### Video jobs

- A failed or `503` job shows the failure screen with Retry. Retry calls `startVideo` again with the same request. The answer was already saved, so retrying never resubmits it.
- Save the `job_id` with the current step. After a refresh, poll the saved job instead of starting a new one.
- Show "Preparing your explanation…" while the job is `queued` or `running`. Disclose on the lesson screen when a clip was served from a previously rendered version (the hosted build always does this, see Team_Spec, Hosting). The ready response has no field for this yet (open question 1).

### Late responses

Every request that changes the screen carries the `objective_id` and step it was made for. When a response arrives, ignore it if the student has since moved to another objective or step. A slow clip for replication must never replace the DNA repair lesson.

## Browser storage

One `localStorage` key, `clipcademy`, holding one JSON object. Wrap every read and write in `try/catch`. If storage is unavailable, the app still works for the current tab.

```json
{
  "participant_id": "P01",
  "selected_topic_ids": ["dna_replication", "dna_repair"],
  "objectives": {
    "synthesis_direction_and_primer": {
      "topic_id": "dna_replication",
      "remediation_state": { "objective_status": "in_progress", "expected_question_id": "rep-r2", "remediation_count": 1, "satisfied_question_ids": ["rep-q1"], "asked_retry_ids": ["rep-r2"] },
      "step": "followup",
      "video_job_id": "video-001",
      "last_result": { "action": "review_again", "feedback": "…", "next_video_request": { "variant_id": "primer_followup" } },
      "pending_attempt": null,
      "attempts": [{ "attempt_id": "0b7e3c52-…", "question_id": "rep-q2", "selected_choice_id": "B", "correct": false }]
    }
  },
  "event_queue": []
}
```

- `step` is one of `lesson`, `question`, `feedback`, `followup`, `summary`. On load, the home page's Resume opens that step. `last_result` lets a refresh redraw the feedback screen without resubmitting.
- `remediation_state` is stored exactly as the server returned it. Don't edit it in the client.
- **Reset demo** removes everything except `participant_id` and `event_queue`, sends `demo_reset`, and returns to the topic picker. Unsent events stay queued.

## Activity events

The study's numbers come from these events (see [validation-plan.md](validation-plan.md), Measuring activity), so they must be exact.

| `event_name` | Send when | Extra fields |
| --- | --- | --- |
| `app_opened` | App loads, with a new `session_id` | none |
| `topic_selected` | Student starts a topic from the picker or home | `topic_id` |
| `video_started` / `video_completed` | Clip first plays / fires `ended` | `variant_id` |
| `question_answered` | Attempt result comes back (once per `attempt_id`, even if it was resent) | `question_id`, `correct` |
| `followup_requested` | App calls `startVideo` for a follow-up (not for the initial clip, not for Retry) | `variant_id` |
| `objective_completed` / `objective_needs_review` | Result action is `complete` / `needs_review` | `objective_id` |
| `demo_reset` | Reset demo is used | none |
| `heartbeat` | Once per 30 s the app is on screen. Paused while hidden. Carries `topic_id`/`objective_id` on lesson screens (see Team_Spec, Activity events) | none |

Every event also carries:
- `event_id`: `crypto.randomUUID()`
- `participant_id`: the stored participant code
- `session_id`: a UUID made on each app load, kept in memory only
- `client_timestamp_utc`: `new Date().toISOString()` at the moment of the action
- `build_id`: one constant in `web/src/config.js`, set when the build is frozen (it must be on the server's `CLIPCADEMY_BUILD_IDS`)
- `topic_id` and `objective_id` whenever they're known

**Sending.** Push each event onto `event_queue` in storage, then flush the queue in order. Remove an event on `201` or `200` (duplicate). Keep it on a network error or `5xx`, and retry on the next action, on app load, and every 30 s. A retried event keeps its original `event_id` and `client_timestamp_utc`, so a Day 0 action sent on Day 1 still counts as Day 0. On `400`, log it to the console and drop it, because resending won't fix it. Sending never blocks or delays the student.

**Participant code.** Ask once on first open, trim it, upper-case it, and require it to be non-empty. Store it. Reset demo keeps it. Show it small on the home page so the moderator can check it. Changing it is a moderator action: a hidden link or a long-press, not a visible button.

## Test cases

Run against the live local service unless a case says samples.

| # | Steps | Expected |
| --- | --- | --- |
| 1 | First open | Participant code screen. After entry, it never appears again, even after Reset demo |
| 2 | Open the topic picker | Four cards. Coming-soon topics can be selected but not started |
| 3 | Replication, q1=B, q2=A | `complete` summary. Home shows the objective complete |
| 4 | q1=B, q2=B, watch follow-up, r2=B | Demo walkthrough: primer follow-up plays, then `rep-r2`, then `complete` |
| 5 | q1=A, r1=B, r3=B | Two follow-ups, then the `needs_review` summary with feedback and review points |
| 6 | Refresh on each screen | Same step reappears with the same data. No answer is resubmitted |
| 7 | Refresh while an attempt is in flight | The same `attempt_id` is resent once. The remediation count goes up only once |
| 8 | Double-tap Submit | One request |
| 9 | Make `/video-jobs` fail (or `503`) | Failure screen, Retry works, the answer isn't lost |
| 10 | Start replication, switch to DNA repair before the clip is ready | The replication clip never appears on the repair lesson |
| 11 | Go offline, answer a question, come back online | Student isn't blocked. The event arrives later with its original `client_timestamp_utc` |
| 12 | Reset demo | Clean picker. Participant code kept. `demo_reset` sent |
| 13 | Start the server with `CLIPCADEMY_BUILD_IDS=<the app's build_id>`, run cases 3–5, export `events.csv` | One row per action, all with the participant code and `build_id_status` `ok` |
| 14 | Inspect the question screen before submitting | No feedback, correct answer, or misconception visible, including in the network response |
| 15 | Open the hosted build on a phone, refresh mid-lesson | Works, and the refresh keeps the step (hash routes) |
| 16 | Keep the app on screen for 60 s with a 36 s hidden gap in the middle | One heartbeat per 30 s on screen, none while hidden (`e2e/run.mjs` case 16 runs the page clock at 4×) |

## Done when

- [ ] A classmate can complete the wrong-answer path and return home without coaching (case 4)
- [ ] The UI swaps in a targeted clip after a wrong answer and presents its retry question (cases 4, 5)
- [ ] Refresh preserves the student's last completed step and progress (cases 6, 7)
- [ ] A failed video job can be retried without losing the student's answer (case 9)
- [ ] A late response cannot replace a lesson after the student switches topics (case 10)
- [ ] Every action in Activity events sends one event with the participant code and `build_id`. A failed send is retried and never blocks the student (cases 11, 13)
- [ ] The home page does not label unavailable topics as working or completed (case 2)
- [ ] No feedback appears before submission, and no retry question is shown twice (case 14)
- [ ] The static build in `web/dist` works from the hosted URL on a phone (case 15)

## Decisions

1. **Stack:** plain JavaScript with Vite, building to static files (see Stack). Members 1 and 2 connect over HTTP, so this choice doesn't affect them.
2. **Build against samples first.** Member 2's samples are real app output, so switching to the live service is one flag in `api.js`. Video uses a sample MP4 until Member 1's `/video-jobs` exists.
3. **Server owns the decisions.** The client stores and returns `remediation_state` but never computes it, so grading has only one source.

## Open questions for the team

1. **Member 1:** confirm the `/video-jobs` response shapes (Team_Spec example) and share one sample MP4 and one `failed` response, so tasks 6 and 8 can be built now. Also add a field to the ready response saying how the clip was made, e.g. `"source": "prerendered" | "generated"`, so the lesson screen can disclose it.
2. **Member 2:** add `web/dist` to the PythonAnywhere static mapping once the first build exists (Deploying, step 5).
