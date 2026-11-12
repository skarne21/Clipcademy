"""Alpha Activity 2 (Requirement Decomposition): one source for the requirements, user stories,
acceptance criteria, the written document, and the GitHub issues.

    python3 planning/user_stories.py              # write planning/USER_STORIES.md
    python3 planning/user_stories.py --issues     # also create the GitHub issues (needs `gh auth login`)

It reads, and never changes, the MVP hypothesis and validation work in Context/validation-plan.md:
each story names the hypothesis (H1 usability, H2 recall gain, H3 voluntary use) it serves.
Creating issues is idempotent: a story whose title already exists as an issue is skipped.
"""
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = 'skarne21/Clipcademy'

HYPOTHESES = {
    'H1': 'Usability: ≥ 5 of 6 finish the core flow on Day 0 without help',
    'H2': 'Recall gain: mean gain ≥ 2 scored questions and ≥ 4 of 6 improve',
    'H3': 'Voluntary use: ≥ 3 of 6 answer a question on a later day with no reminder',
}

# The subset of requirements that set Clipcademy apart, cover the MVP scope, and hold the AI integration.
REQUIREMENTS = [
    ('R1', 'Recall before explanation',
     'Students answer a question before seeing any explanation of it; no feedback appears before they commit. '
     'Study apps usually show content first; Clipcademy is built around retrieval practice.', ['H2'], False),
    ('R2', 'Misconception-targeted remediation by selection',
     'A wrong choice selects a pre-made follow-up clip aimed at that misconception, then a fresh retry question it has '
     'never shown. Missing the same idea again plays a second clip that explains it a different way (max 2 cycles).',
     ['H2'], False),
    ('R3', 'TikTok-style micro-lesson feed',
     '4–5 vertical 15–30 s clips per topic, one idea each, in a full-screen swipe feed that auto-advances, with '
     'hooks, captions and a guide character so students want to keep watching.', ['H1', 'H3'], False),
    ('R4', 'Core AI: neural narration that drives captions and animation',
     'ElevenLabs text-to-speech narrates every reviewed script and returns when each character is spoken. That timing '
     'drives the burned-in word-by-word captions and triggers every on-screen action at the exact spoken word.',
     ['H1', 'H3'], True),
    ('R5', 'Reviewed, sourced content only',
     'Every clip and question cites the lecture excerpt it comes from and must be approved by a course-knowledgeable '
     'reviewer; the server refuses any clip whose approved fingerprint does not match. Nothing is generated live.',
     ['H2'], False),
    ('R6', 'Built-in measurement of the hypotheses',
     'Every action is logged with participant code and build ID so H1–H3 and the engagement metrics '
     '(completion, drop-off, auto vs. manual swipes, time on app) can be computed from events.csv.',
     ['H1', 'H2', 'H3'], False),
    ('R7', 'Proposed AI: LLM-assisted script and question drafting, human-approved',
     'An LLM drafts clip scripts and questions offline from the lecture excerpts; a reviewer edits and approves them '
     'before anything is rendered or shown. No LLM output ever reaches a student unreviewed. Team_Spec lists this as a '
     'later step ("automatic script writing … after the reviewed flow works"); it needs a team decision.',
     ['H2'], True),
    ('R8', 'Any course becomes stick-figure clips',
     'An instructor imports a class\'s material (lecture PDFs or notes) and Gemini breaks it into short, source-linked '
     'stick-figure clips drawn with general-purpose scenes, so ClipCademy is not limited to the four biology topics. '
     'Generated clips and questions go straight to the class (the teacher can delete any), and the existing 35 clips are never changed.', ['H2'], True),
]

