# Member 3 development log

Owner: Member 3 (student interface and application integration) · Code: `web/` · Run, test, freeze: [web/README.md](../web/README.md)
Period covered: 2026-11-03 · Branch: `MVP02` · Build: `study-4` (live: `study-2`) · Live: https://clipcademy.pythonanywhere.com

## Where things stand

The whole student app is built and tested against the real learning service, including the vertical swipe feed from notes.md (section 6). **No coding is left.** What's left is the checklist under "Next steps": a phone check and a hand-off, both waiting on Member 1's intro clips.

| Team_Spec task | State |
| --- | --- |
| 1. Exam-topic picker, saved selections | Done |
| 2. Review home: available, coming soon, in progress, complete, needs review | Done |
| 3. Video screen: controls, transcript, Back, question button | Done, now a vertical swipe feed of 4–5 clips. Shows whether a clip was pre-rendered or generated |
| 4. Question screen, no duplicate submissions | Done |
| 5. Feedback and follow-up screens, preparing and failed states with Retry | Done |
| 6. Progress saved in browser storage | Done. One `localStorage` key |
| 7. Reset demo, one replaceable data-access module | Done. `src/api.js` |
| 8. Participant code and activity events, including `heartbeat` and `clip_swiped` | Done |
| Hosting | Static build, relative API paths, hash routes. Uploaded and served at `/` |

**Tests:**
- `npm run check`: sample-data mode answers like the recorded server output.
- `npm run e2e`: 19 browser checks against the real Python service.
- `node e2e/heartbeat.mjs`: heartbeat time survives a refresh.

The e2e test passes against the production build (`vite build` + `vite preview`) with DNA repair available.

## Decisions

| Decision | Why |
| --- | --- |
| Plain JS + Vite, no framework | Builds to static files for PythonAnywhere. About 600 lines, with a 13 KB bundle on the free plan's low bandwidth |
| Hash routes (`/#/lesson/...`) | A refresh on a path route would reach the API and return a 404 |
| The saved step decides which screen shows | A stale link or the Back button can't reopen an answered question |
| The `remediation_state` from the server is stored unchanged | Member 2's service makes every decision; the app never edits that state |
| A pending attempt keeps its `attempt_id` until the result arrives | A refresh or a failed send resends the same answer, and the server counts it once |
| Events are queued in storage, then sent in order | A failed send keeps its `event_id` and `client_timestamp_utc`, and never blocks the student |
| A navigation counter discards late responses | A slow clip or answer can't draw over another screen |
| A `503` from `/video-jobs` counts as a failed job | The app works before Member 1's service is installed: Retry, or **Answer the question** |

## Timeline

### 1. Build (`c42eb78`, `4ae9625`)

- **Data access:** `api.js` is the only module that touches the network. It has a live mode (relative paths, proxied to `localhost:8000` in dev) and a samples mode (answers from `learning/samples/`).
- **Screens:** participant code, topic picker, review home, lesson, question, feedback, follow-up and summary, as specified in Team_Spec and UI_Guidelines.

### 2. End-to-end test (`5c3a832`)

`npm run e2e` drives headless Chrome at phone size against the real service. It fakes `/video-jobs` with a 2-second clip, so playback events were tested before Member 1's service existed. Also fixed: objective rows now wrap at the largest text size.

### 3. Time on app (`b921e62`, `0a90b93`)

`heartbeat` sends one event per 30 s of time the app is on screen. The leftover seconds under 30 are saved when the page is hidden and restored within 5 minutes, so a refresh no longer loses them. That changes how time on app is measured, so the build became `study-2`.

### 4. Comparison with the React + TS version

I judged the two Member 3 apps against Team_Spec, the validation plan, the session guide and UI_Guidelines. I didn't use Member3_SPEC, because only the JS version was built from it.

**Verdict:** keep the JS app for the study.

The React + TS app (`origin/member3`) has 189 unit tests passing, but it isn't usable for the study:
- `App.tsx` renders only a heading, so there's no flow to test for H1.
- It doesn't match the API contract:
  - It calls absolute `http://localhost/api` paths.
  - It reads `/topics` as a bare list, but the server sends an object.
  - It reads errors in the wrong shape.
- Its event fields (`participant_code`, `client_timestamp`) don't match the events.csv columns. Every event would get `400`, so H3 couldn't be measured.
- It has no heartbeat.
- It has the purple accent colour that UI_Guidelines lists as a tell of a generated UI.

### 5. Finishing pass (`abdee85`)

