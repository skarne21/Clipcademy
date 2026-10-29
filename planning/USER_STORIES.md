# Alpha Activity 2: requirement decomposition

**Commit-date exercise.** This planning work is assigned October 29, 2026, at 10:00 AM Eastern, after the TDD commits and before the MVP hypothesis and validation work in the simulated timeline. Its original recorded commit date was November 4, 2026. GitHub issue creation timestamps and commit ancestry are unchanged.

Generated from `planning/user_stories.py`; GitHub issues are created from the same file. It builds on, and does not
change, the MVP hypothesis and validation analysis in [validation-plan.md](../Context/validation-plan.md):

- **H1** Usability: ≥ 5 of 6 finish the core flow on Day 0 without help
- **H2** Recall gain: mean gain ≥ 2 scored questions and ≥ 4 of 6 improve
- **H3** Voluntary use: ≥ 3 of 6 answer a question on a later day with no reminder

## 1. Requirements that set Clipcademy apart

| ID | Requirement | Why it sets the product apart | Hypotheses | AI |
| --- | --- | --- | --- | --- |
| R1 | **Recall before explanation** | Students answer a question before seeing any explanation of it; no feedback appears before they commit. Study apps usually show content first; Clipcademy is built around retrieval practice. | H2 |  |
| R2 | **Misconception-targeted remediation by selection** | A wrong choice selects a pre-made follow-up clip aimed at that misconception, then a fresh retry question it has never shown. Missing the same idea again plays a second clip that explains it a different way (max 2 cycles). | H2 |  |
| R3 | **TikTok-style micro-lesson feed** | 4–5 vertical 15–30 s clips per topic, one idea each, in a full-screen swipe feed that auto-advances, with hooks, captions and a guide character so students want to keep watching. | H1, H3 |  |
| R4 | **Core AI: neural narration that drives captions and animation** | ElevenLabs text-to-speech narrates every reviewed script and returns when each character is spoken. That timing drives the burned-in word-by-word captions and triggers every on-screen action at the exact spoken word. | H1, H3 | **Yes** |
| R5 | **Reviewed, sourced content only** | Every clip and question cites the lecture excerpt it comes from and must be approved by a course-knowledgeable reviewer; the server refuses any clip whose approved fingerprint does not match. Nothing is generated live. | H2 |  |
| R6 | **Built-in measurement of the hypotheses** | Every action is logged with participant code and build ID so H1–H3 and the engagement metrics (completion, drop-off, auto vs. manual swipes, time on app) can be computed from events.csv. | H1, H2, H3 |  |
| R7 | **Proposed AI: LLM-assisted script and question drafting, human-approved** | An LLM drafts clip scripts and questions offline from the lecture excerpts; a reviewer edits and approves them before anything is rendered or shown. No LLM output ever reaches a student unreviewed. Team_Spec lists this as a later step ("automatic script writing … after the reviewed flow works"); it needs a team decision. | H2 | **Yes** |

### Core AI integration

- **Built (R4):** ElevenLabs neural text-to-speech narrates every reviewed script and returns per-character timing. That timing is the backbone of each clip: it places every burned-in caption word, triggers every animation beat and sound effect at the spoken word, and checks pacing (15–30 s, no still stretch over 3 s). Audio is cached, so a clip costs credits once.
- **Proposed (R7):** LLM-assisted drafting of scripts and questions from the lecture excerpts, always approved by a reviewer before use. The MVP deliberately keeps LLMs out of student sessions (Team_Spec: adapting means *selecting, not generating*), so this is offline authoring help, not live generation, and needs a team decision.

## 2. User stories and acceptance criteria

### US-01: Enter my participant code once

> As a study participant, I want to enter my anonymous participant code the first time I open the app, so that my activity is linked to my code without giving any personal information.