# (id, title, role, goal, benefit, requirement, hypotheses, area, owner, status, acceptance criteria, evidence)
STORIES = [
    ('US-01', 'Enter my participant code once', 'study participant', 'to enter my anonymous participant code the first '
     'time I open the app', 'my activity is linked to my code without giving any personal information', 'R6', ['H1'],
     'student', 'Member 3', 'built',
     ['The first open shows a participant-code screen; later opens skip it.',
      'Codes are trimmed and upper-cased (`  p01 ` becomes `P01`); an empty code shows an inline error and does not continue.',
      'The code is stored in the browser and sent with every event.',
      'Reset demo keeps the code.'],
     'web/e2e/run.mjs case 1'),
    ('US-02', 'Choose the topics on my exam', 'student', 'to pick which of the four lecture topics are on my exam',
     'my review only covers what I need', 'R3', ['H1'], 'student', 'Member 3', 'built',
     ['Four topic cards appear, one per lecture (19–22), without implying confirmed exam coverage.',
      'Topics not yet approved show "Coming soon": they can be selected but never started.',
      'Selections are saved and survive a refresh.'],
     'web/e2e/run.mjs case 2'),
    ('US-03', 'See my progress on the home screen', 'student', 'to see each topic as not started, in progress, '
     'complete, needs review or coming soon', 'I know where to pick up', 'R1', ['H1', 'H3'], 'student', 'Member 3', 'built',
     ['Each selected topic shows exactly one state: Not started, In progress, Complete, Needs review or Coming soon.',
      'In progress offers Resume at the saved step; Complete offers the summary and Restart.',
      'States match what the server returned for each attempt.'],
     'web/e2e/run.mjs cases 3–6'),
    ('US-04', 'Swipe through short intro clips', 'student', 'to swipe through 4–5 short vertical clips before the quiz',
     'I learn one idea at a time in a format I already use', 'R3', ['H1', 'H3'], 'student', 'Member 3', 'built',
     ['The lesson plays the topic\'s `intro_video_requests` in order, full screen at 9:16.',
      'Swiping up shows the next clip and swiping down the previous one; a "Clip n of N" progress bar is always visible.',
      'Clips autoplay muted; one tap turns sound on for the rest of the feed.',
      'The next clip preloads, so no spinner appears between clips.',
      'A "Swipe up" hint shows on the first clip only.',
      'Swiping past the last clip opens the first question.'],
     'web/e2e/run.mjs case 17'),
    ('US-05', 'Clips move on by themselves', 'student', 'the feed to move to the next clip when one finishes',
     'I can keep learning hands-free and still swipe whenever I want', 'R3', ['H1', 'H3'], 'student', 'Member 3', 'built',
     ['About 0.6 s after a clip ends, the feed scrolls to the next slide (instantly with reduced motion).',
      'It does not advance if the student already swiped, paused the clip, or has the transcript open.',
      'After the last intro clip the question opens; after a follow-up clip the retry question opens.',
      'Manual swipes up and down keep working at any time.',
      'The move is logged as `clip_swiped` with `direction: "auto"`, separate from real swipes.'],
     'web/e2e/run.mjs playback case; web/e2e/video-flow.mjs (1280 px and 390 px)'),
    ('US-06', 'Read along with captions and a transcript', 'student', 'large captions that follow the narration and a '
     'transcript I can open', 'I can follow without sound and review the exact words', 'R4', ['H1'], 'student',
     'Member 1 + Member 3', 'built',
     ['Every clip has burned-in captions of 1–3 words with the word being spoken highlighted, timed from the narration.',
      'Each clip also ships a `.vtt` track and a `.txt` transcript identical to the narration.',
      'A Captions button toggles the track; a Transcript button pauses the clip and shows the full text.',
      'Captions stay inside y = 760–1000 and clear of the app\'s top, right and bottom safe zones.'],
     'video/check_assets.py; web/e2e/run.mjs playback case'),
    ('US-07', 'Answer before I see the explanation', 'student', 'to answer each question before any explanation is shown',
     'I practise recalling the idea instead of recognising it', 'R1', ['H2'], 'student', 'Member 2 + Member 3', 'built',
     ['The question response contains no correct answer, feedback or misconception; nothing explanatory shows before Submit.',
      'Submit is disabled until a choice is picked and while the attempt is being sent.',
      'A double tap sends exactly one attempt.',
      'Feedback appears only after the server grades the attempt.'],
     'web/e2e/run.mjs cases 8 and 14; learning/test_app.py'),
    ('US-08', 'Get a clip aimed at my mistake', 'student', 'a wrong answer to play a short clip about the exact idea I '
     'missed, then a new question', 'I fix the misconception right away', 'R2', ['H2'], 'student', 'Member 2 + Member 1',
     'built',
     ['A wrong choice shows feedback for that choice and maps to a misconception (e.g. `growth_direction`, `primer_requirement`).',
      'The app then plays that misconception\'s v1 follow-up clip in the same feed player.',
      'After the clip, a retry question the student has never seen is shown; no retry question is ever shown twice.',
      'Every follow-up clip exists for all four topics (16 follow-ups) and returns `ready`.'],
     'video/test_integration.py; learning/test_grading.py'),
    ('US-09', 'Get a different explanation if I miss it again', 'student', 'a second, differently explained clip if I '
     'miss the same idea twice', 'a new angle can work where the first one did not', 'R2', ['H2'], 'student',
     'Member 2 + Member 1', 'built',
     ['A second miss on the same misconception plays its v2 clip (`<misconception>_followup_2`), which uses a different '
      'diagram or approach from v1, then another fresh retry.',
      'After two follow-up cycles the reviewed explanation shows, the objective is marked Needs review, and another topic or Restart is offered.'],
     'learning/test_grading.py; video/scripts/*_followup_2.json'),
    ('US-10', 'Prove I remember the required questions', 'student', 'a required question I missed to come back after '
     'its follow-up', 'the topic only counts as complete once I can recall it', 'R1', ['H2'], 'student', 'Member 2', 'built',
     ['A missed required question returns once after its follow-up; it is the only question that ever repeats.',
      'The objective is Complete only when every required question has been answered correctly.'],
     'learning/test_grading.py'),
    ('US-11', 'Pick up where I left off', 'student', 'a refresh or reopen to bring me back to the same step and clip',
     'I never lose progress', 'R3', ['H1', 'H3'], 'student', 'Member 3', 'built',
     ['A refresh on a clip, question, feedback or summary returns to the same screen.',
      'A refresh mid-feed returns to the same clip and sends no extra swipe event.',
      'A video job in progress keeps polling the saved job instead of starting a new one.'],
     'web/e2e/run.mjs cases 6 and 17'),
    ('US-12', 'Retry a clip that fails to load', 'student', 'a clear message and a Retry button when a clip cannot load',
     'a network problem never loses my answer', 'R3', ['H1'], 'student', 'Member 3 + Member 1', 'built',
     ['A failed or missing clip shows "The clip couldn\'t load." with Retry; a follow-up adds "Your answer is saved."',
      'Retry starts a new video job; the saved answer and progress are unchanged.',
      'A failed job response has a plain `error` and no playable URL.'],
     'web/e2e/run.mjs case 9; video/test_jobs.py; video/samples/failed.json'),
    ('US-13', 'Narrate every script with an AI voice that reports its timing', 'content creator', 'each reviewed script '
     'narrated by ElevenLabs with per-character timestamps', 'clips sound natural and every caption and animation lands '
     'on the spoken word', 'R4', ['H1', 'H3'], 'ai', 'Member 1', 'built',
     ['`video/tts.py` calls the ElevenLabs with-timestamps endpoint for the exact narration text and maps the character timings onto words.',
      'Audio is cached by text, voice and settings, so re-rendering spends no credits unless the narration changes.',
      'The API key is read from git-ignored `video/.env`, needs only Text to Speech and Voices read, and is never logged.',
      'Each manifest records the synthetic voice used.',
      'Narration runs at about 150–170 words a minute (open, deferred: measured 138–189 wpm; not enforced by a test, see planning/TDD_LOG.md).',
      'An offline draft voice gets a different fingerprint, so a draft can never pass as an approved clip.'],
     'video/tts.py; video/media/*.json (narration field)'),
    ('US-14', 'Time every animation to the narration', 'content creator', 'on-screen actions triggered by the words they '
     'illustrate, with a hook from the first frame', 'clips keep attention and stay clear', 'R4', ['H1', 'H3'], 'ai',
     'Member 1', 'built',
     ['Each script lists beats (spoken cue → actions); `video/beats.py` resolves each cue to the time the word is spoken.',
      'The hook text is on screen from frame 1 and the first on-screen change happens within 2 s.',
      'A render fails if a clip is outside 15–30 s or has more than 3 s with no on-screen change.',
      'Sound effects (pop, click, whoosh) fire on the same beats; every clip opens with the same 1-second sting.'],
     'video/test_beats.py; video/render.py guards'),
    ('US-15', 'Show each process as an animated diagram', 'student', 'a stick-figure guide and animated diagrams of each '
     'process', 'I can see how the biology works, not just hear it', 'R3', ['H2'], 'content', 'Member 1', 'built',
     ['The same guide character appears in every clip and points at what the narration names.',
      'Replication, repair, transcription, translation and timeline diagrams animate the step being explained '
      '(e.g. pieces joining the 3′ end, UV bond and bulge, RNA built on the template strand, tRNA from A to P to E).',
      'All 35 clips are 720×1280 H.264 + AAC and keep the app\'s safe zones clear.'],
     'video/check_assets.py; video/remotion/src/scenes/'),
    ('US-16', 'Write every script from the lecture sources', 'content creator', 'every clip script built from the '
     'packet\'s source excerpts with its hook claim and analogy listed', 'a reviewer can check each claim quickly',
     'R5', ['H2'], 'content', 'Member 1 + Member 2', 'built',
     ['Every script cites its packet `source_refs`; its teaching goal is read from the packet, not retyped.',
      'Intro clips end on the teaching goal sentence plus a swipe teaser; the last intro ends with "Let\'s see what you remember."',
      'Each script records `hook_claim`, `analogy` and `new_term` for the reviewer.',
      '`video/SCRIPTS_FOR_REVIEW.md` lists every narration with those notes.'],
     'video/write_scripts.py; video/SCRIPTS_FOR_REVIEW.md'),
    ('US-17', 'Serve only approved, pre-rendered clips', 'student', 'every clip to come from an approved, pre-rendered '
     'file', 'I only see checked content and it loads fast on the free host', 'R5', ['H1', 'H2'], 'content', 'Member 1',
     'built',
     ['`POST /video-jobs` accepts only catalog variants and returns `ready` with `video_url`, `captions_url`, transcript, duration, `width` and `height`.',
      'Without preview mode, a clip plays only if its audit row is approved with a matching fingerprint; otherwise `403`.',
      'The host never renders video; repeated requests reuse the same job (`cache_hit`).'],
     'video/test_jobs.py; video/test_integration.py'),
    ('US-18', 'Approve content before release', 'content reviewer', 'a checklist row for every clip, question, feedback '
     'line and test item, with source, analogy and hook checks', 'nothing wrong or unsourced reaches students', 'R5',
     ['H2'], 'review', 'Member 2', 'built',
     ['`Context/content-audit.csv` has one row per item, including all 35 clips with `analogy_ok` and `hook_in_sources`.',
      '`python learning/check_content.py --freeze` fails while any available item is unapproved or a clip fingerprint does not match.',
      'A topic that is not fully approved stays Coming soon in the frozen build.'],
     'learning/test_check_content.py'),
    ('US-19', 'Log every action for the study', 'study researcher', 'every student action stored with participant code, '
     'build ID and device time', 'H1–H3 can be computed from real use', 'R6', ['H1', 'H2', 'H3'], 'research',
     'Member 2 + Member 3', 'built',
     ['Every action in Team_Spec\'s activity events sends one event to `POST /events`; failed sends retry with the same `event_id` and never block the student.',
      '`GET /events.csv` with the admin token exports every event with `build_id_status` (ok, missing or unknown).',
      'A duplicate `event_id` is stored once.'],
     'learning/test_app.py; web/e2e/run.mjs'),
    ('US-20', 'Measure engagement with the feed', 'study researcher', 'per-clip starts, completions, swipes (manual or '
     'automatic) and visible time on app', 'we can see where students drop off and whether they come back', 'R6',
     ['H1', 'H3'], 'research', 'Member 3 + Member 2', 'built',
     ['`video_started` and `video_completed` are sent once per time a clip is on screen.',
      '`clip_swiped` records `variant_id`, `direction` (up, down or auto) and `seconds_watched`.',
      'A `heartbeat` is sent every 30 s only while the app is visible, carrying leftover seconds across a refresh.'],
     'web/e2e/heartbeat.mjs; learning/test_app.py test_clip_swiped'),
    ('US-21', 'Use the app on my phone from one link', 'study participant', 'to open the study build on my own phone '
     'from one web address', 'I can use it whenever I choose during Days 0–2', 'R3', ['H1', 'H3'], 'hosting',
     'Member 2', 'in progress',
     ['https://clipcademy.pythonanywhere.com serves the app at `/`, the API, and clips at `/media/` from one origin.',
      'The frozen build ID (`study-4`) is in the app and on the server; preview mode is off for participants.',
      'The full flow is checked on iOS Safari and Android Chrome: inline playback, captions, nothing overlapping.',
      'The web app is extended to run through Day 2.'],
     'Member2_SPEC.md Deploying; web/e2e/video-flow.mjs at 390 px'),
    ('US-22', 'Reset the demo between sessions', 'study moderator', 'a Reset demo control that clears progress but keeps '
     'the participant code', 'each observed session starts clean', 'R6', ['H1'], 'student', 'Member 3', 'built',
     ['Reset demo needs a second tap ("Tap again to clear all progress") so it can\'t be hit by accident.',
      'It clears selected topics and every objective\'s attempts, remediation state, step and video jobs.',
      'It keeps the participant code and any events not yet sent, and logs a `demo_reset` event.'],
     'web/src/store.js resetDemo; web/src/main.js'),
    ('US-23', 'Draft scripts and questions with an LLM, then review them', 'content creator', 'an LLM to draft clip '
     'scripts and practice questions from the lecture excerpts', 'we can cover more topics faster while every item is '
     'still human-approved', 'R7', ['H2'], 'ai', 'Member 1 + Member 2', 'proposed',
     ['Drafting runs offline from the packet\'s `source_excerpts` only; every claim in a draft names the excerpt it came from.',
      'Drafts are saved as `review_status: pending` and cannot be rendered for students or served until a reviewer approves them.',
      'No LLM call happens during a student session; the app still only selects pre-approved items.',
      'The reviewer can see which parts were LLM-drafted and what they changed.',
      'Team decision recorded before work starts, since Team_Spec defers LLM generation to after the reviewed flow works.'],
     'Team_Spec.md (Member 1 section) and Scope'),
    ('US-24', 'Import a class\'s material', 'teacher', 'to import my class\'s lecture PDFs, slides exported as PDF, '
     'or notes for a new course', 'ClipCademy can turn any of my classes into review clips', 'R8', ['H2'], 'ai', 'Member 1',
     'built',
     ['`python video/course/generate.py --course <id> --material <file> ...` accepts PDF, .txt and .md files.',
      'A course ID is lowercase letters, digits and underscores; anything else is rejected before any API call.',
      'Imported files are copied to `video/courses/<course>/material/`, and nothing is written outside `video/courses/<course>/`.',
      'A missing `GEMINI_API_KEY` (environment or `video/.env`) stops the run with a clear message before any upload.'],
     'video/course/test_generate.py'),
    ('US-25', 'Gemini breaks the material into clip plans', 'teacher', 'Gemini to break my material into learning '
     'objectives and a plan of short clips with source quotes', 'each clip teaches one idea that is traceable to my material',
     'R8', ['H2'], 'ai', 'Member 1', 'built',
     ['The material is sent to Gemini as file data (PDF) or text, with JSON output requested.',
      'The breakdown returns objectives, each with verbatim source excerpts, 3–6 clips and a one-sentence teaching goal per clip.',
      'For text material, every excerpt must appear verbatim in the material; a clip whose excerpts don\'t is dropped and reported.',
      'The breakdown is saved as `video/courses/<course>/breakdown.json`.'],
     'video/course/test_generate.py'),
    ('US-26', 'Gemini storyboards each clip for the stick figure', 'teacher', 'Gemini to write each clip\'s narration and '
     'animation cues using only the general-purpose stick-figure scenes', 'the renderer can draw a clip for any subject',
     'R8', ['H2'], 'ai', 'Member 1', 'built',
     ['Each clip is one scene that uses one template from the course scene catalog, with its props and beats.',
      'The prompt includes the writing rules (hook, one idea, one analogy, 45–70 words, ending line) and the full catalog.',
      'The saved script records `course_id`, `teaching_goal` and `source_refs`.'],
     'video/course/test_generate.py'),
    ('US-27', 'General-purpose stick-figure scenes for any subject', 'student', 'clips in any course to look and move like '
     'the biology clips', 'every class gets the same friendly, readable format', 'R8', ['H1', 'H2'], 'content', 'Member 1',
     'built',
     ['Five templates exist: `steps`, `compare`, `flow`, `term` and `myth_fact`, each with typed props and its own actions.',
      'They reuse the existing guide, board, captions, cards and theme, at 720×1280 with the same safe zones.',
      'Prop text has length limits so nothing overflows the board; over-limit text is rejected, not shrunk.',
      'A rendered frame of every template shows the board content inside the board.'],
     'video/course/test_templates.py; video/course/test_course_layout.py'),
    ('US-28', 'Check every generated clip before it is voiced', 'teacher', 'every generated clip checked before any '
     'voice credits are spent', 'broken clips are fixed or dropped automatically instead of failing at render time', 'R8',
     ['H2'], 'ai', 'Member 1', 'built',
     ['A clip is rejected if its template, a prop, an action or a target is unknown, or prop text is over its limit.',
      'A clip is rejected if a beat cue is missing from the narration or out of order, or the first beat is not "^".',
      'A clip is rejected if the narration is outside 45–70 words or doesn\'t end with the required last line.',
      'A rejected clip is sent back to Gemini once with the exact errors; if it still fails, it is skipped and reported.'],
     'video/course/test_templates.py; video/course/test_generate.py'),
    ('US-29', 'New course clips stay separate from the biology clips', 'team member', 'generated course clips kept '
     'apart from the existing clips', 'the 35 biology clips never change', 'R8', ['H2'], 'content', 'Member 1', 'built',
     ['Every generated script is saved under `video/courses/<course>/scripts/`.',
      'Rendered course clips go to `video/courses/<course>/media/` with a manifest and their own fingerprint.',
      'The existing 35 clips keep their fingerprints: no file counted in `render._code_files()` is changed.',
      'No Gemini call happens during a student session; generation is an offline command.'],
     'video/course/test_isolation.py'),
    ('US-30', 'Create a course and upload my notes', 'teacher', 'to create a course and upload my notes from a web page',
     'I don\'t need the command line to get clips', 'R8', ['H2'], 'hosting', 'Member 1', 'built',
     ['`teach.html` asks for the teacher password once (`CLIPCADEMY_TEACHER_TOKEN`); every teacher request without it gets 401.',
      'Creating a course needs only a title; the server makes the course ID and a 6-character class code.',
      'Uploads accept PDF, .txt and .md files up to 18 MB each; other types and larger files are refused with a clear message.',
      'File names are reduced to a safe name, so an upload can never be written outside its course folder.'],
     'learning/test_courses.py'),
    ('US-31', 'Clips are made in the background', 'teacher', 'clip generation to run in the background after I press '
     'Generate', 'I can leave the page while Gemini, ElevenLabs and Remotion work', 'R8', ['H2'], 'hosting', 'Member 1',
     'built',
     ['Generate queues one job per course (409 if one is already queued or running) and returns at once.',
      'A worker thread runs the job: Gemini clip scripts, quiz questions, then one render per clip.',
      'The job shows its stage and progress (e.g. "rendering 2 of 5"), then done or failed with a plain message.',
      'A missing Gemini or ElevenLabs key fails the job with a message naming the key, without crashing the server.',
      'Regenerating replaces the course\'s clips and questions.'],
     'learning/test_courses.py'),
    ('US-32', 'Quiz questions for any course', 'student', 'practice questions for each part of my course',
     'I recall the idea instead of only watching', 'R8', ['H2'], 'ai', 'Member 1', 'built',
     ['Gemini writes 2 multiple-choice questions per objective from that objective\'s source excerpts.',
      'Each question has 2–4 choices, exactly one correct answer, feedback for every choice and source refs.',
      'A question that fails the checks is sent back once with the errors, then skipped.',
      'Questions are saved with the course and go to the class with its clips.'],
     'video/course/test_questions.py'),
    ('US-33', 'See every clip and question my class gets', 'teacher', 'to watch every generated clip and read '
     'every question', 'I know what my students will see', 'R8', ['H2'], 'review', 'Member 1', 'built',
     ['The course page lists every clip with its video, narration and source refs, and every question with its answer and feedback.',
      'Clips are grouped by objective.'],
     'learning/test_courses.py'),
    ('US-34', 'Join a class and practise', 'student', 'to join my class with a code, watch its clips and answer its '
     'questions', 'I can review my course on my phone', 'R8', ['H1', 'H2'], 'student', 'Member 3', 'built',
     ['`class.html` takes a class code (or reads it from the share link) and lists the course\'s topics.',
      'Each topic plays its clips in a vertical feed, then asks its questions one at a time.',
      'An answer is graded on the server and shows that choice\'s feedback; an unknown code shows a clear message.',
      'Clip files are served with byte ranges so videos can seek on phones.'],
     'learning/test_courses.py; browser check'),
    ('US-35', 'Run the whole app from one container', 'team member', 'one Docker image that serves the pages, the API, '
     'the worker and the videos', 'deploying means setting the keys and nothing else', 'R8', ['H1'], 'hosting',
     'Member 1', 'built',
     ['`learning/server.py` serves the built web pages, the existing biology API and video, and the course API from one port.',
      'The Dockerfile installs Python, Node, Remotion\'s browser and the built web app; data lives under `CLIPCADEMY_DATA` (a mounted disk).',
      'Configuration is environment variables only: GEMINI_API_KEY, ELEVENLABS_API_KEY, CLIPCADEMY_TEACHER_TOKEN (and optional GEMINI_MODEL, PORT).',
      'DEPLOY.md gives the exact commands to run it locally and on a container host.'],
     'learning/test_server.py; docker build'),
    ('US-36', 'Clip generation uses a Gemini model that still exists', 'teacher', 'generation to keep working when '
     'Google retires a Gemini model', 'my uploaded notes still become clips and questions', 'R8', ['H2'], 'ai',
     'Member 1', 'built',
     ['With no `GEMINI_MODEL` set, the pipeline calls `gemini-pro-latest`, Google\'s alias for its newest Pro model '
      '(the old default `gemini-2.5-pro` is refused for new keys).',
      'Setting `GEMINI_MODEL` still picks a specific model.',
      'DEPLOY.md and video/course/README.md name the new default.',
      'A live call through `video/course/gemini.py` with the default model returns JSON.'],
     'video/course/test_generate.py GeminiClient; live call'),
    ('US-37', 'Keys from a .env file work in Docker', 'team member', 'to pass `video/.env` to the container with '
     '`--env-file`, even when its values are in quotes', 'the keys I already use locally work in the container '
     'without editing them', 'R8', ['H1'], 'hosting', 'Member 1', 'built',
     ['A quoted value in the environment (`KEY="..."`, as `docker run --env-file` passes it) is used without its quotes '
      'for GEMINI_API_KEY, ELEVENLABS_API_KEY and CLIPCADEMY_TEACHER_TOKEN.',
      'DEPLOY.md\'s local run uses `--env-file video/.env`, with CLIPCADEMY_TEACHER_TOKEN in that file.'],
     'video/course/test_generate.py; video/test_tts.py; learning/test_server.py'),
    ('US-38', 'Approved clips stay approved on a Windows checkout', 'content reviewer', 'the 35 approved clips to '
     'keep matching their fingerprints on any operating system', 'a Windows checkout or a Docker image built from '
     'one doesn\'t treat every clip as unreviewed', 'R5', ['H2'], 'content', 'Member 1', 'built',
     ['Every file the clip fingerprints hash (video/*.py, video/course/*.py, video/remotion/src, video/remotion/course, '
      'video/remotion/package.json) is checked out with LF line endings on every OS.',
      'In the Docker image built from a `core.autocrlf=true` Windows checkout, all 35 existing clips still match their '
      'rendered files. (Native Windows still differs: `sorted()` orders paths case-insensitively there, and fixing that '
      'means editing render.py, which is itself fingerprinted, so every approval would be lost.)'],
     '.gitattributes; video/course/test_isolation.py run inside the container'),
    ('US-39', 'Run the course platform on localhost', 'teacher', 'to run the whole course platform on my own '
     'computer', 'we can use it before paying for a host', 'R8', ['H1'], 'hosting', 'Member 1', 'built',
     ['`docker build` succeeds and `docker run` with `--env-file video/.env` serves http://localhost:8000.',
      '/teach.html accepts the teacher password from `video/.env`.',
      'Uploading a short notes file makes pending clips and questions with the real Gemini and ElevenLabs keys.',
      '/class.html with the class code plays a clip and grades an answer.'],
     'live run on localhost (see the issue comment)'),
    ('US-40', 'Follow-up clips for each common mistake', 'student', 'every topic in my class to come with short clips '
     'aimed at the two mistakes students make most', 'a wrong answer shows me what I got wrong, as in the biology app',
     'R8', ['H2'], 'ai', 'Member 1', 'built',
     ['Gemini names exactly 2 misconceptions per objective, each backed by the objective\'s source excerpts.',
      'Each misconception gets a `<misconception>_followup` clip and a `<misconception>_followup_2` clip that explains '
      'the same idea a different way (another template or analogy); both end with "Now try the question again."',
      'Follow-up clips are checked, retried once and rendered like the intro clips.'],
     'video/course/test_generate.py'),
    ('US-41', 'Retry questions tied to each mistake', 'student', 'every wrong choice to point at the mistake behind it, '
     'and a fresh question for each mistake', 'I prove I recalled the idea instead of guessing the same question again',
     'R8', ['H2'], 'ai', 'Member 1', 'built',
     ['Every wrong choice of a required question names one of the objective\'s 2 misconceptions.',
      'Each misconception gets 2 retry questions that are not the required questions, so a retry is never shown twice.',
      'Each retry counts for the required question whose wrong choice leads to its misconception, as in the MVP\'s answer key.'],
     'video/course/test_questions.py'),
    ('US-42', 'A wrong answer leads to a follow-up clip and a new question', 'student', 'a wrong answer to play the '
     'follow-up clip for my mistake and then a new question, with a differently explained clip if I miss it again',
     'my class works like the biology app', 'R8', ['H1', 'H2'], 'student', 'Member 1', 'built',
     ['Answers are graded by the MVP\'s rules (learning/grading.py): continue, review again, complete or needs review.',
      'Wrong once on a mistake plays its v1 clip, then its first retry; wrong again plays its v2 clip, then the second retry.',
      'At most 2 follow-up cycles per objective; then the summary shows the feedback and the intro clips\' teaching goals '
      'as "Go over these" points.',
      'A follow-up clip that is missing (deleted or failed to render) is skipped and the retry question still follows.'],
     'learning/test_courses.py; learning/test_grading.py'),
    ('US-43', 'My class progress survives a refresh', 'student', 'my place in each topic saved in this browser',
     'a refresh or closed tab doesn\'t make me start over', 'R8', ['H1'], 'student', 'Member 1', 'built',
     ['Each objective\'s step, follow-up cycles and answered questions are saved in localStorage per class code.',
      'Reopening the class resumes at the saved step; a finished topic offers Restart.'],
     'web/src/platform/class.js; browser check'),
    ('US-44', 'Clips reach students without a review step', 'teacher', 'generated clips and questions to go straight '
     'to my class, with a way to delete a bad one', 'students can start as soon as generation finishes', 'R8', ['H1'],
     'review', 'Member 1', 'built',
     ['Generated clips and questions are live for the class as soon as the job finishes; there is no approve/reject step '
      'or preview link on the course platform.',
      'The teacher page lists every clip and question, and Delete removes one from the class.',
      'Generating again replaces the course\'s clips and questions.',
      'The course platform\'s docs and user stories no longer describe a review step (the biology study\'s content audit is unchanged).'],
     'learning/test_courses.py; web/src/platform/teach.js'),
    ('US-45', 'Objectives in the same topic keep their own clips', 'student', 'every objective in my class to have '
     'its own clips, even when two objectives share a topic', 'no topic shows another topic\'s clips twice',
     'R8', ['H1'], 'content', 'Member 1', 'built',
     ['Clip scripts are saved per objective (`<topic>.<objective>.<variant>.json`), so two objectives with the same '
      'topic_id and variant_id never overwrite each other.',
      'Each generated clip is listed once, under its own objective.'],
     'video/course/test_generate.py; live run on localhost (osmosis notes made 7 clips for one objective and none for the other)'),
    ('US-46', 'Clips are made faster and show their progress', 'teacher', 'clip generation to finish in minutes and '
     'show what it is doing', 'I can tell it is working and do not wait half an hour', 'R8', ['H1'], 'ai', 'Member 1',
     'built',
     ['Clip scripts are written up to 4 at a time; a v2 follow-up still waits for its v1 so it can explain it differently.',
      'Quiz questions are written for up to 4 topics at a time.',
      'The job stage shows "Writing clip N of M" while scripts are written and "Writing questions for topic N of M" after.',
      'The saved scripts and report list clips in the same order as before, whatever order they finish in.'],
     'video/course/test_generate.py; video/course/test_questions.py; learning/test_courses.py; live run (2 PDFs took 22 min to script before)'),
    ('US-47', 'See how my notes were broken into topics', 'teacher', 'to see the topics Gemini found in my notes, '
     'with the quotes, planned clips and common mistakes for each', 'I can check the breakdown while the clips are made',
     'R8', ['H2'], 'ai', 'Member 1', 'built',
     ['The breakdown is saved as soon as Gemini returns it, before any clip script is written.',
      'The teacher course API returns each topic with its label, source quotes, planned intro clips (teaching goals) and 2 mistakes.',
      'The teacher page shows these topics while clips are being made and after.'],
     'video/course/test_generate.py; learning/test_courses.py; browser check on localhost'),
    ('US-48', 'One home page to join a class or sign in as a teacher', 'student or teacher', 'the home page to let '
     'me type a class code or the teacher password', 'I get to my class or the teacher page without knowing its address',
     'R8', ['H1'], 'student', 'Member 1', 'built',
     ['`/` shows two short forms: Join a class (6-character class code) and Teacher sign in (teacher password).',
      'A class code that exists opens that class (`/class.html#CODE`); an unknown one shows a clear message and stays put.',
      'A correct teacher password opens the teacher page already signed in; a wrong one shows a clear message.',
      'The biology study app moves to `/index.html`, linked from the home page; the PythonAnywhere study build is unchanged.'],
     'learning/test_server.py; web/e2e/home.mjs'),
]