- **Restart on home:** the moderator's scripted task starts with "Tap Restart". Completed and needs-review rows now have Restart, with See summary as a link. Before, a participant on the home page had to look for the button, and a moderator explaining it would count as help under H1.
- **Sample clip:** samples mode plays the e2e clip instead of a file that doesn't exist.
- **e2e update:** it now expects the validation build: DNA repair available, transcription and translation coming soon.
- **[web/README.md](../web/README.md):** how to run, test, test on a phone, freeze and hand off.
- **Push:** `origin/member3` holds the React version and shares no history with this one. I fast-forwarded `MVP02` instead and left `origin/member3` untouched.

### 6. Vertical swipe player, build `study-4` (notes.md, 2026-11-03)

The lesson screen is now a full-screen feed of 9:16 clips.

| Task (notes.md) | Done |
| --- | --- |
| 1. Swipe player | Native CSS scroll snapping does the swiping, with no gesture library. The overlay has progress segments that fill as the clip plays, "Clip 2 of 5", side buttons (Replay, Captions, Transcript), and the bottom bar. Everything sits in the contract's safe zones, as percentages of the 9:16 frame |
| 2. Flow | The intro clips play in order. Swiping past the last one opens the question, and **Answer the question** is always available. Follow-ups use the same player as a one-clip feed, then the retry question |
| 3. Loading | Each clip's job starts when its slide comes on screen, and the next clip's job and video load straight after. Job IDs are saved per variant, so a refresh polls instead of starting over. Failure and Retry work per slide |
| 4. Events | `video_started` / `video_completed` once per view (a loop doesn't repeat them), plus `clip_swiped` with variant, direction and seconds watched |
| 5. Feel | Muted autoplay, one tap for sound for the rest of the feed, loop until swiped, "Swipe up" on clip 1 only, a 220 ms "Correct" animation and a 30 ms vibration. No points or streaks. Reduced motion turns the animation off |
| 7. Build and tests | e2e cases 17, 17b and 17c (swiping, order, preload, refresh mid-feed, swipe into the quiz, v2 follow-up). Build ID `study-4`. `video-flow.mjs` and `video-real.mjs` now expect the portrait clips: 720×1280, 15–30 s |

**Bugs found while testing:** the overlay first rendered off screen, because `.feed .frame` overrode the overlay's `position: absolute`. I caught it from a screenshot, and fixed it by giving the overlay its own selector. The e2e helper also clicked the first Retry on the page, which could be the preloaded clip 2's, and that scrolled the feed. It now retries clip 1 only.

**Tests:** `npm run e2e` passes all 19 checks against the production build, plus `npm run check` and `e2e/heartbeat.mjs`. They ran on ports 8020 and 5191, because another session's dev server was on 5180.

**Not done, and why:**
- The real-phone pilot check (task 6) needs Member 1's portrait pilot clip.
- Sending the build to Member 2 via `deploy-dist` should wait for the intro clips. Deployed now, every intro slide would fail to load.

## Commits

| Commit | Change |
| --- | --- |
| `c42eb78` | Scaffold `web/`, data-access module |
| `4ae9625` | Screens, progress storage, events, Reset demo |
| `5c3a832` | e2e test, playback events, large-text fix |
| `b921e62` | Heartbeat in the app, e2e case 16 |
| `0a90b93` | Heartbeat leftover kept across a refresh, build `study-2` |
| `abdee85` | Restart on home, playable sample clip, web README |
| *(this commit)* | Vertical swipe feed, `clip_swiped`, Correct animation, build `study-4` (section 6) |

## Open question

`topic_selected` fires when the student taps **Start** on an objective, not when they tick a topic in the picker. That gives the "opened DNA repair on Day 0" count the validation plan needs. Confirm with the team that this is what they meant.

## Next steps for Member 3

None of these is coding. Each waits on Member 1's clips or the content review.

0. **Vertical clips:** when Member 1's portrait pilot clip lands, test it on a real iPhone (Safari) and Android phone (Chrome): inline playback, the sound tap, captions, and nothing overlapping the overlay. Once all intro clips are in, run `e2e/video-flow.mjs`, then `npm run build` and push `dist/` to `deploy-dist` for Member 2.
1. **Run with the real video service:** Member 1's `video/jobs.py` and clips are merged. It also changed `web/src/main.js` and `web/vite.config.js`, and added `web/e2e/video-real.mjs`. Run the e2e with the real `/video-jobs`.
2. **Check the clips in the app:** the initial clip, both follow-ups, the transcripts, and the pre-rendered disclosure, for both lessons.
3. **Phone test** of the full walkthrough on the hosted site.
4. **Final freeze:** after the content review passes, set a new `BUILD_ID` if anything changed. Then `npm run build` and the e2e against `npm run preview`, then send `dist/` to Member 2 to upload.
