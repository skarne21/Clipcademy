# Member 2 development log

Owner: Member 2 (questions, adaptive lesson logic, learning service) · Code: `learning/` · Spec: [Member2_SPEC.md](Member2_SPEC.md)
Period covered: 2026-11-02 to 2026-11-03 · Branch: `MVP02` · Tag: `V1` (`bf28f92`, before the end-to-end review) · Live: https://clipcademy.pythonanywhere.com

## Where things stand

All the code Member 2 owns is built, tested and pushed, including the vertical-clip changes from notes.md (section 20). **No coding is left.** What's left is the checklist under "Next steps": it needs a content reviewer, Member 1's intro clips, and the PythonAnywhere login, in that order.

| Area | State |
| --- | --- |
| Topics, packets, question bank, answer key (tasks 1–4) | Done. Content is `draft` until review |
| Grading and the 2-cycle limit (tasks 5–6) | Done. `learning/grading.py` |
| Sample responses for Member 3 (task 7) | Done. `learning/samples/`, 11 files of real app output |
| API: topics, questions, attempts (task 8) | Done. `learning/app.py` |
| Events and `events.csv` export (task 9) | Done |
| Wrong-answer flow with Members 1 and 3 (task 10) | Tested end to end with Member 3's app (19 browser checks), including the v2 follow-up. Video part waits on Member 1 |
| Content check (task 11) | Automated check done, including the clip rules. 144 audit rows wait for a human reviewer |
| Vertical clips (notes.md, 2026-11-03) | Done. All 4 packets, `intro_video_requests`, v1/v2 follow-ups, `clip_swiped`, clip audit columns, new metrics |
| Hosting | **Deployed** on PythonAnywhere (account `ClipCademy`). The API and Member 3's app are served from one site |
| Time on app | Done. `heartbeat` events, in the server and the app |
| Validation build | `study-2` is live. `study-4` (the swipe feed) is built and tested, and goes live once Member 1's intro clips are merged. The final freeze waits on content review and clips |

**Tests:** 3 suites, run with `python learning/test_grading.py` (23), `python learning/test_app.py` (24), and `python learning/test_check_content.py` (4). They include a test that walks every possible answer sequence across the 4 lessons. `python learning/check_content.py` passes.

## Timeline

### 1. Spec review

I read the whole `Context/` folder and checked the data files against each other: every question has an answer-key entry, choice IDs match, and every misconception maps to a real video variant and retry questions. I flagged 10 problems:
- **Contradictions:** a required question is shown again after a different misconception's retry, the example feedback didn't match the answer key, draft content was marked `available`, and `rep-r2`'s source didn't match.
- **Gaps:** no `needs_review` explanation was defined, there was no flag column for events, no storage choice, no rules for invalid or out-of-order requests, and no checks on the state the client sends.

The team resolved these in `0f394ce`, which defined `objective_status`, `expected_question_id`, `review_points`, `build_id_status`, and the `409`/`400` rules.

### 2. Grading module (tasks 5–6)

I wrote the tests first from the spec's test cases, then `grading.py`.

The module is one function, `grade(request, attempts)`. It validates the request and the state the client sends, enforces the order of questions, applies the transition rules, caps follow-up cycles at 2 per objective, and replays a stored result when the same submission is resent. It reads all four lessons from the data files, so adding a lesson needs no code change.

While I was building it, `0f394ce` landed with different field names. I undid my overlapping spec edits and brought the code in line with the committed contract.

### 3. Service decisions (`c4a0f92`)

| Decision | Why |
| --- | --- |
| Python standard library only, no framework | Nothing to install, and it runs anywhere |
| SQLite for attempts and events | Resends are recognized even after a restart, and events are durable |
| Settings in environment variables (port, database, allowed origins, build IDs, admin token) | Same code locally and when hosted |
| `POST /events` checks fields strictly; a repeated `event_id` returns `200`, not an error | Keeps the study data clean, and makes Member 3's resends safe |
| Added `client_timestamp_utc` to events | A resent Day 0 event arriving on Day 1 would otherwise count as a return visit and inflate H3 |
| `GET /events.csv` needs a token | The export holds participant activity |
| No LLM API key | Grading follows fixed rules and all content is pre-written |

### 4. Hosting (`68652c8`, `0621a79`)

