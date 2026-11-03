# Clipcademy prototype specification

## Scope and decisions

This document proposes a build plan for three teammates working at the same time. It specifies intended behavior, not features already implemented.

The subject is biology (confirmed), using the lecture notes in [Notes/](../Notes/). The notes establish possible review topics, but do not identify an exam's coverage. Students select their exam topics from a prepared list for this prototype.

The product goal is **active recall**. Students pull answers from memory by answering a question before seeing any explanation of it. A wrong answer triggers a short video aimed only at what they couldn't recall, followed by a fresh question they haven't seen. Feedback never appears before the student commits to an answer, and a retry question is never shown twice. In the MVP, adapting means **selecting, not generating**: the wrong answer picks which pre-written follow-up video and which pre-written retry question come next. Nothing is written by an LLM during a session, because every item must pass content review before students see it (validation-plan.md). Generating new videos or questions per student would be a later product change. It would need an LLM API key and a new review process. The one planned repeat is a required question the student missed: it comes back after its follow-up, so they recall it correctly before the objective counts as complete.

Build one working browser experience with topic selection, a stick-figure review video, questions, feedback, a targeted follow-up video, and saved progress. Use four topic cards derived from the four lectures. Fully implement one adaptive lesson first, then expand only after that flow works.

The validation build has two lessons: DNA replication (Lecture 19) and DNA repair (Lecture 20). One lesson takes about 10 minutes, which leaves students nothing new to come back to. DNA repair follows replication directly in the course and its notes are clear once the flagged passage is left out. Transcription and translation stay "Coming soon" for the study, because Lectures 21 and 22 have unclear or inconsistent passages and each lecture adds three clips and a full content review.

The proposed first lesson is DNA synthesis direction and the need for a primer. It has a clear source in Lecture 19, pp. 1–2, and a concrete wrong-answer branch. The same stick-figure guide should appear in every clip, with biological diagrams used to explain the actual process.

## Source map

Page numbers below are PDF page numbers. These references support the lesson content. Product choices and assignments are team recommendations.

| Source | Available review topics | Proposed topic ID |
| --- | --- | --- |
| [Lecture 19](../Notes/Lec%20%2319.pdf), pp. 1–3 | DNA synthesis direction, primers, leading and lagging strands, ligase, replication proteins | `dna_replication` |
| [Lecture 20](../Notes/Lec%20%2320.pdf), p. 1 | Telomerase, proofreading, mismatch correction, UV-damage repair | `dna_repair` |
| [Lecture 21](../Notes/Lec%20%2321.pdf), p. 1 | RNA polymerase, template and coding strands, promoter | `transcription` |
| [Lecture 22](../Notes/Lec%20%2322.pdf), pp. 1–2 | tRNA, codon–anticodon pairing, initiation, A/P/E sites, elongation | `translation` |

Content review is required before publication. Lecture 22 describes tRNA functions and then says “tRNAs consist of two subunits,” while its later text attributes small and large subunits to the ribosome. Clarify that inconsistency with the instructor. Lecture 19's joining/primer-removal sequence and Lecture 21's upstream/downstream wording also require clarification before animating those sequences or testing those definitions. Lecture 20's cancer/senescence claim should be reviewed before inclusion. These passages remain unpublished until reviewed. The lecture notes belong to the instructor, so get written permission to use excerpts from them before any student sees a clip. **Permission received 2026-11-02** (Member 2 holds the written copy).

## Whole-product behavior

