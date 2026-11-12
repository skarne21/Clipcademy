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

**Teachers and students:** the course platform (`learning/courses.py`, `learning/course_worker.py`, `/teach.html` and `/class.html`) runs this pipeline from a web page. It also generates quiz questions (`questions.py`), handles review and serves approved clips. See [DEPLOY.md](../../DEPLOY.md).

## Tests

```sh
python3 -m pytest video/course    # 45 tests; the layout test renders real frames (needs npm ci in video/remotion)
```

---

## Where to host it

See [DEPLOY.md](../../DEPLOY.md). It covers one Docker container with a disk at `/data` and three settings: `GEMINI_API_KEY`, `ELEVENLABS_API_KEY` and `CLIPCADEMY_TEACHER_TOKEN`.
