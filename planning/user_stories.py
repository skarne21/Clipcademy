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
           '**Commit-date exercise.** This planning work is assigned October 29, 2026, at 10:00 AM Eastern, after the TDD commits and before the MVP hypothesis and validation work in the simulated timeline. Its original recorded commit date was November 4, 2026. GitHub issue creation timestamps and commit ancestry are unchanged.', '',
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