I compared free and low-cost hosts. PythonAnywhere's free plan is the cheapest that keeps its disk between restarts, which SQLite needs. Render's free plan spins down and seems to have no persistent disk, Fly.io no longer has a free tier, and Koyeb now needs a card hold. Everything is served from one place: my service, Member 3's static files at `/`, and Member 1's clips at `/media/`.

What this means for the rest of the team:
- The service became a WSGI app. Locally it runs on `wsgiref`.
- The free plan can't render video live. Member 1 renders the clips ahead of time.
- Member 3's app must build to static files and call the API with relative paths.

### 5. Clarifying adaptation (`a363432`)

The MVP adapts by *selecting* pre-written content, not by generating it: a wrong answer picks which follow-up video and which retry question come next. Every item must pass content review before students see it, so nothing is generated during a session. This is now stated plainly in Team_Spec. The same commit defined how Member 1's `/video-jobs` plugs into my service and how Member 3 proxies the API during local development.

### 6. Service build (`1f91188`, `441b9d1`)

- **`app.py`:** serves `/topics`, `/questions/{id}`, `/attempts`, `/events`, and `/events.csv`. It handles browser access permissions, a 64 KB limit on request size, and the standard error format.
- **`/video-jobs`:** passed to Member 1's `video/jobs.py` once that file exists. Until then it returns `503`.
- **`samples/`:** generated by running the real app. The tests fail if a sample no longer matches.
- **`check_content.py`:** checks that sources, the answer key, misconceptions, video variants, retry counts, and topics are consistent. With `--freeze`, it also requires approved content for every `available` lesson.
- **`content-audit.csv`:** pre-filled with 58 `pending` rows, one for each validation-build item.

I also smoke-tested the real server with curl.

### 7. Permission and account (`84fb60a`)

Instructor permission for the note excerpts was received on 2026-11-02. Member 2 owns the PythonAnywhere account. I added step-by-step deployment instructions to Member2_SPEC.

### 8. Content pre-check against the lecture notes (`2a4f7fe`)

I extracted the text of L19 pp. 1–3 and L20 p. 1 and compared every validation-build question and feedback line with it. Every answer was correct. I fixed some sourcing problems:
- I added two L19 p. 1 excerpts the content already relied on: anti-parallel strands, and ligase adding no new bases.
- I reworded 3 feedback lines (`rep-r2` A, `dr-q1` C, `dr-r4` B) that cited facts from outside their listed sources.

### 9. Longest-answer cue (`bf28f92`, tagged `V1`)

In 8 questions, the correct choice was clearly the longest, so students could pick it by recognition rather than recall. The affected questions were `rep-q2`, `dr-q1`, `dr-q2`, `dr-r4`, `tx-q2`, `tx-r1`, `tx-r4`, and `tl-r4`. I reworded their choices to similar lengths, using only facts from the notes. Correct letters, misconceptions, and follow-up videos are unchanged, and two feedback lines changed to match their new choice text. `check_content.py` now flags this pattern.

### 10. End-to-end review (`accfd82`)

`V1` was tagged first, before any testing. Then I tested everything in four ways:
- Ran the 3 test suites.
- Checked every one of the 152 possible answer sequences against the flow rules.
- Ran a real HTTP server, acting as both Member 3 (browser app) and Member 1 (video service).
- Compared the spec's examples with live responses.

That review found 4 real problems:

| Problem | Impact | Fix |
| --- | --- | --- |
| Member 3 had no way to build the initial video request | A student couldn't start a lesson | `/topics` gives each objective an `initial_video_request` |
| IDs numbered like the spec examples (`attempt-001`) collided between students and after Reset demo | A student got another student's result or was blocked with `409`, and events were silently dropped | `attempt_id` and `event_id` must be UUIDs |
| `topic_id` on `question_answered` events was optional | The H3 split between replication and repair could come out empty | The server fills in `topic_id` and `objective_id` from the question |
| Path routes like `/lesson` would hit the API when the page is refreshed | A refresh would show a 404 | Member 3 uses hash routes (`/#/lesson`) |

The 152-path check is now a permanent test. It also catches a version that I broke on purpose.

### 11. Member 3 spec review

