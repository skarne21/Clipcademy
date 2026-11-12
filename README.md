# ClipCademy

ClipCademy turns class notes into short vertical videos and practice questions, built around **active recall**. A
student watches a few 15–30 second clips, a stick figure explaining one idea at a time with word-by-word captions,
then answers a question from memory. A wrong answer plays a short follow-up clip aimed at that exact mistake, then a
question they haven't seen yet. Missing the same idea again plays a second clip that explains it a different way.
After two follow-ups the topic ends in **Needs review**, with the key points to go over.

The repo holds two apps that share one server, one video renderer and the same grading rules:

| | **Course platform** (Beta) | **Biology study app** (MVP / Alpha) |
| --- | --- | --- |
| Content | Generated from any teacher's notes by Gemini | 35 hand-written clips on DNA replication, repair, transcription and translation |
| Who gets in | Students with a 6-character class code; teachers with the teacher password | Study participants with a participant code (`P01`…) |
| Review | None: clips go live when generated; the teacher can delete any | Every item must pass the content audit (`Context/content-audit.csv`) |
| Pages | `/` (home), `/teach.html`, `/class.html` | `/index.html` |

The biology lessons are also available as a class with the code **`BIO101`** (DNA replication and DNA repair), using
the same clips and answer key as the study app.

## Run it on your computer