Requirement R6 · Hypotheses H1 · Owner Member 3 · Status **built** · GitHub issue [#9](https://github.com/skarne21/Clipcademy/issues/9)

Acceptance criteria:

1. The first open shows a participant-code screen; later opens skip it.
2. Codes are trimmed and upper-cased (`  p01 ` becomes `P01`); an empty code shows an inline error and does not continue.
3. The code is stored in the browser and sent with every event.
4. Reset demo keeps the code.

Evidence: web/e2e/run.mjs case 1

### US-02: Choose the topics on my exam

> As a student, I want to pick which of the four lecture topics are on my exam, so that my review only covers what I need.

Requirement R3 · Hypotheses H1 · Owner Member 3 · Status **built** · GitHub issue [#10](https://github.com/skarne21/Clipcademy/issues/10)

Acceptance criteria:

1. Four topic cards appear, one per lecture (19–22), without implying confirmed exam coverage.
2. Topics not yet approved show "Coming soon": they can be selected but never started.
3. Selections are saved and survive a refresh.

Evidence: web/e2e/run.mjs case 2

### US-03: See my progress on the home screen

> As a student, I want to see each topic as not started, in progress, complete, needs review or coming soon, so that I know where to pick up.

Requirement R1 · Hypotheses H1, H3 · Owner Member 3 · Status **built** · GitHub issue [#11](https://github.com/skarne21/Clipcademy/issues/11)

Acceptance criteria:

1. Each selected topic shows exactly one state: Not started, In progress, Complete, Needs review or Coming soon.
2. In progress offers Resume at the saved step; Complete offers the summary and Restart.
3. States match what the server returned for each attempt.

Evidence: web/e2e/run.mjs cases 3–6

### US-04: Swipe through short intro clips

> As a student, I want to swipe through 4–5 short vertical clips before the quiz, so that I learn one idea at a time in a format I already use.

Requirement R3 · Hypotheses H1, H3 · Owner Member 3 · Status **built** · GitHub issue [#12](https://github.com/skarne21/Clipcademy/issues/12)

Acceptance criteria:

1. The lesson plays the topic's `intro_video_requests` in order, full screen at 9:16.
2. Swiping up shows the next clip and swiping down the previous one; a "Clip n of N" progress bar is always visible.
3. Clips autoplay muted; one tap turns sound on for the rest of the feed.
4. The next clip preloads, so no spinner appears between clips.
5. A "Swipe up" hint shows on the first clip only.
6. Swiping past the last clip opens the first question.

Evidence: web/e2e/run.mjs case 17

### US-05: Clips move on by themselves

> As a student, I want the feed to move to the next clip when one finishes, so that I can keep learning hands-free and still swipe whenever I want.

Requirement R3 · Hypotheses H1, H3 · Owner Member 3 · Status **built** · GitHub issue [#13](https://github.com/skarne21/Clipcademy/issues/13)

Acceptance criteria:

1. About 0.6 s after a clip ends, the feed scrolls to the next slide (instantly with reduced motion).
2. It does not advance if the student already swiped, paused the clip, or has the transcript open.
3. After the last intro clip the question opens; after a follow-up clip the retry question opens.
4. Manual swipes up and down keep working at any time.
5. The move is logged as `clip_swiped` with `direction: "auto"`, separate from real swipes.

Evidence: web/e2e/run.mjs playback case; web/e2e/video-flow.mjs (1280 px and 390 px)

### US-06: Read along with captions and a transcript

> As a student, I want large captions that follow the narration and a transcript I can open, so that I can follow without sound and review the exact words.

Requirement R4 · Hypotheses H1 · Owner Member 1 + Member 3 · Status **built** · GitHub issue [#14](https://github.com/skarne21/Clipcademy/issues/14)

Acceptance criteria:

1. Every clip has burned-in captions of 1–3 words with the word being spoken highlighted, timed from the narration.
2. Each clip also ships a `.vtt` track and a `.txt` transcript identical to the narration.
3. A Captions button toggles the track; a Transcript button pauses the clip and shows the full text.
4. Captions stay inside y = 760–1000 and clear of the app's top, right and bottom safe zones.

Evidence: video/check_assets.py; web/e2e/run.mjs playback case

### US-07: Answer before I see the explanation

> As a student, I want to answer each question before any explanation is shown, so that I practise recalling the idea instead of recognising it.

Requirement R1 · Hypotheses H2 · Owner Member 2 + Member 3 · Status **built** · GitHub issue [#15](https://github.com/skarne21/Clipcademy/issues/15)

Acceptance criteria:

1. The question response contains no correct answer, feedback or misconception; nothing explanatory shows before Submit.
2. Submit is disabled until a choice is picked and while the attempt is being sent.
3. A double tap sends exactly one attempt.
4. Feedback appears only after the server grades the attempt.

Evidence: web/e2e/run.mjs cases 8 and 14; learning/test_app.py

### US-08: Get a clip aimed at my mistake

> As a student, I want a wrong answer to play a short clip about the exact idea I missed, then a new question, so that I fix the misconception right away.

Requirement R2 · Hypotheses H2 · Owner Member 2 + Member 1 · Status **built** · GitHub issue [#16](https://github.com/skarne21/Clipcademy/issues/16)

Acceptance criteria:

1. A wrong choice shows feedback for that choice and maps to a misconception (e.g. `growth_direction`, `primer_requirement`).
2. The app then plays that misconception's v1 follow-up clip in the same feed player.
3. After the clip, a retry question the student has never seen is shown; no retry question is ever shown twice.
4. Every follow-up clip exists for all four topics (16 follow-ups) and returns `ready`.

Evidence: video/test_integration.py; learning/test_grading.py

### US-09: Get a different explanation if I miss it again

> As a student, I want a second, differently explained clip if I miss the same idea twice, so that a new angle can work where the first one did not.

Requirement R2 · Hypotheses H2 · Owner Member 2 + Member 1 · Status **built** · GitHub issue [#17](https://github.com/skarne21/Clipcademy/issues/17)

Acceptance criteria:

1. A second miss on the same misconception plays its v2 clip (`<misconception>_followup_2`), which uses a different diagram or approach from v1, then another fresh retry.
2. After two follow-up cycles the reviewed explanation shows, the objective is marked Needs review, and another topic or Restart is offered.

Evidence: learning/test_grading.py; video/scripts/*_followup_2.json

### US-10: Prove I remember the required questions

> As a student, I want a required question I missed to come back after its follow-up, so that the topic only counts as complete once I can recall it.

Requirement R1 · Hypotheses H2 · Owner Member 2 · Status **built** · GitHub issue [#18](https://github.com/skarne21/Clipcademy/issues/18)

Acceptance criteria:

1. A missed required question returns once after its follow-up; it is the only question that ever repeats.
2. The objective is Complete only when every required question has been answered correctly.

Evidence: learning/test_grading.py

### US-11: Pick up where I left off

> As a student, I want a refresh or reopen to bring me back to the same step and clip, so that I never lose progress.

Requirement R3 · Hypotheses H1, H3 · Owner Member 3 · Status **built** · GitHub issue [#19](https://github.com/skarne21/Clipcademy/issues/19)

Acceptance criteria:

1. A refresh on a clip, question, feedback or summary returns to the same screen.
2. A refresh mid-feed returns to the same clip and sends no extra swipe event.
3. A video job in progress keeps polling the saved job instead of starting a new one.

Evidence: web/e2e/run.mjs cases 6 and 17

### US-12: Retry a clip that fails to load

> As a student, I want a clear message and a Retry button when a clip cannot load, so that a network problem never loses my answer.

Requirement R3 · Hypotheses H1 · Owner Member 3 + Member 1 · Status **built** · GitHub issue [#20](https://github.com/skarne21/Clipcademy/issues/20)

Acceptance criteria:

1. A failed or missing clip shows "The clip couldn't load." with Retry; a follow-up adds "Your answer is saved."
2. Retry starts a new video job; the saved answer and progress are unchanged.
3. A failed job response has a plain `error` and no playable URL.

Evidence: web/e2e/run.mjs case 9; video/test_jobs.py; video/samples/failed.json

### US-13: Narrate every script with an AI voice that reports its timing

> As a content creator, I want each reviewed script narrated by ElevenLabs with per-character timestamps, so that clips sound natural and every caption and animation lands on the spoken word.

Requirement R4 · Hypotheses H1, H3 · Owner Member 1 · Status **built** · GitHub issue [#21](https://github.com/skarne21/Clipcademy/issues/21)

Acceptance criteria:

1. `video/tts.py` calls the ElevenLabs with-timestamps endpoint for the exact narration text and maps the character timings onto words.
2. Audio is cached by text, voice and settings, so re-rendering spends no credits unless the narration changes.
3. The API key is read from git-ignored `video/.env`, needs only Text to Speech and Voices read, and is never logged.
4. Each manifest records the synthetic voice used.
5. Narration runs at 150–170 words a minute (open: 18 of 35 clips are 138–189 wpm; `video/test_pace.py` is red, see planning/TDD_LOG.md).
6. An offline draft voice gets a different fingerprint, so a draft can never pass as an approved clip.

Evidence: video/tts.py; video/media/*.json (narration field)

### US-14: Time every animation to the narration

> As a content creator, I want on-screen actions triggered by the words they illustrate, with a hook from the first frame, so that clips keep attention and stay clear.

Requirement R4 · Hypotheses H1, H3 · Owner Member 1 · Status **built** · GitHub issue [#22](https://github.com/skarne21/Clipcademy/issues/22)

Acceptance criteria:

1. Each script lists beats (spoken cue → actions); `video/beats.py` resolves each cue to the time the word is spoken.
2. The hook text is on screen from frame 1 and the first on-screen change happens within 2 s.
3. A render fails if a clip is outside 15–30 s or has more than 3 s with no on-screen change.
4. Sound effects (pop, click, whoosh) fire on the same beats; every clip opens with the same 1-second sting.

Evidence: video/test_beats.py; video/render.py guards

### US-15: Show each process as an animated diagram

> As a student, I want a stick-figure guide and animated diagrams of each process, so that I can see how the biology works, not just hear it.

Requirement R3 · Hypotheses H2 · Owner Member 1 · Status **built** · GitHub issue [#23](https://github.com/skarne21/Clipcademy/issues/23)

Acceptance criteria:

1. The same guide character appears in every clip and points at what the narration names.
2. Replication, repair, transcription, translation and timeline diagrams animate the step being explained (e.g. pieces joining the 3′ end, UV bond and bulge, RNA built on the template strand, tRNA from A to P to E).
3. All 35 clips are 720×1280 H.264 + AAC and keep the app's safe zones clear.

Evidence: video/check_assets.py; video/remotion/src/scenes/

### US-16: Write every script from the lecture sources

> As a content creator, I want every clip script built from the packet's source excerpts with its hook claim and analogy listed, so that a reviewer can check each claim quickly.

Requirement R5 · Hypotheses H2 · Owner Member 1 + Member 2 · Status **built** · GitHub issue [#24](https://github.com/skarne21/Clipcademy/issues/24)

Acceptance criteria:

1. Every script cites its packet `source_refs`; its teaching goal is read from the packet, not retyped.
2. Intro clips end on the teaching goal sentence plus a swipe teaser; the last intro ends with "Let's see what you remember."
3. Each script records `hook_claim`, `analogy` and `new_term` for the reviewer.
4. `video/SCRIPTS_FOR_REVIEW.md` lists every narration with those notes.

Evidence: video/write_scripts.py; video/SCRIPTS_FOR_REVIEW.md

### US-17: Serve only approved, pre-rendered clips

> As a student, I want every clip to come from an approved, pre-rendered file, so that I only see checked content and it loads fast on the free host.

Requirement R5 · Hypotheses H1, H2 · Owner Member 1 · Status **built** · GitHub issue [#25](https://github.com/skarne21/Clipcademy/issues/25)

Acceptance criteria:

1. `POST /video-jobs` accepts only catalog variants and returns `ready` with `video_url`, `captions_url`, transcript, duration, `width` and `height`.
2. Without preview mode, a clip plays only if its audit row is approved with a matching fingerprint; otherwise `403`.
3. The host never renders video; repeated requests reuse the same job (`cache_hit`).

Evidence: video/test_jobs.py; video/test_integration.py

### US-18: Approve content before release

> As a content reviewer, I want a checklist row for every clip, question, feedback line and test item, with source, analogy and hook checks, so that nothing wrong or unsourced reaches students.

Requirement R5 · Hypotheses H2 · Owner Member 2 · Status **built** · GitHub issue [#26](https://github.com/skarne21/Clipcademy/issues/26)

Acceptance criteria:

1. `Context/content-audit.csv` has one row per item, including all 35 clips with `analogy_ok` and `hook_in_sources`.
2. `python learning/check_content.py --freeze` fails while any available item is unapproved or a clip fingerprint does not match.
3. A topic that is not fully approved stays Coming soon in the frozen build.

Evidence: learning/test_check_content.py

### US-19: Log every action for the study

> As a study researcher, I want every student action stored with participant code, build ID and device time, so that H1–H3 can be computed from real use.

Requirement R6 · Hypotheses H1, H2, H3 · Owner Member 2 + Member 3 · Status **built** · GitHub issue [#27](https://github.com/skarne21/Clipcademy/issues/27)

Acceptance criteria:

1. Every action in Team_Spec's activity events sends one event to `POST /events`; failed sends retry with the same `event_id` and never block the student.
2. `GET /events.csv` with the admin token exports every event with `build_id_status` (ok, missing or unknown).
3. A duplicate `event_id` is stored once.

Evidence: learning/test_app.py; web/e2e/run.mjs

### US-20: Measure engagement with the feed

> As a study researcher, I want per-clip starts, completions, swipes (manual or automatic) and visible time on app, so that we can see where students drop off and whether they come back.

Requirement R6 · Hypotheses H1, H3 · Owner Member 3 + Member 2 · Status **built** · GitHub issue [#28](https://github.com/skarne21/Clipcademy/issues/28)

Acceptance criteria:

1. `video_started` and `video_completed` are sent once per time a clip is on screen.
2. `clip_swiped` records `variant_id`, `direction` (up, down or auto) and `seconds_watched`.
3. A `heartbeat` is sent every 30 s only while the app is visible, carrying leftover seconds across a refresh.

Evidence: web/e2e/heartbeat.mjs; learning/test_app.py test_clip_swiped

### US-21: Use the app on my phone from one link

> As a study participant, I want to open the study build on my own phone from one web address, so that I can use it whenever I choose during Days 0–2.

Requirement R3 · Hypotheses H1, H3 · Owner Member 2 · Status **in progress** · GitHub issue [#29](https://github.com/skarne21/Clipcademy/issues/29)

Acceptance criteria:

1. https://clipcademy.pythonanywhere.com serves the app at `/`, the API, and clips at `/media/` from one origin.
2. The frozen build ID (`study-4`) is in the app and on the server; preview mode is off for participants.
3. The full flow is checked on iOS Safari and Android Chrome: inline playback, captions, nothing overlapping.
4. The web app is extended to run through Day 2.

Evidence: Member2_SPEC.md Deploying; web/e2e/video-flow.mjs at 390 px

### US-22: Reset the demo between sessions

> As a study moderator, I want a Reset demo control that clears progress but keeps the participant code, so that each observed session starts clean.

Requirement R6 · Hypotheses H1 · Owner Member 3 · Status **built** · GitHub issue [#30](https://github.com/skarne21/Clipcademy/issues/30)

Acceptance criteria:

1. Reset demo needs a second tap ("Tap again to clear all progress") so it can't be hit by accident.
2. It clears selected topics and every objective's attempts, remediation state, step and video jobs.
3. It keeps the participant code and any events not yet sent, and logs a `demo_reset` event.

Evidence: web/src/store.js resetDemo; web/src/main.js

### US-23: Draft scripts and questions with an LLM, then review them

> As a content creator, I want an LLM to draft clip scripts and practice questions from the lecture excerpts, so that we can cover more topics faster while every item is still human-approved.

Requirement R7 · Hypotheses H2 · Owner Member 1 + Member 2 · Status **proposed** · GitHub issue [#31](https://github.com/skarne21/Clipcademy/issues/31)

Acceptance criteria:

1. Drafting runs offline from the packet's `source_excerpts` only; every claim in a draft names the excerpt it came from.
2. Drafts are saved as `review_status: pending` and cannot be rendered for students or served until a reviewer approves them.
3. No LLM call happens during a student session; the app still only selects pre-approved items.
4. The reviewer can see which parts were LLM-drafted and what they changed.
5. Team decision recorded before work starts, since Team_Spec defers LLM generation to after the reviewed flow works.

Evidence: Team_Spec.md (Member 1 section) and Scope

## 3. Coverage of planned Alpha functionality

| Alpha functionality (Team_Spec, notes.md) | Stories |
| --- | --- |
| Participant code, topic picker, review home | US-01, US-02, US-03 |
| Vertical swipe feed of 4–5 intro clips, auto-advance, manual swipe | US-04, US-05 |
| Captions, transcript, accessibility | US-06 |
| Question before explanation, double-submit safety | US-07 |
| Wrong answer → targeted follow-up → fresh retry | US-08 |
| Second, different follow-up; two-cycle limit; needs review | US-09 |
| Required questions and objective completion | US-10 |
| Progress persistence and refresh | US-11 |
| Clip failure and retry | US-12 |
| AI narration and word-synced captions/animation (core AI) | US-13, US-14 |
| Animated stick-figure diagrams for all four topics (35 clips) | US-15 |
| Sourced scripts and reviewer text | US-16 |
| Prerendered clip API with review gate | US-17 |
| Content audit and freeze gate | US-18 |
| Activity events and export for H1–H3 | US-19, US-20 |
| Hosting and phone check | US-21 |
| Reset demo | US-22 |
| LLM-assisted authoring (proposed) | US-23 |

Totals: 7 requirements, 23 user stories (21 built, 1 in progress, 1 proposed), 84 acceptance criteria. One GitHub issue per story, labelled `user-story`, its area, its status, and its requirement.
