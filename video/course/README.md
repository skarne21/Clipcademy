# Course import: any class's material → stick-figure clips

User stories US-24 to US-29 (requirement R8). This folder turns a class's lecture PDFs or notes into ClipCademy stick-figure clips:

1. **Gemini** breaks the material into learning objectives and a clip plan.
2. **Gemini** storyboards each clip.
3. **ElevenLabs** voices it.
4. **Remotion** draws it with the same guide, board and captions as the biology clips.

**The existing 35 clips are never changed.**
- The code lives in `video/course/` and `video/remotion/course/`.
- Generated clips go to `video/courses/<course>/`.
- None of these are inputs to the existing clips' fingerprints. `test_isolation.py` checks that all 35 still match.

## Use it

```sh
# once: add your Gemini key next to the ElevenLabs one (video/.env is git-ignored)
echo 'GEMINI_API_KEY=...' >> video/.env          # https://aistudio.google.com/apikey

# 1. material → clip scripts (pending review)
python3 video/course/generate.py --course econ101 --title "Intro Economics" --material lecture3.pdf notes.md

# 2. scripts → videos (free offline draft voice first, then the real voice)
CLIPCADEMY_VOICE=espeak python3 video/course/render_course.py --course econ101 --all
python3 video/course/render_course.py --course econ101 --all
```

**Supported material:** PDF (including slides exported as PDF), `.txt` and `.md`. Each PDF must be under 18 MB.

**Optional:** set `GEMINI_MODEL` to choose the model (default `gemini-2.5-pro`). The draft voice needs `pip install espeakng-loader`.

**Timing and cost:** one 20–25 s clip renders in about 12 s on a laptop. A real-voice clip costs about 350 ElevenLabs credits (about $0.05). Gemini makes one call for the breakdown, then one call per clip, plus one retry for any clip that fails the checks.

## What gets made

```
video/courses/<course>/
  material/        copies of the imported files
  breakdown.json   objectives, verbatim source excerpts, clip plans (for the reviewer)
  scripts/         one JSON per clip, review_status "pending"
  media/           MP4 + .vtt captions + .txt transcript + .json manifest (own fingerprint)
  report.json      clips written, and clips skipped with the reasons
```

## Scene templates

These are general-purpose scenes, so a clip can be about any subject. Gemini picks one per clip and fills in its text. It never invents visuals.

| Template | For | Props |
| --- | --- | --- |
| `steps` | Processes, procedures, phases | 2–5 steps (≤22 characters each) |
| `compare` | A vs. B | Two columns: a title (≤14) and 1–3 points (≤18) each |
| `flow` | Cause → effect, pathways | 2–4 nodes (≤16) joined by arrows |
| `term` | One new word | Term (≤18), plain meaning (≤40), example (≤40) |
| `myth_fact` | Correcting a wrong idea | Myth (≤36), fact (≤36) |

The full catalog that Gemini reads, with every action and target, comes from `templates.catalog_text()`.

## Checks before any voice credits are spent

`templates.validate()` rejects a clip if:
- its template, a prop, an action or a target is unknown;
- any text is over its limit;
- a cue isn't in the narration, or cues are out of order;
- the narration is outside 45–70 words, has symbols the voice misreads, or doesn't end with the required line.

A failing clip goes back to Gemini once with the exact errors. If it fails again, it's skipped and listed in `report.json`.

For text material, every source quote must appear word for word in the file, or that objective is dropped. PDF quotes are marked `excerpts_verified: false` for the reviewer to check.

## Review gate

**Everything generated is `pending`.** Gemini can't approve its own clip: the pipeline overwrites the IDs and the review status, whatever Gemini returns. No Gemini call ever happens during a student session.

**Not built yet:** serving approved course clips in the student app, which needs an audit row per clip like the biology clips have, and generating quiz questions for new courses.

## Tests

```sh
python3 -m pytest video/course    # 45 tests; the layout test renders real frames (needs npm ci in video/remotion)
```

---

## Where to host it

The student app on PythonAnywhere's free plan **can't run this pipeline**:
- **No rendering:** rendering needs Node and headless Chrome, which the free plan doesn't have.
- **Restricted internet access:** free accounts can only reach an allowlist of sites, so Gemini calls aren't guaranteed to work.

**Recommended setup: keep the app where it is, and add a rendering worker on Google Cloud.**

| Piece | Where | Why |
| --- | --- | --- |
| Student app + learning API (SQLite) | **PythonAnywhere** (as now; the $5/month plan if the upload page lives there, for unrestricted internet access) | It already works, and its SQLite file persists |
| Generate + render worker | **Google Cloud Run Job**: one Docker image with Python, Node, Remotion's Chrome and this repo | Runs only when material is imported and costs nothing when idle. Gemini keys live in the same Google account. A clip takes about 12 s of CPU |
| Clip files | **Google Cloud Storage** bucket | Rendered MP4s, captions and manifests, served to the app after approval |
| Keys | **Secret Manager** (`GEMINI_API_KEY`, `ELEVENLABS_API_KEY`) | Keys stay out of the image and the repo |

**How an import would flow:**
1. A teacher uploads a file in the app.
2. The app stores it and starts the Cloud Run Job.
3. The job runs `generate.py` and then `render_course.py`.
4. The job uploads the media to the bucket.
5. A reviewer approves each clip.
6. The app plays approved clips from the bucket.

**Simpler alternative:** move everything to a single Docker host with a background worker, such as Railway, Render or Fly.io. The SQLite database then needs a persistent volume.

**Remotion's licence** is free for individuals and companies of up to 3 people. A bigger company needs a paid licence (remotion.dev/license).