AREA_LABELS = {'student': 'area: student app', 'ai': 'area: AI', 'content': 'area: content & video',
               'review': 'area: content review', 'research': 'area: study data', 'hosting': 'area: hosting'}
STATUS_LABELS = {'built': 'status: built in Alpha', 'in progress': 'status: in progress', 'proposed': 'status: proposed'}


def story_text(s):
    sid, title, role, goal, benefit, req, hyps, area, owner, status, ac, evidence = s
    return f'As a {role}, I want {goal}, so that {benefit}.'


def issue_body(s):
    sid, title, role, goal, benefit, req, hyps, area, owner, status, ac, evidence = s
    rq = next(r for r in REQUIREMENTS if r[0] == req)
    lines = [f'**User story ({sid})**', '', story_text(s), '', '**Acceptance criteria**', '']
    lines += [f'- [{"x" if status == "built" and "(open" not in c else " "}] {c}' for c in ac]
    lines += ['', f'**Requirement:** {req}, {rq[1]}' + (' (AI integration)' if rq[4] else ''),
              f'**Hypothesis served:** ' + '; '.join(f'{h} ({HYPOTHESES[h]})' for h in hyps),
              f'**Owner:** {owner}', f'**Status:** {status}', f'**Evidence / tests:** {evidence}', '',
              '_Generated from `planning/user_stories.py` (Alpha Activity 2). Edit there and re-run._']
    return '\n'.join(lines)


