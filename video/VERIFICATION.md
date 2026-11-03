# Member 1 requirement verification

Checked 2026-11-03 against [Team_Spec.md](../Context/Team_Spec.md).
This is technical verification, not course-expert approval or study release approval.

## Requirement evidence

| Requirement | Evidence and status |
| --- | --- |
| Shared character, colors, labels, fonts and narration | `template.json`, `render.py` and `animation.py`; shared animated guide and word-timed beats used by all six clips. Sampled frames from every scene visually inspected. Full subject review remains pending. |
| Initial replication storyboard has four scenes | `scripts/dna_replication.initial.json`: antiparallel strands, 3′ growth, primer, separate recap. Regenerated initial clip is 52.96 seconds in ffprobe. |
| Narrated initial and targeted clips | Six H.264/AAC assets decoded successfully; transcripts match canonical scripts. All are 960×540 at 24 fps, 44.79–55.17 seconds, total 9,612,776 MP4 bytes. |
| Same guide and relevant primer follow-up | Real Chrome played both initial and primer follow-up with captions; requests retain their catalog IDs and source references. |
| Immediate job ID, preparing/ready/failed, caching and retry | Ten video/integration tests passed, including async state transitions, failed job retry, duplicate requests, interrupted jobs, review gate and media ranges. Async tests use controlled workers; this run regenerated the initial clip with the standalone renderer. |
| Two requests/results and failed example | `samples/initial.json`, `samples/primer_followup.json`, `samples/failed.json` remain included. |
| Source and content consistency | `python3 learning/check_content.py` passed. This checks data consistency, not biological correctness. |
| Learning service behavior | All 48 tests passed, including fresh retries, required questions, two-cycle limit and attempt idempotency. |
| Current frontend | `npm run check` and `npm run build` passed after dependency installation. |
| Browser errors, persistence and study events | `web/e2e/run.mjs` passed in Chrome, including failed-video retry, no answer leak, duplicate submit, wrong-answer branch, two-cycle stop, refresh, stale navigation, offline events, reset, CSV export and heartbeat visibility checks. This suite controls video responses for error scenarios. |
| Real media and services | `web/e2e/video-real.mjs` passed: initial and primer clips played, advanced and ended; captions fetched; real attempts completed the objective. |
| Full interface using real media and services | `web/e2e/video-flow.mjs` passed at 1280×900 and emulated mobile 390×844: initial → correct direction → wrong primer → primer clip → fresh rep-r2 → complete → refresh → home. No page errors or lesson horizontal overflow. |
| Publication/content approval | **Pending.** `python3 learning/check_content.py --freeze` fails because packets, clips, questions, feedback and assessment items lack approvals. Nothing was marked approved. |
| DNA repair validation lesson | Three media variants passed decoding checks; topic remains Coming soon pending review and team enablement. The two-lesson validation build is not release-ready. |
| Real phone and deployed host | **Pending.** Mobile Chrome emulation does not verify iOS/Android hardware, phone audio, deployed media mapping or hosted bandwidth. |

## Member 3 integration findings

Fetched `origin/member3` from GitHub and inspected commit
`5ccbcac853f6cab1a2693b1bb07515b7e748af0c` in an isolated copy.
All 189 component/unit tests and its production build passed. That does not prove
an integrated application: `web/src/App.tsx` currently returns only a heading.

The current `member1` preview is integrated and passed the real UI checks above.
Before substituting Member 3's React frontend, its owner needs to:

1. Connect the existing screens, navigation, API client and stored progress in `App.tsx`.
2. Disable MSW for real-backend checks; `.env.development` currently enables mocks.
3. Use the browser origin and the contract's unprefixed paths. Its client currently hardcodes `http://localhost/api/...`, and Vite has no API/media proxy. Proxy `/topics`, `/questions`, `/attempts`, `/events`, `/video-jobs` and `/media` to port 8000 locally.
4. Unwrap `{ topics: [...] }` from `GET /topics`; the current React client expects an array directly. Preserve each objective's `initial_video_request`.
5. Align events (`participant_id`, `client_timestamp_utc`) and nested error bodies with the actual service. React currently sends `participant_code` and `client_timestamp` and expects flat errors.
6. Accept video `source`, `review_status` and `captions_url`; connect captions, accurate prepared/generated disclosure, and failed-playback handling. Preserve hash routes and retry/refresh behavior.
7. Rerun the real-backend walkthrough against the connected React app. Its existing isolated component tests are useful but insufficient for this acceptance step.

No React branch was merged or overwritten, and no changes were pushed or deployed.

## Human handoff

Use [CONTENT_REVIEW.md](CONTENT_REVIEW.md) for clip links, exact fingerprints,
reviewer fields and phone checks. Approval requires the course-knowledgeable
reviewer specified by the team; automated checks cannot supply that approval.