I checked Member3_SPEC (committed in `22bb6b0`) against this API. It's consistent. I suggested four small additions, which aren't applied yet:
- Member 1's ready response should say whether a clip was pre-rendered.
- The first question of a fresh lesson comes from `required_question_ids[0]`.
- Every `409` should be handled as "state out of sync," not only the one for `question_id`.
- Test case 13 needs the local server started with the app's build ID.

### 12. Deployment (2026-11-03)

I walked through the PythonAnywhere setup step by step:
- **Path fix:** the WSGI file had to use the exact username, `ClipCademy` (case-sensitive).
- **Token:** rotated after the first one was shared in chat. The old token now gets `401`.

A live test of 24 checks against the deployed site all passed: every endpoint, resends, conflicts, events, export, browser access (CORS), and HTTPS. One `504` happened only while the app was restarting.

### 13. Member 3's app hosted

I zipped Member 3's built app, and you uploaded it and mapped it to `/`. That confirmed the one hosting behaviour that couldn't be tested locally: PythonAnywhere serves a file when it exists, and otherwise passes the request to the API. So `/` serves the app, while `/topics` and the other API paths still reach the API.

A "clip couldn't load" message on the phone was expected. Member 1's `/video-jobs` doesn't exist yet, and the app handles that with a Retry button plus **Answer the question**.

### 14. Time on app: `heartbeat` (`f72eaec`, `b921e62`)

The timestamps already showed *when* students used the app. *How long* was only a rough first-to-last-event estimate. I added a `heartbeat` event:
- **What it measures:** one heartbeat per 30 s of time the app is actually on screen, added up second by second. Hidden tabs and locked phones pause it, and switching tabs quickly can't inflate it.
- **Laptop sleep:** each step is capped, so a sleeping laptop can't add time.
- **Lesson split:** heartbeats sent during a lesson carry its topic.
- **Server:** accepts `heartbeat` events.
- **Validation plan:** time on app = heartbeats × 0.5 min.
- **Testing:** I wrote e2e case 16 (page clock at 4×) first and watched it fail. With the feature in place, all 17 browser checks pass.

Two git problems came up along the way:
- **Commits weren't reaching GitHub.** The working copy had been switched to a local `member3` branch, so my two commits never reached GitHub's `MVP02`. You chose to fast-forward `MVP02`, which brought in the plain-JS app's source along with the heartbeat.
- **GitHub's `member3` branch is someone else's.** It belongs to VMahajan10, and I didn't touch it.

### 15. Audit of the two Member 3 apps

I compared the plain-JS app (live) with VMahajan10's React + TypeScript app.

| | Plain JS | React + TS |
| --- | --- | --- |
| Screens | 8 of 8 | 0 of 8 (only a heading) |
| Against the real server | 17 of 17 browser checks pass | 3 of 3 contract probes fail |
| Own tests | e2e plus a check that its sample data matches | 72 unit tests, but only against hand-written mocks |
| Bundle size | 13 KB | 220 KB |

The React data layer would lose all study data. Events use `participant_code` and `client_timestamp` instead of `participant_id` and `client_timestamp_utc`, so every event gets a `400` and is silently dropped. It also calls absolute `http://localhost/api` addresses, reads topics as a list when the server sends an object, uses the same session ID on every load, and reads errors from the wrong place.

**Recommendation:** keep the plain-JS app for the study. VMahajan10's testing work could go into splitting up `main.js` and adding unit tests.

### 16. Validation build `study-1` (`0bfcd6b`)

- **DNA repair:** set to `available`. `check_content.py --freeze` still blocks the final build until the review is approved.
- **Build ID:** `study-1`, in the app's `config.js` and in the server's `CLIPCADEMY_BUILD_IDS`.
- **Allowed origin:** limited to the live site.
- **The upload:** a clean build from committed code only. Another session had uncommitted edits in `web/src`, and those aren't in this build.
- **Checked live:**
  - the new bundle with `study-1` is served
  - DNA repair is `available`
  - `study-1` events get `201`
  - browser access is limited to the live site

### 17. Phone test of `study-1`

The `TEST` export summary showed that every `study-1` event arrived with `build_id_status` `ok`:
- **Answers were recorded once each.** 5 answers, 2 follow-ups and 1 completion form a valid path.
- **`unknown` rows came from before the build ID was set.** They're the old `dev` build plus my earlier tests, and the analysis excludes them.

