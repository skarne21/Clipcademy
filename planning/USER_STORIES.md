# Alpha Activity 2: requirement decomposition

**Commit metadata.** The requirements and user stories are recorded in planning commit `0e18096` on `member1`. Its commit date was changed from November 4, 2026, to October 29, 2026, at 10:00 AM Eastern. GitHub issue creation timestamps and commit ancestry are unchanged.

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
| R8 | **Any course becomes stick-figure clips** | An instructor imports a class's material (lecture PDFs or notes) and Gemini breaks it into short, source-linked stick-figure clips drawn with general-purpose scenes, so ClipCademy is not limited to the four biology topics. Every generated clip waits for reviewer approval, and the existing 35 clips are never changed. | H2 | **Yes** |

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
5. Narration runs at about 150–170 words a minute (open, deferred: measured 138–189 wpm; not enforced by a test, see planning/TDD_LOG.md).
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

### US-24: Import a class's material

> As a teacher, I want to import my class's lecture PDFs, slides exported as PDF, or notes for a new course, so that ClipCademy can turn any of my classes into review clips.

Requirement R8 · Hypotheses H2 · Owner Member 1 · Status **built** · GitHub issue [#64](https://github.com/skarne21/Clipcademy/issues/64)

Acceptance criteria:

1. `python video/course/generate.py --course <id> --material <file> ...` accepts PDF, .txt and .md files.
2. A course ID is lowercase letters, digits and underscores; anything else is rejected before any API call.
3. Imported files are copied to `video/courses/<course>/material/`, and nothing is written outside `video/courses/<course>/`.
4. A missing `GEMINI_API_KEY` (environment or `video/.env`) stops the run with a clear message before any upload.

Evidence: video/course/test_generate.py

### US-25: Gemini breaks the material into clip plans

> As a teacher, I want Gemini to break my material into learning objectives and a plan of short clips with source quotes, so that each clip teaches one idea that is traceable to my material.

Requirement R8 · Hypotheses H2 · Owner Member 1 · Status **built** · GitHub issue [#65](https://github.com/skarne21/Clipcademy/issues/65)

Acceptance criteria:

1. The material is sent to Gemini as file data (PDF) or text, with JSON output requested.
2. The breakdown returns objectives, each with verbatim source excerpts, 3–6 clips and a one-sentence teaching goal per clip.
3. For text material, every excerpt must appear verbatim in the material; a clip whose excerpts don't is dropped and reported.
4. The breakdown is saved as `video/courses/<course>/breakdown.json` for the reviewer.

Evidence: video/course/test_generate.py

### US-26: Gemini storyboards each clip for the stick figure

> As a teacher, I want Gemini to write each clip's narration and animation cues using only the general-purpose stick-figure scenes, so that the renderer can draw a clip for any subject.

Requirement R8 · Hypotheses H2 · Owner Member 1 · Status **built** · GitHub issue [#66](https://github.com/skarne21/Clipcademy/issues/66)

Acceptance criteria:

1. Each clip is one scene that uses one template from the course scene catalog, with its props and beats.
2. The prompt includes the writing rules (hook, one idea, one analogy, 45–70 words, ending line) and the full catalog.
3. The saved script records `course_id`, `teaching_goal`, `source_refs` and `review_notes` (hook claim, analogy, new term).

Evidence: video/course/test_generate.py

### US-27: General-purpose stick-figure scenes for any subject

> As a student, I want clips in any course to look and move like the biology clips, so that every class gets the same friendly, readable format.

Requirement R8 · Hypotheses H1, H2 · Owner Member 1 · Status **built** · GitHub issue [#67](https://github.com/skarne21/Clipcademy/issues/67)

Acceptance criteria:

1. Five templates exist: `steps`, `compare`, `flow`, `term` and `myth_fact`, each with typed props and its own actions.
2. They reuse the existing guide, board, captions, cards and theme, at 720×1280 with the same safe zones.
3. Prop text has length limits so nothing overflows the board; over-limit text is rejected, not shrunk.
4. A rendered frame of every template shows the board content inside the board.

Evidence: video/course/test_templates.py; video/course/test_course_layout.py

### US-28: Check every generated clip before it is voiced

> As a teacher, I want every generated clip checked before any voice credits are spent, so that broken clips are fixed or dropped automatically instead of failing at render time.

Requirement R8 · Hypotheses H2 · Owner Member 1 · Status **built** · GitHub issue [#68](https://github.com/skarne21/Clipcademy/issues/68)

Acceptance criteria:

1. A clip is rejected if its template, a prop, an action or a target is unknown, or prop text is over its limit.
2. A clip is rejected if a beat cue is missing from the narration or out of order, or the first beat is not "^".
3. A clip is rejected if the narration is outside 45–70 words or doesn't end with the required last line.
4. A rejected clip is sent back to Gemini once with the exact errors; if it still fails, it is skipped and reported.

Evidence: video/course/test_templates.py; video/course/test_generate.py

### US-29: New course clips stay separate and wait for review

> As a content reviewer, I want generated course clips kept apart from the existing clips and marked pending, so that nothing reaches students unreviewed and the 35 approved-track clips never change.

Requirement R8 · Hypotheses H2 · Owner Member 1 · Status **built** · GitHub issue [#69](https://github.com/skarne21/Clipcademy/issues/69)

Acceptance criteria:

1. Every generated script is saved with `review_status: "pending"` under `video/courses/<course>/scripts/`.
2. Rendered course clips go to `video/courses/<course>/media/` with a manifest and their own fingerprint.
3. The existing 35 clips keep their fingerprints: no file counted in `render._code_files()` is changed.
4. No Gemini call happens during a student session; generation is an offline command.

Evidence: video/course/test_isolation.py

### US-30: Create a course and upload my notes

> As a teacher, I want to create a course and upload my notes from a web page, so that I don't need the command line to get clips.

Requirement R8 · Hypotheses H2 · Owner Member 1 · Status **built** · GitHub issue [#70](https://github.com/skarne21/Clipcademy/issues/70)

Acceptance criteria:

1. `teach.html` asks for the teacher password once (`CLIPCADEMY_TEACHER_TOKEN`); every teacher request without it gets 401.
2. Creating a course needs only a title; the server makes the course ID and a 6-character class code.
3. Uploads accept PDF, .txt and .md files up to 18 MB each; other types and larger files are refused with a clear message.
4. File names are reduced to a safe name, so an upload can never be written outside its course folder.

Evidence: learning/test_courses.py

### US-31: Clips are made in the background

> As a teacher, I want clip generation to run in the background after I press Generate, so that I can leave the page while Gemini, ElevenLabs and Remotion work.

Requirement R8 · Hypotheses H2 · Owner Member 1 · Status **built** · GitHub issue [#71](https://github.com/skarne21/Clipcademy/issues/71)

Acceptance criteria:

1. Generate queues one job per course (409 if one is already queued or running) and returns at once.
2. A worker thread runs the job: Gemini clip scripts, quiz questions, then one render per clip.
3. The job shows its stage and progress (e.g. "rendering 2 of 5"), then done or failed with a plain message.
4. A missing Gemini or ElevenLabs key fails the job with a message naming the key, without crashing the server.
5. Regenerating keeps approved clips and questions and replaces everything not yet approved.

Evidence: learning/test_courses.py

### US-32: Quiz questions for any course

> As a student, I want practice questions for each part of my course, so that I recall the idea instead of only watching.

Requirement R8 · Hypotheses H2 · Owner Member 1 · Status **built** · GitHub issue [#72](https://github.com/skarne21/Clipcademy/issues/72)

Acceptance criteria:

1. Gemini writes 2 multiple-choice questions per objective from that objective's source excerpts.
2. Each question has 2–4 choices, exactly one correct answer, feedback for every choice and source refs.
3. A question that fails the checks is sent back once with the errors, then skipped.
4. Questions are saved pending review, like clips.

Evidence: video/course/test_questions.py

### US-33: Review clips and questions before students see them

> As a teacher, I want to watch every generated clip and read every question, then approve or reject each one, so that only content I trust reaches my students.

Requirement R8 · Hypotheses H2 · Owner Member 1 · Status **built** · GitHub issue [#73](https://github.com/skarne21/Clipcademy/issues/73)

Acceptance criteria:

1. The course page lists every clip with a preview, its narration, source refs and review notes, and every question with its answer and feedback.
2. Approve or reject (with an optional note) changes the item's status; approving a newer version of a clip replaces the older one.
3. Pending clips play only through an unguessable preview link; nothing pending appears to students.

Evidence: learning/test_courses.py

### US-34: Join a class and practise

> As a student, I want to join my class with a code, watch its clips and answer its questions, so that I can review my course on my phone.

Requirement R8 · Hypotheses H1, H2 · Owner Member 3 · Status **built** · GitHub issue [#74](https://github.com/skarne21/Clipcademy/issues/74)

Acceptance criteria:

1. `class.html` takes a class code (or reads it from the share link) and lists the course's topics.
2. Each topic plays its approved clips in a vertical feed, then asks its approved questions one at a time.
3. An answer is graded on the server and shows that choice's feedback; an unknown code shows a clear message.
4. Approved clip files are served with byte ranges so videos can seek on phones.

Evidence: learning/test_courses.py; browser check

### US-35: Run the whole app from one container

> As a team member, I want one Docker image that serves the pages, the API, the worker and the videos, so that deploying means setting the keys and nothing else.

Requirement R8 · Hypotheses H1 · Owner Member 1 · Status **built** · GitHub issue [#75](https://github.com/skarne21/Clipcademy/issues/75)

Acceptance criteria:

1. `learning/server.py` serves the built web pages, the existing biology API and video, and the course API from one port.
2. The Dockerfile installs Python, Node, Remotion's browser and the built web app; data lives under `CLIPCADEMY_DATA` (a mounted disk).
3. Configuration is environment variables only: GEMINI_API_KEY, ELEVENLABS_API_KEY, CLIPCADEMY_TEACHER_TOKEN (and optional GEMINI_MODEL, PORT).
4. DEPLOY.md gives the exact commands to run it locally and on a container host.

Evidence: learning/test_server.py; docker build

### US-36: Clip generation uses a Gemini model that still exists

> As a teacher, I want generation to keep working when Google retires a Gemini model, so that my uploaded notes still become clips and questions.

Requirement R8 · Hypotheses H2 · Owner Member 1 · Status **in progress** · GitHub issue [#76](https://github.com/skarne21/Clipcademy/issues/76)

Acceptance criteria:

1. With no `GEMINI_MODEL` set, the pipeline calls `gemini-pro-latest`, Google's alias for its newest Pro model (the old default `gemini-2.5-pro` is refused for new keys).
2. Setting `GEMINI_MODEL` still picks a specific model.
3. DEPLOY.md and video/course/README.md name the new default.
4. A live call through `video/course/gemini.py` with the default model returns JSON.

Evidence: video/course/test_generate.py GeminiClient; live call

### US-37: Keys from a .env file work in Docker

> As a team member, I want to pass `video/.env` to the container with `--env-file`, even when its values are in quotes, so that the keys I already use locally work in the container without editing them.

Requirement R8 · Hypotheses H1 · Owner Member 1 · Status **in progress** · GitHub issue [#77](https://github.com/skarne21/Clipcademy/issues/77)

Acceptance criteria:

1. A quoted value in the environment (`KEY="..."`, as `docker run --env-file` passes it) is used without its quotes for GEMINI_API_KEY, ELEVENLABS_API_KEY and CLIPCADEMY_TEACHER_TOKEN.
2. DEPLOY.md's local run uses `--env-file video/.env`, with CLIPCADEMY_TEACHER_TOKEN in that file.

Evidence: video/course/test_generate.py; video/test_tts.py; learning/test_server.py

### US-38: Approved clips stay approved on a Windows checkout

> As a content reviewer, I want the 35 approved clips to keep matching their fingerprints on any operating system, so that a Windows checkout or a Docker image built from one doesn't treat every clip as unreviewed.

Requirement R5 · Hypotheses H2 · Owner Member 1 · Status **in progress** · GitHub issue [#78](https://github.com/skarne21/Clipcademy/issues/78)

Acceptance criteria:

1. Every file the clip fingerprints hash (video/*.py, video/course/*.py, video/remotion/src, video/remotion/course, video/remotion/package.json) is checked out with LF line endings on every OS.
2. With `core.autocrlf=true`, all 35 existing clips still match their rendered files.

Evidence: .gitattributes; video/course/test_isolation.py

### US-39: Run the course platform on localhost

> As a teacher, I want to run the whole course platform on my own computer, so that we can use it before paying for a host.

Requirement R8 · Hypotheses H1 · Owner Member 1 · Status **in progress** · GitHub issue [#79](https://github.com/skarne21/Clipcademy/issues/79)

Acceptance criteria:

1. `docker build` succeeds and `docker run` with `--env-file video/.env` serves http://localhost:8000.
2. /teach.html accepts the teacher password from `video/.env`.
3. Uploading a short notes file makes pending clips and questions with the real Gemini and ElevenLabs keys.
4. After a clip and question are approved, /class.html with the class code plays the clip and checks an answer.

Evidence: live run on localhost (see the issue comment)

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
| Course import: any class material to stick-figure clips via Gemini | US-24, US-25, US-26, US-27, US-28, US-29 |
| Course platform: teacher upload, background jobs, quiz questions, review, class code, one-container deploy | US-30, US-31, US-32, US-33, US-34, US-35 |
| Running the course platform locally: current Gemini model, .env keys in Docker, LF fingerprints | US-36, US-37, US-38, US-39 |

Totals: 8 requirements, 39 user stories (33 built, 5 in progress, 1 proposed), 143 acceptance criteria. One GitHub issue per story, labelled `user-story`, its area, its status, and its requirement.
