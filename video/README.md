# Member 1: video generation and visual consistency

Implements the Member 1 section of [Team_Spec](../Context/Team_Spec.md).
This branch is based on `MVP02`; it does not merge the separate React app on
`member3`. Six fixed-script, narrated review clips are included. No LLM writes
student-facing content and no paid service or API key is needed.

## Run the team preview

From the repository root (Python 3.10+):

```sh
CLIPCADEMY_VIDEO_PREVIEW=1 python learning/app.py
```

In a second terminal:

```sh
cd web
npm ci
npm run dev
```

Open the URL printed by Vite. Its proxy includes `/media`, so video playback,
seeking, captions and API calls use the same origin. Previously rendered mode
needs only Python's standard library; Pillow, eSpeak and FFmpeg are needed only
when rendering new clips. DNA repair remains Coming soon in Member 2's topic
catalog. Its three clips are ready for review through the API, but enabling that
topic belongs to the team's existing content-review process.

`CLIPCADEMY_VIDEO_PREVIEW=1` is for team review only. Without it, requests are
rejected with 403 until the packet is `reviewed` and the clip's audit row is
`approved`, has a reviewer, and has `approved_version` equal to the fingerprint
in the clip's manifest. Nothing was marked reviewed or approved by this work.
The checked-in assets visibly say Review copy. Do not publish the preview flag or
map unapproved files to a public static directory for participants.

## Files and tasks

| Member 1 task | Implementation |
| --- | --- |
| Shared character, colors, fonts, labels, voice | `template.json`, `render.py:frame` |
| Source excerpts and replication scripts | Existing replication packet in `learning/packets`; three fixed scripts in `scripts/` |
| Renderer and immediate job ID | `render.py`, `jobs.py`; asynchronous local mode |
| Narration and matching transcript | AAC audio, embedded captions, `.txt` and `.vtt` beside each MP4 |
| Primer follow-up | `scripts/dna_replication.primer_followup.json` and matching media |
| Two requests, outputs, failed example | `samples/initial.json`, `primer_followup.json`, `failed.json` |
| Three repair clips | `dna_repair.initial`, `timing_followup`, `uv_followup` in `media/` |

All six clips are 960×540 H.264/yuv420p with AAC narration, approximately 43–46
seconds each. Total MP4 size is 4,991,952 bytes (4.76 MiB, bytes / 1,048,576).
Each manifest records duration, file hash, exact transcript, source references,
synthetic voice and fingerprint. Captions use the same words as narration, grouped
into short chunks with estimated timing within each separately narrated scene;
they are not word-level forced alignments. Check their timing during human review.

## Render locally

Install FFmpeg (including ffprobe) on the laptop and DejaVu Sans fonts. Then:

```sh
python -m pip install -r video/requirements.txt
python video/render.py --all
# Or one variant:
python video/render.py --topic dna_replication --variant primer_followup
python video/check_assets.py
```

The renderer accepts the fixed script's text, scene/diagram IDs and template
parameters internally. Public API callers select a catalog variant, never supply
arbitrary narration, commands or paths. Source excerpts stay in Member 2's lesson
packets, avoiding a divergent copy. All referenced passages are listed there.

To demonstrate asynchronous rendering instead of reusing the included assets:

```sh
CLIPCADEMY_VIDEO_PREVIEW=1 CLIPCADEMY_VIDEO_MODE=live \
CLIPCADEMY_MEDIA_DIR=/tmp/clipcademy-live-media \
CLIPCADEMY_VIDEO_DB=/tmp/clipcademy-live-jobs.db python learning/app.py
```

Send one of the sample request bodies. POST returns `202` with `queued`; poll the
job to observe `running` and then `ready` or `failed`. Live rendering is bounded to
one worker, with a 300-second subprocess timeout. A process interrupted during a
job is reported failed after 360 seconds and can be retried. Shut down the local
server before deleting its cache/database. **Do not use live mode on PythonAnywhere.**

## HTTP contract

- `POST /video-jobs`: required `topic_id`, `objective_id`, `variant_id`,
  `teaching_goal` and `source_refs`. IDs and references must match a catalog entry.
  The teaching goal is descriptive; the selected script is always the fixed one.
- `GET /video-jobs/{job_id}`: persistent job state. Unknown IDs return 404.
- Ready response: `job_id`, `status`, topic/objective/variant IDs, `source_refs`,
  `video_url`, `captions_url`, `transcript`, `duration_seconds`, `review_status`,
  `source: "prerendered" | "generated"`.
- A completed repeated request reuses the same asset and job ID (`200`,
  `cache_hit: true`). Concurrent queued/running requests reuse the job (`202`).
- Failed jobs include a plain `error` string and no playable URL. Retrying the
  same POST after fixing the underlying problem makes a new job.
- Request errors use the shared `{"error":{"field":"...","message":"..."}}`
  body. Malformed requests are 400, oversized requests 413, wrong methods 405.
- `GET`/`HEAD /media/{file}` supports byte ranges locally. The hosted static
  mapping serves the same media. Job IDs in samples are illustrative recorded
  outputs from an isolated database, not jobs installed in another environment.

The existing `learning/app.py` loads `video/jobs.py:application`. No extra video
server is necessary. `CLIPCADEMY_ALLOWED_ORIGINS` applies to video responses too.
Optional settings: `CLIPCADEMY_MEDIA_DIR`, `CLIPCADEMY_MEDIA_URL`,
`CLIPCADEMY_VIDEO_DB`; defaults are `video/media`, `/media/`, `video/.cache/jobs.db`.

## Hosted handoff

1. Finish the course-knowledgeable content audit. Review both diagrams and audio,
   not just the transcript. Put each clip manifest's fingerprint in its
   `approved_version` audit cell, retaining the reviewer identity.
2. Run `python learning/check_content.py --freeze`. It currently fails as
   expected because the repository's approval records are pending.
3. Deploy reviewed assets only; map `/media/` to the approved media directory.
   Use `CLIPCADEMY_VIDEO_MODE=prerendered`, no preview flag, and the existing WSGI
   application. Keep `.cache/jobs.db` writable and persistent for refresh polling.
4. For Member 3's React branch, preserve the same paths and response fields;
   add optional `source`, `captions_url`, and `review_status` fields to its type.
   Its initial teaching-goal wording differs but is accepted. No React files
   were changed on this branch.
5. Verify the deployed flow on a real phone before the study.

## Verification

```sh
python -m unittest discover -s video -v
python -m unittest discover -s learning -v
python video/check_assets.py
python learning/check_content.py
cd web
npm run check
npm run build
# With preview backend and Vite running:
CHROME=/path/to/chrome node e2e/video-real.mjs
CHROME=/path/to/chrome npm run e2e
```

Verified here: 10 video/integration tests and 48 existing learning tests; all six
files fully decoded with ffmpeg; ffprobe confirmed video/audio format and duration;
content consistency, frontend sample checks, production build and diff whitespace
checks passed. A representative rendered frame was visually inspected.

Browser tests were attempted but **not executed**: Chromium failed to launch with
`socket() failed: Operation not permitted`. The included real-media browser test
checks actual playback, seeking to completion, captions and the real backend's
wrong-answer flow. The existing interface suite now injects its failure scenario
explicitly rather than assuming the video service is absent. Phone playback,
subject-expert approval and hosted deployment remain unverified.