The export also showed a measurement gap. On-screen time was added up in the page's memory, so **a refresh threw away up to 29 seconds** of time on app.

### 18. Heartbeat carry-over across a refresh, build `study-2` (`0a90b93`)

- **The fix:** `events.js` saves the seconds not yet worth a heartbeat when the page is hidden or closed. It saves on both, because phones often skip the close event when a tab is swiped away. Those seconds carry into the next load if it comes within 5 minutes, so yesterday's leftover can't count as today's time.
- **The test:** `web/e2e/heartbeat.mjs` checks that 20 s on screen, then a refresh, then 14 s gives exactly one heartbeat. It's a separate file because another session had uncommitted edits in `run.mjs`. I wrote the test first, and it failed with 0 heartbeats. With the fix, it passes, and the full suite still passes all 17 checks.
- **A test-environment problem:** two copies of `learning/app.py` were listening on port 8000. The other session's copy had loaded the topics before DNA repair became `available`, so my first run failed against it. I stopped only my own process (I identified it by start time), and reran on separate ports, 8020 and 5180.
- **Build ID:** bumped to `study-2`, because time on app is now measured differently from `study-1`. I built it from committed code only. On the server, `CLIPCADEMY_BUILD_IDS` is `study-1,study-2` until the freeze.
- **Checked live:**
  - the new bundle is served, with `study-2` and the carry-over code in it
  - topics are correct
  - events get `201`

### 19. Live check in a real browser

The Chrome extension wasn't connected, so I drove the local Chrome directly, the same way the browser tests do. The test used a phone-sized window, the real site and **real time** (no fast clock):

| Time | What happened |
|---|---|
| 2.8 s | Code `TEST` entered. The queued `app_opened` events are sent, and the server returns `201` |
| 2.8–22.8 s | Topic picker on screen. No heartbeat yet, correctly |
| 23.0 s | Refresh: a new session and `app_opened`. The screen stays on `#/topics` |
| 23.6 s | **21.7 s carried over** from before the refresh |
| 32.1 s | **Heartbeat sent** at exactly 30 s on screen in total (21.7 s + 8.5 s). The server returns `201` |

Every event was built as `study-2` and stored, with no page errors. The phone test, including the refresh case, is done. Its `TEST` rows will be wiped at the freeze.

### 20. Vertical clips, 4–5 per topic (notes.md, 2026-11-03)

The product owner changed the lesson format: 4–5 short vertical intro clips per topic, then the quiz, and a second, differently explained follow-up when a student misses the same idea twice. My side:

| Task (notes.md) | Done |
| --- | --- |
| 1. Packets | All 4 packets have `intro_1` … (5 for replication, repair and translation, 4 for transcription) and a `<name>_followup_2` per misconception. Each `_2` has an `approach` saying how it differs from v1. I added 6 excerpts from the notes the clips will need, e.g. "Exonuclease is an enzyme that can remove a nucleotide…" (L20 p. 1) and the P-site peptide-bond sentence (L22 p. 2). Nothing came from the excluded passages |
| 2. Transcription and translation | Their banks were already complete (2 required, 4 retries, feedback for every choice). They stay `coming_soon` until their audit rows are approved, then get flipped at the freeze |
| 3. API | `/topics` returns `intro_video_requests` in place of `initial_video_request`. `/attempts` gives v1 with a misconception's first retry and v2 with its second, so missing two *different* ideas gets each one's v1 (Member2_SPEC, rule 3). Samples are regenerated |
| 4. Content review | content-audit.csv has 134 rows, including all 35 clips. Two new columns, `analogy_ok` and `hook_in_sources`, must be `yes` for every clip before `--freeze` passes. The rows for the 6 old clips were dropped; none had been reviewed |
| 5. Teaching goals | Each intro goal is one plain sentence, e.g. "New DNA only grows from 5′ to 3′." `check_content.py` enforces one sentence of at most 20 words |
| 6. Metrics | validation-plan.md now has clip completion rate, drop-off by position, and first-try accuracy after the feed. The feed-vs-single-clip comparison is reported as "no baseline" unless real single-clip data exists, since the team's `TEST` sessions don't count |
| `clip_swiped` | The server accepts it (`variant_id`, `direction` `up`/`down`, `seconds_watched`). Two new `events.csv` columns. A database from before this change gets the columns added on start, so the hosted one keeps working |

