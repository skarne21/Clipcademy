# Member 1: video generation and visual consistency

Implements the Member 1 section of [Team_Spec](../Context/Team_Spec.md).
Thirty-five fixed-script, vertical (720×1280) narrated clips are included, following
[notes.md](../Context/notes.md). No LLM writes student-facing content. Playing the prerendered clips needs only
Python's standard library; rendering new ones needs Node 18+, an ElevenLabs API key and (for checks) FFmpeg.

## Vertical clips (v2, Context/notes.md)

**Status:** all 35 vertical clips from the packets are scripted and rendered (replication 9, repair 9,
transcription 8, translation 9: 4–5 intro clips per topic plus v1 and v2 follow-ups per misconception), with the
ElevenLabs voice Liam. All are **pending content review**: the reviewer works from
[SCRIPTS_FOR_REVIEW.md](SCRIPTS_FOR_REVIEW.md) (narration, hook claim and analogy per clip). Scripts are written by
`write_scripts.py`, which reads teaching goals and source references from the packets. The landscape clips from the
first MVP have been removed. Member 3's phone check of the pilot (`dna_replication.intro_2`) is still to do.

Diagrams (`remotion/src/scenes/`): `strand` (replication: primer, polymerase, 3′ growth), `repair` (proofreading,
mismatch repair, UV bond and bulge, cut/replace/reseal), `transcription` (promoter, opening, RNA built on the template
strand), `translation` (ribosome E/P/A sites, tRNA pairing, peptide bond, shift, exit) and `timeline` (during vs
after copying). Enzymes are small characters with faces so each molecule reads as an actor.

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
seeking, captions and API calls use the same origin. Restart `learning/app.py` after adding or
re-rendering clips: the video catalog is read at startup. Transcription and translation are `coming_soon`
in Member 2's topic catalog; their clips are ready through the API for review.

`CLIPCADEMY_VIDEO_PREVIEW=1` is for team review only. Without it, requests are
rejected with 403 until the packet is `reviewed` and the clip's audit row is
`approved`, has a reviewer, and has `approved_version` equal to the fingerprint
in the clip's manifest. Nothing was marked reviewed or approved by this work.
The checked-in assets visibly say Review copy. Do not publish the preview flag or
map unapproved files to a public static directory for participants.

## Files and tasks

| Member 1 task (notes.md) | Implementation |
| --- | --- |
| Portrait template, safe zones | `template.json`, `remotion/src/theme.ts`, `remotion/src/Clip.tsx` |
| Burned-in captions, `.vtt`, `.txt` | `Clip.tsx` (1–3 words, spoken word highlighted); `render.py` writes `.vtt` and `.txt` |
| Hook from frame 1, change every 2–3 s | Hook title from frame 1; `beats.py` rejects >3 s with no change and fills long gaps with a guide gesture |
| Voice and sound | `tts.py` (ElevenLabs, voice Liam, cached); `sfx.py` (our own sounds, series sting) |
| Pilot clip | `scripts/dna_replication.intro_2.json` |
| Scripts, reviewer text | `write_scripts.py` writes `scripts/*.json` and [SCRIPTS_FOR_REVIEW.md](SCRIPTS_FOR_REVIEW.md) |
| All clips, tests | `media/` (35 clips), `check_assets.py`, `test_beats.py`, `test_jobs.py`, `test_integration.py` |
| `width`/`height` in ready response | `jobs.py` |
| UTF-8 file I/O | `render.py`, `beats.py`, `tts.py`, `write_scripts.py` |
| Two sample requests and outputs, one failure | `samples/initial.json` (`intro_1`), `samples/primer_followup.json`, `samples/failed.json` |

## Render locally

```sh
cd video/remotion && npm ci && cd ../..         # once
printf 'ELEVENLABS_API_KEY=\n' > video/.env      # then paste the key after = (git-ignored)
python3 video/write_scripts.py                   # after editing scripts in write_scripts.py
python3 video/render.py --topic dna_replication --variant intro_2
python3 video/render.py --all
python3 video/check_assets.py                    # needs ffmpeg and ffprobe on PATH
```

Narration is cached by text and voice settings in `video/.cache/tts/`, so re-rendering after a visual change spends
no credits; changing a script's narration does (1 credit per character). The 35 narrations total 12,019 characters;
this round spent about 15,000 credits including voice samples and re-takes. One clip renders
in about 10 s (19–30 s clips at 24 fps). `CLIPCADEMY_VOICE=espeak` makes a free offline draft with its own fingerprint.

## HTTP contract

- `POST /video-jobs`: required `topic_id`, `objective_id`, `variant_id`,
  `teaching_goal` and `source_refs`. IDs and references must match a catalog entry.
  The teaching goal is descriptive; the selected script is always the fixed one.
- `GET /video-jobs/{job_id}`: persistent job state. Unknown IDs return 404.
- Ready response: `job_id`, `status`, topic/objective/variant IDs, `source_refs`,
  `video_url`, `captions_url`, `transcript`, `duration_seconds`, `width`, `height`,
  `review_status`, `source: "prerendered" | "generated"`.
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
python3 -m unittest discover -s video -v
python3 -m unittest discover -s learning -v
python3 video/check_assets.py
python3 learning/check_content.py
```

Verified on 2026-11-04: 15 video tests pass, including the mounted wrong-answer flow over every replication intro
clip; 51 learning tests and the content check pass; all 35 clips decode fully and are 720×1280 H.264 + AAC,
18–30 s, with a longest still stretch of 1.7–2.6 s. Every intro and follow-up request from `/topics` and the packets
(19 intro, 16 follow-up) returns a ready clip in preview mode. Frames from every clip were inspected.
Not yet done: Member 3's real-phone check, product-owner sign-off and the content review.
