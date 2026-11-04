# Member 1: video generation and visual consistency

Implements the Member 1 section of [Team_Spec](../Context/Team_Spec.md).
This branch is based on `MVP02`; it does not merge the separate React app on
`member3`. Six fixed-script, narrated review clips are included. No LLM writes
student-facing content and no paid service or API key is needed.

## Vertical clips (v2, Context/notes.md): pilot stage

**Status:** one pilot clip, `dna_replication.intro_2` (19.0 s, 720×1280, ElevenLabs voice Liam). Per notes.md the other
31–35 clips are not scripted until the pilot passes Member 3's phone check and the product owner's
"does this feel like TikTok, and is it clear?" check. The landscape clips below are legacy and will be replaced.

Pipeline (`python video/render.py --topic dna_replication --variant intro_2`):

1. **Voice:** `tts.py` sends the fixed narration to ElevenLabs (`/v1/text-to-speech/{voice}/with-timestamps`,
   model and voice in `template.json` → `tts`) and gets audio plus when each character is spoken. Results are
   cached in `video/.cache/tts/`, so re-rendering never re-spends credits. The key is read from `video/.env`
   (`ELEVENLABS_API_KEY=...`, git-ignored; needs only *Text to Speech* and *Voices: read*).
   `CLIPCADEMY_VOICE=espeak` renders an offline draft instead; drafts get a different fingerprint.
2. **Beats:** each script scene lists `beats` (spoken cue → actions such as `label:5`, `extend`, `zoom:new_3`,
   `pose:thumbs`, `card:…`). `beats.py` resolves them to the spoken times, schedules the nucleotides clicking on,
   and refuses a clip that is outside 15–30 s or has more than 3 s with no on-screen change.
3. **Sound:** `sfx.py` mixes sound effects under the narration.
4. **Frames:** Remotion (`video/remotion`, pinned to 4.0.537, React 18.3.1) draws the stick-figure guide (SVG),
   the DNA board, the cards and TikTok-style burned-in captions (1–3 words, spoken word in yellow), keeping
   the app's safe zones clear (top 120 px, right 120 px, bottom 200 px; captions in y 760–1000). Run
   `cd video/remotion && npm ci` once. Rendering needs Node 18+ on the laptop only; the host serves MP4s.

Outputs per clip: MP4, `.vtt` (sentence-sized cues), `.txt` transcript and a `.json` manifest with
`width`, `height`, duration, voice, visuals, longest still stretch and the fingerprint for review.
`python video/tts.py --voices` lists the voices the key can use. A 19 s clip renders in about 10 s.

**Sound sources:** every sound is synthesized by `video/sfx.py` from sine waves and seeded noise. No third-party or
sampled audio is used: the 1-second series sting (two rising notes, every clip), pop (labels, highlights, cards),
click (a piece joining the strand), whoosh (zoom, arrow) and boing (a piece that can't join). No music bed yet.

**Review notes:** each vertical script carries `review_notes` with the hook's source claim and the analogy, so the
reviewer can check both items notes.md adds for every clip.

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
(Lead, on merge into MVP02: DNA repair is already `available` there, so all six
clips are reachable in the app. Without the preview flag they 403 until approved,
which the UI shows as "The clip couldn't load." with Retry.)

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

All six clips are 960×540, 24 fps H.264/yuv420p with AAC narration, 44.8–55.2
seconds each. Total MP4 size is 9,612,776 bytes (9.17 MiB, bytes / 1,048,576).
Each manifest records duration, file hash, exact transcript, source references,
synthetic voice and fingerprint. Captions use the same words as narration, timed
from eSpeak's own word events (when each word is actually spoken), and the line
on screen highlights the word being spoken. Check their timing during human review.

## Animation

`render.py` narrates each scene, recording when each word is spoken, then
`animation.py` draws every frame. Scenes are choreographed in the scripts, not in
code: each scene has a `stage` (what is on screen at the start) and `beats`, where a
spoken cue triggers named actions, e.g.

```json
{"on": "primase", "do": ["primase_build", "point:primase", "card:Primase makes the start"]}
```

- **Guide:** the same stick figure (green bow tie) in every clip. Walks in and waves,
  points at whatever is named, shrugs or thinks with a `?` when something cannot
  happen, wags a finger at a misconception, thumbs-up at the end. Mouth follows the
  narration's loudness, eyes follow the pointing target, it blinks and breathes.
- **Process:** DNA polymerase, primase and repair proteins are labeled shapes that
  move. Polymerase tries and fails on a bare template, primase lays the RNA primer,
  nucleotides fly in and join the 3′ end, wrong bases are added and excised, UV
  bonds adjacent bases and kinks the backbone, sections are cut out, refilled and
  resealed.
- **Attention:** close-ups (`zoom:<target>`) and orange highlight rings
  (`pulse:<target>`); summary cards (`card:`) only repeat the narration's claim.

Rules are in `template.json` (`guide`, `motion_rules`). `test_animation.py` fails if
a cue is not in the narration or a target does not exist. To check a single frame
without audio: `python -c "import render,json;render.preview(render.load_script('dna_replication','initial'),2,6.0,'f.png')"`.
Set `CLIPCADEMY_FONT_DIR` if DejaVu Sans is not installed system-wide.

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
python -m unittest discover -s video -v   # includes test_animation.py
python -m unittest discover -s learning -v
python video/check_assets.py
python learning/check_content.py
cd web
npm run check
npm run build
# With preview backend and Vite running:
CHROME=/path/to/chrome node e2e/video-real.mjs
CHROME=/path/to/chrome node e2e/video-flow.mjs
CHROME=/path/to/chrome npm run e2e
```

Verified on 2026-11-03: 10 video/integration tests and 48 existing learning tests;
all six files fully decoded with FFmpeg; ffprobe confirmed video/audio format and
duration; content consistency, frontend sample checks and production build passed.
The initial replication clip now has four scenes, including the required recap.
All six clips were re-rendered with the animated guide and word-timed beats;
sampled frames from every scene were visually inspected.

All three browser scripts above passed in local Chrome. The real-media checks
verified playback, seeking and captions; the real-interface check completed the
wrong-answer flow at 1280×900 and emulated 390×844 phone sizes, including refresh.
The broader interface suite verified errors, retries, persistence, duplicate
submission handling, event export and visible-time heartbeats. These are local
checks, not real-phone or deployed-host verification.

Member 3's latest fetched branch was checked separately: 189 tests and its build
passed, but `App.tsx` only renders a heading and its API configuration differs
from the real service. It is not an integrated replacement yet. See
[VERIFICATION.md](VERIFICATION.md) for evidence and remaining work, and
[CONTENT_REVIEW.md](CONTENT_REVIEW.md) for the human review handoff.