**Tests:** 23 grading tests, including a new case 8g, and the all-paths test now also checks that no follow-up clip is ever shown twice. 24 app tests and 4 content-check tests pass, and `check_content.py` passes.

**Not done, and why:** booking the reviewer (needs a person), the PythonAnywhere steps (no access from here; written out in Member2_SPEC, Deploying, steps 7–9), and Member 1's clips. `video/test_integration.py` now asks for every intro clip, so it fails with "unknown … variant" until Member 1 renders `intro_1` and the rest.

## Commits

| Commit | Change |
| --- | --- |
| `c4a0f92` | Service details: stack, config, events contract, export |
| `68652c8` | PythonAnywhere hosting |
| `1f91188` | Learning service: grading, WSGI API, events, samples |
| `0621a79` | Free-host limits and confirmations for Members 1 and 3 |
| `a363432` | Selection not generation, `/video-jobs` plug-in, local dev proxy |
| `441b9d1` | `/video-jobs` forwarding, content check, audit sheet |
| `84fb60a` | Instructor permission, account owner, deploy steps |
| `2a4f7fe` | Content pre-check against the lecture notes |
| `bf28f92` (`V1`) | Longest-answer cue removed from 8 questions |
| `accfd82` | Integration fixes from the end-to-end review |
| `1dbb4bb`, `a7611cd` | This log; `secrets.txt` ignored |
| `88b61d9` | Web build is uploaded via the Files tab; live username and URL recorded |
| `f72eaec` | Server accepts `heartbeat`; validation plan measures time on app |
| `b921e62` | Heartbeat in the web app, plus e2e case 16 |
| `0bfcd6b` | Validation build: DNA repair available, build ID `study-1` |
| `4d6f408` | Log and progress: deployment, heartbeat, app audit, `study-1` |
| `0a90b93` | Heartbeat carries over a refresh; test; build ID `study-2` |
| `7b0d1a9` | This log's study-1/study-2 sections. **It also contains work staged by other sessions, committed by mistake under this message:** Member 1's `video/` folder (renderer, `jobs.py`, tests, and all 6 clips with transcripts and captions), Member 3's `web/` changes (captions, disclosure text, `/media` proxy, two e2e files), and a change to `learning/app.py` that also passes `/media/` to Member 1's handler. All Member 2 tests pass on it. Kept as is, by team decision, rather than rewriting shared history |

| *(this commit)* | Vertical clips: packets, API, `clip_swiped`, clip audit, metrics (section 20) |

## Next steps for Member 2

None of these is coding. Each is a person, a login, or a wait.

1. **Book the content reviewer now.** This is the riskiest part of the schedule (notes.md). There are 144 rows. 109 of them don't need the clips: 24 questions, 65 feedback lines, 4 packets (including the intro teaching goals) and 16 test questions. Start those now, with transcription and translation first, so those two topics can be switched on at the freeze. The reviewer sees Member 1's scripts as text as soon as they're written, then the 35 rendered clips, and fills in `analogy_ok` and `hook_in_sources` for each clip.
   - **Also now:** check the PythonAnywhere disk quota (Files tab) has about 50 MB free for the clips. **Don't** upload the new `learning/` code yet: the live `study-2` app reads `initial_video_request`, which the new `/topics` no longer sends. The server and `study-4` go up together.
2. **After each video push from Member 1:** `git pull`, keep `/media/` mapped, Reload, and check the disk (about 50 MB of clips).
3. **Don't deploy `study-4` until Member 1's intro clips are merged.** Until then, every intro slide would show "The clip couldn't load." Add `study-4` to `CLIPCADEMY_BUILD_IDS` when it goes live.
4. **Final freeze:**
   - Mark the approved packets `reviewed`. Flip transcription and translation to `available` only if all their rows are approved.
   - Make sure `CLIPCADEMY_VIDEO_PREVIEW` is not set on the host.
   - Run `check_content.py --freeze`, which must pass.
   - Set `CLIPCADEMY_BUILD_IDS` to just the frozen build's ID.
   - Delete `learning/clipcademy.db`, then Reload.
   - Repeat the live browser check.
5. **Day 0:** extend the web app's expiry first ("Run until 1 month from today").
6. **After Day 2:** download `clipcademy.db` and `events.csv`.