1. Student opens the home screen and selects topics included on their exam.
2. App builds a review queue from those selections. Topic cards show availability and progress.
3. Student opens an available topic and requests its initial review video.
4. App displays a preparing state while the video job runs, then presents the playable clip with captions or transcript.
5. Student answers a prepared multiple-choice question tied to that clip's objective.
6. Correct answer shows explanatory feedback. After all required questions for that objective are correct, mark it complete.
7. Incorrect answer shows feedback and identifies a possible misconception based on the chosen option. Request a follow-up video for that objective and misconception.
8. Student watches the follow-up and answers a new question. Save the attempt and updated progress.
9. Allow at most two follow-up cycles per objective in this prototype. After that, show the reviewed explanation (the feedback for the chosen answer plus the lesson's key points from its packet), mark the objective `needs_review`, and offer another topic or a restart.

Treat answer-to-misconception mapping as a teaching choice, not a confirmed diagnosis of the student's thinking. Choosing a wrong option is enough to select a relevant explanation for this demo.

### Minimum demonstration

- Four visible topic cards with accurate content labels and explicit availability.
- One fully working replication lesson, one initial clip, and one targeted follow-up.
- For the validation build: the DNA repair lesson (`error_correction`) also working, with its initial clip and both follow-ups (`timing_followup`, `uv_followup`), after content review.
- Two initial questions and at least two follow-up questions for the first objective.
- Two initial wrong-answer choices can share the same follow-up explanation when appropriate.
- Real playback, question checking, branching, retry, and progress persistence in the same browser.
- A tested input-to-video pipeline for the approved lesson variants. Clearly disclose whether a shown clip was generated during the session or served from a previously rendered version.

Additional topics can display “Coming soon” until their content and questions are ready. Define completion at the objective level. A completed synthesis-direction objective must not imply mastery of all DNA replication.

## Member 1 — video generation and visual consistency

### Responsibility

Turn an approved lesson request into a video using a reusable stick-figure and diagram template. Support an initial explanation and a targeted follow-up with the same visual style.

### Small tasks

1. Define the guide character, colors, fonts, diagram labels, and narration style in one shared template.
2. Prepare the approved source excerpt and two lesson scripts for the replication objective.
3. Build a renderer that accepts a lesson variant, text, labels, and diagram parameters. Return a video job ID immediately and a playable URL when finished.
4. Add narration and a matching transcript. A proposed duration is 30–60 seconds per clip.
5. Add the follow-up variant explaining why DNA polymerase needs an existing complementary strand started by a primer.
6. Provide two sample requests, their outputs, and one failed-job example to the team.
7. After the replication clips work, render the three DNA repair clips (initial, `timing_followup`, `uv_followup`) from the repair lesson packet for the validation build.

### Initial clip storyboard

| Scene | Visual | Teaching point and source |
| --- | --- | --- |
| 1 | Guide points at a template and a short complementary strand with both ends labeled | DNA strands run antiparallel. Lecture 19, p. 1. |
| 2 | Highlight the growing strand's 3′ end and add a nucleotide there | New DNA is synthesized 5′ to 3′ by adding to the 3′ end. Lecture 19, p. 1. |
| 3 | Show an RNA primer and DNA polymerase extending the strand | DNA polymerase requires an existing complementary start. Primase makes the RNA primer. Lecture 19, pp. 1–2. |
| 4 | Recap direction and primer requirement with the guide | Prepare the learner for the two objective questions. |

### Follow-up clip

Keep the same character and strand labels. Begin with a bare template, introduce the primer, and highlight its extendable end. Show polymerase adding DNA after the primer is present. Focus on the missed idea rather than replaying the entire original script.

For the prototype, use approved scripts and fixed variants as renderer inputs. Automatic script writing from arbitrary notes can be added after the reviewed flow works. Use one owner for the video-job API wrapper so the frontend has a stable endpoint.

### Independent starting input

```json
{
  "topic_id": "dna_replication",
  "objective_id": "synthesis_direction_and_primer",
  "variant_id": "primer_followup",
  "teaching_goal": "Explain why DNA polymerase needs a primer",
  "source_refs": ["L19-p1", "L19-p2"]
}
```

### Done when

- The initial and follow-up requests produce playable clips using the same template.
- Labels, arrows, narration, and transcript agree with the approved scripts.
- The preparing, ready, and failed states work.
- A repeated request reuses the same completed asset when appropriate.
- The follow-up explains the requested difficulty and has a valid source reference.

## Member 2 — questions and adaptive lesson logic

### Responsibility

Own the reviewed lesson text, question bank, correct answers, feedback, and decisions that request subsequent videos. Work from the written source excerpts while Member 1 builds the renderer.

### Small tasks

1. Create the topic list and objective IDs from the source map.
2. Prepare a lesson packet for the first objective, with source excerpts and initial/follow-up teaching goals. Share it immediately with Members 1 and 3.
3. Write two initial questions, four retry questions (two per misconception, so a second follow-up never repeats a question), and feedback for each choice.
4. Map wrong choices to misconception IDs and approved video variants.
5. Build answer checking and the transition rules for `continue_questions`, `review_again`, `complete`, and `needs_review`.
6. Track remediation cycles per objective (total count; a correct answer does not reset it) and stop at the configured limit of two.
7. Provide sample question responses and answer-result responses before connecting the real video service.
8. Host `POST /events` and export the stored events as `events.csv` for the validation study. The server holds the list of valid build IDs, set at the build freeze. Store every event, and mark each one `ok`, `missing`, or `unknown` in the export's `build_id_status` column.

### Starter question bank

| ID | Question and choices | Correct answer | Wrong-answer follow-up | Source |
| --- | --- | --- | --- | --- |
| `rep-q1` | Which end receives new nucleotides during DNA synthesis? A. 5′ end B. 3′ end | B | `direction_followup` explains growth direction and the growing end | L19 p. 1 |
| `rep-q2` | Why is a primer needed? A. DNA polymerase can't start a new strand B. Ligase uses it to add the new bases C. It lets DNA grow in the 3′ to 5′ direction | A | B → `primer_followup` focuses on the existing start and polymerase's role; C → `direction_followup` (C states the wrong direction) | L19 pp. 1–2 |
| `rep-r1` | A complementary primer is already present. Where does DNA polymerase add the next DNA nucleotide? A. Its 3′ end B. Its 5′ end | A | Return to the direction explanation within the retry limit | L19 p. 1 |
| `rep-r2` | Which enzyme makes the RNA primer? A. Ligase B. Primase C. DNA polymerase | B | Return to the primer explanation within the retry limit | L19 p. 2 |

This table is a summary. The complete bank, including the second retries `rep-r3` and `rep-r4` and feedback for every choice, is in [Member2_SPEC.md](Member2_SPEC.md).

These are proposed questions based on the notes, not observed student errors. Review them with the team before publishing. The question API must omit correct-choice IDs until the student submits an answer. Keep the answer key with the grading logic.

### Example answer result

```json
{
  "attempt_id": "attempt-001",
  "question_id": "rep-q2",
  "correct": false,
  "action": "review_again",
  "feedback": "Ligase joins pieces of DNA. It does not add the new bases. DNA polymerase extends a primer that primase made.",
  "misconception_id": "primer_requirement",
  "next_video_request": {
    "topic_id": "dna_replication",
    "objective_id": "synthesis_direction_and_primer",
    "variant_id": "primer_followup",
    "teaching_goal": "Explain why DNA polymerase needs a primer",
    "source_refs": ["L19-p1", "L19-p2"]
  },
  "next_question_id": "rep-r2",
  "remediation_state": { "objective_status": "in_progress", "expected_question_id": "rep-r2", "remediation_count": 1, "satisfied_question_ids": ["rep-q1"], "asked_retry_ids": ["rep-r2"] },
  "source_refs": ["L19-p1", "L19-p2"]
}
```

### Done when

- Every choice returns the expected feedback and next action using sample inputs.
- Wrong answers request a relevant video variant and a fresh question.
- One correct answer does not skip remaining required questions.
- Two unsuccessful remediation cycles lead to `needs_review`.
- Repeating the same submission does not create another attempt or another video request.
- All released content has reviewed source references.

## Member 3 — student interface and application integration

### Responsibility

Build the connected student experience and own the shared application shell, navigation, and local progress storage. Use sample API responses and a sample MP4 from the start.

### Small tasks

1. Build the exam-topic picker using the four topics. Persist selections.
2. Build the review home page with available, coming-soon, in-progress, completed-objective, and needs-review states.
3. Build the video screen with controls, transcript, back navigation, and a question button.
4. Build a reusable question screen with answer selection and submission. Disable duplicate submissions while waiting.
5. Build feedback and follow-up screens. Display preparing and failure states with a retry button.
6. Save question position, selected topics, attempts, remediation count, and objective status in browser storage.
7. Create a Reset demo control and connect the actual question/video services through one replaceable data-access module.
8. Ask for a participant code on first open, store it locally, and send an event to `POST /events` for every action listed under Activity events. Every event includes the `build_id`, a fixed value set in the app when the build is frozen, and `client_timestamp_utc`, the device time when the action happened. A retried send keeps the original timestamp and `event_id`. Reset demo keeps the participant code.

### Screen behavior

| Screen | Visible elements | Next action |
| --- | --- | --- |
| Participant code | Code entry (first open only) | Exam topics |
| Exam topics | Four topic cards, selections, availability labels | Start selected available topic |
| Review home | Selected topics, objective progress, Resume | Open initial lesson or resume saved step |
| Lesson | Video, transcript, title, lesson purpose | Open current question |
| Question | Prompt, choices, Submit | Show feedback from answer result |
| Feedback | Correctness, explanation, source label | Continue questions, request follow-up, or finish |
| Follow-up preparing | Preparing status and navigation | Play ready clip or show retry on failure |
| Summary | Completed objective or needs-review status | Return home or restart |

### Done when

- A classmate can complete the wrong-answer path and return home without coaching.
- The UI swaps in a targeted clip after a wrong answer and presents its retry question.
- Refresh preserves the student's last completed step and progress.
- A failed video job can be retried without losing the student's answer.
- A late response cannot replace a lesson after the student switches topics.
- Every action in Activity events sends one event with the participant code and `build_id`. A failed send is retried and never blocks the student.
- The home page does not label unavailable topics as working or completed.

## Shared integration contract

Agree on these IDs and response shapes before working separately. Member 2's service is Python (standard library) on port 8000 with no path prefix. Member 1's video endpoints can use any stack. Errors use the body `{"error": {"field": "...", "message": "..."}}`.

| Endpoint | Owner | Required behavior |
| --- | --- | --- |
| `GET /topics` | Member 2 | Return topic IDs, labels, source references, availability, and available objectives |
| `GET /questions/{question_id}` | Member 2 | Return prompt and choice IDs/text without answer key |
| `POST /attempts` | Member 2 | Accept attempt ID, question ID, selected choice, objective ID, and remediation state. Return feedback, action, and next question/video request |
| `POST /video-jobs` | Member 1 | Accept the approved video request. Return job ID and state |
| `GET /video-jobs/{job_id}` | Member 1 | Return `queued`, `running`, `ready`, or `failed`. Ready includes playable video URL and transcript |
| `POST /events` | Member 2 (stores), Member 3 (sends) | Accept one activity event and store it with a server timestamp. Ignore a repeated `event_id` (`200`, not an error). Reject an unknown `event_name` or a missing required field with `400`. Field list and the token-protected `GET /events.csv` export: [Member2_SPEC.md](Member2_SPEC.md), Service |
| Local session storage | Member 3 | Persist participant code, selection, objective status, current step, attempts, and job ID for this browser |

Example ready video response follows.

```json
{
  "job_id": "video-001",
  "status": "ready",
  "variant_id": "primer_followup",
  "video_url": "/media/primer-followup.mp4",
  "transcript": "Reviewed narration supplied with the clip.",
  "source_refs": ["L19-p1", "L19-p2"]
}
```

The URL above is an illustrative local path, not an existing asset. The sample transcript is a placeholder to replace during implementation. An unknown ID or malformed request must produce a clear error. Failed generation must return `failed` rather than a fake ready response.

### Activity events

The validation study needs these events to measure in-app activity. Local storage alone can't do that, because it never leaves the student's device. Each event has the columns in [events.csv](events.csv), including the `build_id` of the app that sent it.

| `event_name` | When | Extra fields |
| --- | --- | --- |
| `app_opened` | App loads (starts a new `session_id`) | none |
| `topic_selected` | Student selects a topic | `topic_id` |
| `video_started` / `video_completed` | Clip starts playing / reaches the end | `variant_id` |
| `question_answered` | Attempt result comes back | `question_id`, `correct` |
| `followup_requested` | App requests a follow-up clip | `variant_id` |
| `objective_completed` / `objective_needs_review` | Objective reaches that status | `objective_id` |
| `demo_reset` | Reset demo is used | none |

Member 3 calls the video service after Member 2 returns `review_again`. The question service can return that instruction without waiting for a renderer. Member 1 can generate from manually supplied requests without waiting for the quiz. All three use the same approved lesson packet.

## Parallel work and checkpoints

| Checkpoint | Member 1 | Member 2 | Member 3 | Team outcome |
| --- | --- | --- | --- | --- |
| Shared kickoff | Agree on scene template inputs | Publish first lesson packet and question IDs | Agree on UI states and sample response shapes | Commit sample data and contracts together |
| First independent build | Render initial clip from fixed input | Check all starter answers using written lesson | Build full navigation using sample clip and responses | Each part runs independently |
| First connection | Supply playable clip and job API | Supply real question and answer logic | Replace sample responses and connect services | One connected initial lesson |
| Adaptive connection | Render targeted follow-up variant | Return follow-up request and fresh question | Wire loading, follow-up, and retry | Wrong answer changes next lesson |
| Demo readiness | Check narration and diagrams | Verify sources, answer key, and stopping rules | Test persistence, failures, and reset | Rehearse complete flow |

Suggested file ownership is `video/` for Member 1, `learning/` and the shared lesson packets for Member 2, and `web/` for Member 3. Agree before editing shared contracts. Each member implements their own service wrapper, with Member 3 owning the development app's service configuration and final integration.

**Hosting (study build):** one free PythonAnywhere web app serves everything from one origin. It runs Member 2's Python WSGI service, serves Member 3's built static files at `/`, and serves Member 1's pre-rendered clips at `/media/`. This affects the other members:
- **Member 3:** the app must build to plain static files (HTML/JS/CSS) and call the API with relative paths (`/topics`, `/attempts`), so the same build works locally and when hosted. No Node server runs in production.
- **Member 1:** the host can't render video. Render every approved clip ahead of time, and expose `/video-jobs` as a small Python WSGI handler that Member 2's app mounts, returning the stored clip for each variant. Keep the clips small, because the whole account has 512 MiB.

**What the free host can and can't do:**

| Part | On PythonAnywhere? |
| --- | --- |
| Member 2 service, SQLite data, events export | Yes |
| Member 3's app, as static files | Yes |
| Playing pre-rendered clips from `/media/` | Yes |
| Member 1's `/video-jobs` returning stored clips | Yes, if written in Python |
| **Live video rendering** | **No.** It has one web worker (a render would freeze the app for every student), limited CPU, outbound internet restricted to an allowlist (a hosted text-to-speech API may be blocked), and no Node |

The study doesn't need live rendering. Every clip comes from an approved script for a fixed variant, so it can be rendered ahead of time and served as "previously rendered," which Team_Spec allows if presenters say so. To show live generation in the class presentation, run Member 1's renderer on a laptop.

**Confirm these with the team before building further:**
1. **Member 1:** write `/video-jobs` in Python, as a WSGI handler Member 2's app can mount. If the renderer itself uses another language, that's fine, as long as it runs on a laptop and only the stored MP4s go to the host. If `/video-jobs` has to be Node, it needs a second host and its own CORS setup.
2. **Member 1:** encode clips small, at 30–60 s and 720p or lower. The whole account has 512 MiB.
3. **Member 3:** pick a frontend that builds to static files (plain HTML/JS, or a static build from a tool like Vite), not one that needs a server at runtime (such as Next.js server rendering). Call the API with relative paths.
4. **Everyone:** after deploying, test playback and the full flow from a phone. The free plan's bandwidth is described only as "low," with no number.

**How `/video-jobs` plugs in:** Member 1 provides `video/jobs.py` exposing a WSGI callable named `application`. It handles `POST /video-jobs` and `GET /video-jobs/{job_id}` with the responses in the contract above. Member 2's app passes every request whose path starts with `/video-jobs` to it unchanged, and returns `503` with the standard error body until that file exists.

**Local development:** run Member 2's service with `python learning/app.py` (port 8000). Member 3's dev server must proxy the API paths (`/topics`, `/questions`, `/attempts`, `/events`, `/video-jobs`) to `http://localhost:8000`, so the relative paths work locally exactly as they do when hosted. With Vite, that's the `server.proxy` setting. Until the service is connected, Member 3 can build against `learning/samples/`.

Costs, limits, and alternatives are in [Member2_SPEC.md](Member2_SPEC.md), Hosting.

## Whole-product acceptance checklist

- [ ] Topic picker uses the four supplied lectures and does not imply confirmed exam coverage.
- [ ] Replication objective can be started, resumed, and completed.
- [ ] Initial clip, question, feedback, follow-up clip, retry, and progress form one connected flow.
- [ ] Direction and primer misconceptions select the appropriate approved explanation.
- [ ] Required question completion and the two-cycle limit are enforced.
- [ ] Generation failures and duplicate submissions preserve consistent state.
- [ ] Reset demo restores a clean session.
- [ ] Available topic cards match actual implemented lessons. For the validation build, that means replication and DNA repair only.
- [ ] Unclear note passages remain unpublished pending review.
- [ ] Presenters accurately identify prepared scripts, previously rendered assets, and live generation.
- [ ] Every activity event reaches `POST /events` with a participant code and `build_id`, and `events.csv` exports correctly.
- [ ] No feedback or explanation appears before the student submits an answer, and no retry question is shown twice. Only a missed required question comes back.

## Presentation walkthrough

1. Select DNA replication as an exam topic and open the synthesis objective.
2. Play the initial clip and answer the direction question correctly.
3. Choose an incorrect answer on the primer question.
4. Show the feedback and the targeted primer follow-up, including its preparing state if generated live.
5. Answer the new question correctly.
6. Return home to show the completed objective, then refresh to demonstrate persistence.

The intended prototype demonstrates the review-and-remediation workflow. Whether students use it voluntarily and learn from it is tested separately in [validation-plan.md](validation-plan.md). Topic-level completion is a demo progress rule, not proof of mastery.