You need Docker Desktop, a [Gemini API key](https://aistudio.google.com/apikey) and an
[ElevenLabs API key](https://elevenlabs.io) (Profile → API keys, with *Text to Speech* and *Voices: read*).

1. Put three settings in `video/.env`. The file is git-ignored and never copied into the image; quotes are fine.

   ```sh
   GEMINI_API_KEY="..."
   ELEVENLABS_API_KEY="..."
   CLIPCADEMY_TEACHER_TOKEN="..."   # the teacher password; make up a long random string
   ```

2. Build and start the container. Courses, uploads and videos live on the `clipcademy-data` volume, so they survive
   restarts.

   ```sh
   docker build -t clipcademy .
   docker run -d --name clipcademy -p 8000:8000 -v clipcademy-data:/data --env-file video/.env clipcademy
   ```

   If port 8000 is taken, map another one, for example `-p 8080:8000`, and use that port below.

3. Open **http://localhost:8000/**. Sign in as a teacher with the password, or type a class code to join a class.

To update after pulling new code, rebuild the image, then replace the container: `docker rm -f clipcademy` and run
step 2 again. Check the teacher page first, because restarting stops a generation job that is still running.

Hosting on Railway, Render or Fly.io, costs and limits are in [DEPLOY.md](DEPLOY.md).

## How a course works

```
Teacher                                   Worker (in the container)                      Student
───────                                   ─────────────────────────                      ───────
sign in on /  ──► create a course
upload PDF / .txt / .md notes
press "Make clips"  ─────────────────►    1. Gemini splits the notes into ≤ 4 topics,
                                             each with verbatim quotes, 3–5 intro clip
                                             plans and 2 common mistakes
                                             (shown on the teacher page right away)
                                          2. Gemini writes every clip script, 4 at a time,
                                             and each is checked before any voice credits
                                             are spent
                                          3. Gemini writes 2 questions per topic and
                                             2 retry questions per mistake
                                          4. ElevenLabs voices and Remotion animates
                                             each clip
watch clips, delete any bad ones  ◄────── "N clips and M questions are live"
share the class code  ──────────────────────────────────────────────────────────►   type the code on /
                                                                                     watch the intro clips
                                                                                     answer from memory
                                                                                     wrong → follow-up clip
                                                                                       → new question
```

A course with four topics makes about 30 clips. Expect roughly 6 minutes of writing plus 15–25 seconds of rendering
per clip, and about $0.05 of ElevenLabs credit per clip. Pressing **Make clips** again replaces the course's clips and
questions. No Gemini call ever happens while a student is using the app.

**Grading.** Students' answers are graded on the server by `learning/grading.py`, the same rules the study app uses.
Each wrong choice maps to a misconception; the first miss plays that misconception's v1 clip and a retry question, a
second miss plays the v2 clip and a second retry, and two follow-up cycles per topic end in Needs review. Progress is
saved in the student's browser per class code, so a refresh resumes where they were.

## Repository map

| Path | What's there |
| --- | --- |
| [`learning/`](learning/) | The Python server. `server.py` serves everything from one port; `app.py` and `grading.py` are the biology study API and grading rules; `courses.py` is the course platform API (classes, attempts, the `BIO101` class); `course_worker.py` runs generation jobs in the background. `data/` and `packets/` hold the biology questions, answer key and lesson packets. |
| [`video/`](video/) | The renderer: `render.py`, `tts.py` (ElevenLabs), `beats.py`, `sfx.py` and the Remotion project in `remotion/`. `scripts/` and `media/` are the 35 biology clips. See [video/README.md](video/README.md). |
| [`video/course/`](video/course/) | The course pipeline: `generate.py` (topics and clip scripts), `questions.py` (questions and retries), `templates.py` (the five scene types and the clip checks), `render_course.py`. See [video/course/README.md](video/course/README.md). |
| [`web/`](web/) | Plain JavaScript pages built with Vite. `src/main.js` is the study app; `src/platform/` holds `home.js`, `teach.js` and `class.js`. Browser tests are in `web/e2e/`. See [web/README.md](web/README.md). |
| [`planning/`](planning/) | User stories and acceptance criteria ([USER_STORIES.md](planning/USER_STORIES.md), generated from `user_stories.py`, one GitHub issue per story) and the [TDD log](planning/TDD_LOG.md). |
| [`Context/`](Context/) | Specs and the study record: [Team_Spec.md](Context/Team_Spec.md), per-member specs and devlogs, the validation plan, hypothesis tests, the content audit. |
| [`validation/`](validation/) | Alpha study data and the script that summarises it. |
| [`tdd/`](tdd/) | Runnable TDD evidence for the MVP. |
| [`Notes/`](Notes/) | Lecture notes (Lec 19–22) the biology content is sourced from. |
| `Dockerfile`, [`DEPLOY.md`](DEPLOY.md) | The single container (server, worker, renderer) and how to host it. |

## Developing without Docker

```sh
cd web && npm ci && npm run build && cd ..
cd video/remotion && npm ci && cd ../..
CLIPCADEMY_TEACHER_TOKEN=... python learning/server.py      # http://localhost:8000
```

Without Docker, the two API keys can stay in `video/.env`, but the teacher password must be set in the environment
as shown. For live front-end changes, run `npm run dev` in `web/` (port 5173); it proxies API calls to port 8000.

## Tests

```sh
pip install pytest
python -m pytest learning video        # Python: learning service, course platform, renderer, course pipeline
```

Browser tests use your installed Chrome. Start `npm run dev` in `web/`, then run, from `web/`:

```sh
node e2e/class-loop.mjs                # class page: wrong-answer loop, refresh, Needs review, Restart
node e2e/home.mjs                      # home page: class code and teacher sign-in
```

Notes:
- `video/course/test_course_layout.py` renders real frames, so it needs `npm ci` in `video/remotion`.
- On a native Windows checkout, 5 tests fail: `video/test_jobs.py` (3), `video/test_integration.py` (1) and
  `video/course/test_isolation.py` (1). They look up the 35 biology clips by fingerprint, and the fingerprint depends
  on file order, which Windows sorts case-insensitively. All of them pass on macOS, Linux and inside the Docker image
  (`docker exec -w /app clipcademy python3 -m unittest discover -s video`). See US-38 in the
  [TDD log](planning/TDD_LOG.md).

Features are built test-first: the failing test is committed before the code that makes it pass. The
[TDD log](planning/TDD_LOG.md) lists every red/green pair.

## Limits to know

- **No review step on the course platform.** Gemini's clips and questions reach students without a person checking
  them first. Each clip lists its sources on screen, and the teacher can delete any clip or question.
- **One shared teacher password**, no individual teacher accounts. **Students are anonymous**, and their progress
  lives only in their browser.
- **Five scene types** (steps, compare, flow, term, myth/fact). Subjects that need real diagrams would need new ones.
- **Notes must be PDF, .txt or .md**, up to 18 MB each. Quotes from text files are checked word for word against the
  notes; quotes from PDFs aren't.
- **One machine.** The worker runs inside the web container, one job at a time.