def issue_numbers():
    """Map story ID -> issue number, read from GitHub if gh is available (otherwise no links)."""
    try:
        issues = json.loads(gh('issue', 'list', '--state', 'all', '--limit', '500', '--json', 'number,title'))
    except (OSError, subprocess.CalledProcessError):
        return {}
    return {i['title'].split(':')[0]: i['number'] for i in issues if i['title'].startswith('US-')}


def markdown():
    numbers = issue_numbers()
    out = ['# Alpha Activity 2: requirement decomposition', '',
           '**Commit metadata.** The requirements and user stories are recorded in planning commit `0e18096` on `member1`. Its commit date was changed from November 4, 2026, to October 29, 2026, at 10:00 AM Eastern. GitHub issue creation timestamps and commit ancestry are unchanged.', '',
           'Generated from `planning/user_stories.py`; GitHub issues are created from the same file. It builds on, and does not',
           'change, the MVP hypothesis and validation analysis in [validation-plan.md](../Context/validation-plan.md):', '']
    out += [f'- **{h}** {t}' for h, t in HYPOTHESES.items()]
    out += ['', '## 1. Requirements that set Clipcademy apart', '',
            '| ID | Requirement | Why it sets the product apart | Hypotheses | AI |', '| --- | --- | --- | --- | --- |']
    out += [f'| {r[0]} | **{r[1]}** | {r[2]} | {", ".join(r[3])} | {"**Yes**" if r[4] else ""} |' for r in REQUIREMENTS]
    out += ['', '### Core AI integration', '',
            '- **Built (R4):** ElevenLabs neural text-to-speech narrates every reviewed script and returns per-character timing. '
            'That timing is the backbone of each clip: it places every burned-in caption word, triggers every animation beat '
            'and sound effect at the spoken word, and checks pacing (15–30 s, no still stretch over 3 s). Audio is cached, '
            'so a clip costs credits once.',
            '- **Proposed (R7):** LLM-assisted drafting of scripts and questions from the lecture excerpts, always approved by '
            'a reviewer before use. The MVP deliberately keeps LLMs out of student sessions (Team_Spec: adapting means '
            '*selecting, not generating*), so this is offline authoring help, not live generation, and needs a team decision.',
            '', '## 2. User stories and acceptance criteria', '']
    for s in STORIES:
        sid, title, role, goal, benefit, req, hyps, area, owner, status, ac, evidence = s
        out += [f'### {sid}: {title}', '', f'> {story_text(s)}', '',
                f'Requirement {req} · Hypotheses {", ".join(hyps)} · Owner {owner} · Status **{status}**'
                + (f' · GitHub issue [#{numbers[sid]}](https://github.com/{REPO}/issues/{numbers[sid]})' if sid in numbers else ''), '',
                'Acceptance criteria:', '']
        out += [f'{i}. {c}' for i, c in enumerate(ac, 1)]
        out += ['', f'Evidence: {evidence}', '']
    out += ['## 3. Coverage of planned Alpha functionality', '',
            '| Alpha functionality (Team_Spec, notes.md) | Stories |', '| --- | --- |']
    coverage = [
        ('Participant code, topic picker, review home', 'US-01, US-02, US-03'),
        ('Vertical swipe feed of 4–5 intro clips, auto-advance, manual swipe', 'US-04, US-05'),
        ('Captions, transcript, accessibility', 'US-06'),
        ('Question before explanation, double-submit safety', 'US-07'),
        ('Wrong answer → targeted follow-up → fresh retry', 'US-08'),
        ('Second, different follow-up; two-cycle limit; needs review', 'US-09'),
        ('Required questions and objective completion', 'US-10'),
        ('Progress persistence and refresh', 'US-11'),
        ('Clip failure and retry', 'US-12'),
        ('AI narration and word-synced captions/animation (core AI)', 'US-13, US-14'),
        ('Animated stick-figure diagrams for all four topics (35 clips)', 'US-15'),
        ('Sourced scripts and reviewer text', 'US-16'),
        ('Prerendered clip API with review gate', 'US-17'),
        ('Content audit and freeze gate', 'US-18'),
        ('Activity events and export for H1–H3', 'US-19, US-20'),
        ('Hosting and phone check', 'US-21'),
        ('Reset demo', 'US-22'),
        ('LLM-assisted authoring (proposed)', 'US-23'),
        ('Course import: any class material to stick-figure clips via Gemini', 'US-24, US-25, US-26, US-27, US-28, US-29'),
        ('Course platform: teacher upload, background jobs, quiz questions, clip list, class code, one-container deploy', 'US-30, US-31, US-32, US-33, US-34, US-35'),
        ('Running the course platform locally: current Gemini model, .env keys in Docker, LF fingerprints', 'US-36, US-37, US-38, US-39'),
        ('Course platform wrong-answer loop: follow-up clips, retry questions, MVP grading, saved progress, no review step', 'US-40, US-41, US-42, US-43, US-44'),
        ('Objectives sharing a topic keep separate clip scripts', 'US-45'),
        ('Faster generation with progress', 'US-46'),
        ('Topic breakdown on the teacher page', 'US-47'),
        ('Home page: class code or teacher sign-in', 'US-48'),
    ]
    out += [f'| {a} | {b} |' for a, b in coverage]
    covered = {x.strip() for _, b in coverage for x in b.split(',')}
    assert covered == {s[0] for s in STORIES}, 'every story must appear in the coverage table'
    out += ['', f'Totals: {len(REQUIREMENTS)} requirements, {len(STORIES)} user stories '
            f'({sum(s[9] == "built" for s in STORIES)} built, {sum(s[9] == "in progress" for s in STORIES)} in progress, '
            f'{sum(s[9] == "proposed" for s in STORIES)} proposed), '
            f'{sum(len(s[10]) for s in STORIES)} acceptance criteria. One GitHub issue per story, labelled `user-story`, '
            'its area, its status, and its requirement.', '']
    return '\n'.join(out)


def gh(*args, input_text=None):
    return subprocess.run(['gh', *args, '--repo', REPO], input=input_text, text=True, capture_output=True, check=True).stdout


def create_issues():
    labels = {'user-story': '1D76DB'} | {v: 'C5DEF5' for v in AREA_LABELS.values()} | \
             {v: 'BFD4F2' for v in STATUS_LABELS.values()} | {r[0]: 'FBCA04' for r in REQUIREMENTS}
    existing_labels = {l['name'] for l in json.loads(gh('label', 'list', '--limit', '200', '--json', 'name'))}
    for name, color in labels.items():
        if name not in existing_labels:
            gh('label', 'create', name, '--color', color)
    titles = {i['title'] for i in json.loads(gh('issue', 'list', '--state', 'all', '--limit', '500', '--json', 'title'))}
    for s in STORIES:
        title = f'{s[0]}: {s[1]}'
        if title in titles:
            print('exists ', title)
            continue
        lab = ['user-story', AREA_LABELS[s[7]], STATUS_LABELS[s[9]], s[5]]
        url = gh('issue', 'create', '--title', title, '--body-file', '-', *sum((['--label', l] for l in lab), []),
                 input_text=issue_body(s)).strip()
        print('created', title, url)


if __name__ == '__main__':
    (HERE / 'USER_STORIES.md').write_text(markdown(), encoding='utf-8')
    print(f'wrote planning/USER_STORIES.md: {len(STORIES)} stories')
    if '--issues' in sys.argv:
        create_issues()
