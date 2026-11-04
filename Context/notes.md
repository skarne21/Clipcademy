# Notes for Member 1: vertical clips, 4–5 per topic

From the lead, 2026-11-03. These decisions came from the product owner. The **Contract changes** section needs Members 2 and 3 to agree before you rely on it.

## What changes

| | Today | Wanted |
| --- | --- | --- |
| Clips per topic before the quiz | 1 intro clip | **4–5 intro clips**, watched in order, then the quiz (same quiz flow as the MVP) |
| Length | 45–55 s | **15–30 s**, one idea per clip |
| Format | 960×540 landscape | **Vertical 9:16**, full-screen on a phone |
| Look | Captions in a track only | **TikTok style**: large burned-in captions, plus room for the app's side buttons and progress bar |
| Wrong answer | 1 follow-up clip per misconception, reused on the second cycle | **1 clip, then a retry question. Wrong again → a second, differently explained clip** (max 2 cycles, as today) |
| Topics | Replication and repair | **All 4**: replication, repair, transcription, translation |
| Old clips | 6 landscape clips | **Replace** them all; one format only |
| Deadline | | **Before the study (Day 0)**, rendered *and* content-reviewed |

Still fixed: every clip comes from a fixed, reviewed script. Wrong answers **select** a pre-made clip; nothing is generated live and no LLM writes anything (Team_Spec, line 9). Hosted mode stays `prerendered`.

## Clip count

Per topic: 4–5 intro clips, plus 2 misconceptions × 2 follow-up versions = **8–9 clips**. Across 4 topics: **32–36 clips** (today: 6).

Disk: at 720×1280, 15–30 s, roughly 1–1.5 MB each, that's about 50 MB. That's well inside PythonAnywhere's 512 MiB, but check after the first render.

### Proposed intro sequences

Each topic's sub-ideas, one per clip. **These are suggestions only.** Every claim must come from that packet's `source_excerpts` (`learning/packets/*.json`); anything not covered there goes to Member 2 first, not into a script.

| Topic (packet) | Intro clips | Follow-ups (v1 and v2 each) |
| --- | --- | --- |
| Replication (`synthesis_direction_and_primer`, L19-p1/p2) | 1 polymerase adds to the 3′ end · 2 so synthesis runs 5′→3′ · 3 it can't start on a bare template · 4 primase lays an RNA primer · 5 recap | `growth_direction`, `primer_requirement` |
| Repair (`error_correction`, L20-p1) | 1 proofreading during synthesis · 2 mismatch repair after synthesis · 3 UV bonds adjacent bases · 4 the damage is cut out and refilled · 5 recap | `repair_timing`, `uv_damage` |
| Transcription (`template_strand_and_promoter`, L21-p1) | 1 RNA polymerase reads the template strand · 2 template vs coding strand · 3 the promoter marks where to start · 4 recap | `template_vs_coding`, `promoter_role` |
| Translation (`codon_pairing_and_ribosome_sites`, L22-p1/p2) | 1 codon–anticodon pairing · 2 A site · 3 P site · 4 E site · 5 recap | `site_roles`, `anticodon_pairing` |

The v2 follow-up must explain the same misconception **a different way** (another diagram or analogy, not the same narration re-cut). Its source refs stay inside the packet.

## Video spec

- **720×1280, 9:16**, H.264 yuv420p + AAC, 24 fps as now. 1080×1920 only if file sizes stay small.
- **15–30 s.** One idea, one guide action, one summary card at most.
- **Same guide and template** (green bow-tie stick figure, colors, voice). Update `template.json` for portrait: the guide and diagram stack vertically instead of side by side.
- **Burned-in captions:** large, centered, word-by-word highlight like you already do, 2 lines max. **Keep the `.vtt` and `.txt`** too: screen readers and the transcript button use them.
- **Safe zones** (Member 3's UI draws over these, so keep diagrams and captions out of them). At 720×1280:
  - top 120 px: progress bar ("Clip 2 of 5")
  - right 120 px: side buttons (replay, captions, transcript)
  - bottom 200 px: swipe hint and the app's controls
  - Put captions in roughly y = 760–1000.
- **Each clip must make sense alone.** Students can swipe back and forth, so a clip can't depend on "as we just saw".

## Contract changes (to agree with Members 2 and 3)

The existing ones (POST `/video-jobs` → job, poll, `video_url`, `captions_url`, `transcript`) stay. What's new:

1. **Variant IDs.** Proposed: intro clips `intro_1` … `intro_5`, follow-ups `<misconception>_followup` (v1) and `<misconception>_followup_2` (v2).
2. **Member 2:** the packets list the intro sequence (e.g. `"intro_variant_ids": [...]`) and a second follow-up variant per misconception. `/topics` returns the ordered intro requests instead of the single `initial_video_request`. `/attempts` returns the v2 variant on the second cycle.
3. **Member 3:** a vertical swipe player (full screen, swipe up/down between intro clips, side buttons, progress). After the last intro clip, the quiz opens. Follow-up clips use the same player.
4. **You (`jobs.py`):** nothing structural. The catalog grows from the new script files. Add `width`/`height` (and optionally `orientation`) to the ready response so the UI can check the format.

## Review and release

- Each new clip gets a row in `Context/content-audit.csv`. Its `approved_version` must equal the clip's fingerprint, exactly as today (see `video/CONTENT_REVIEW.md`). 32–36 clips means a lot of reviewer time, so get scripts to the reviewer **before** rendering, as text, to catch content problems early.
- The live site currently runs with `CLIPCADEMY_VIDEO_PREVIEW=1` and `/media/` mapped, for team testing only. Before Day 0, the flag goes off and only approved clips are deployed.
- Transcription and translation are `coming_soon` and their packets are `draft`. Member 2 has to make them `available` once their content is reviewed.

## Housekeeping while you re-render

- `render.py` reads scripts with `read_text()`, which uses cp1252 on Windows. Please change it to `read_text(encoding='utf-8')` (and `write_text(..., encoding='utf-8')`). I didn't change it on merge, because the fingerprint includes `render.py` itself and an edit would have marked all six clips stale. Since everything is being re-rendered anyway, now is the time. `jobs.py` already has this fix.
- `.gitattributes` now keeps `video/*.py` and `video/**/*.json` LF, so Windows checkouts don't change fingerprints.
- Delete the old landscape files in `video/media/` in the same commit that adds the vertical ones, so `check_assets.py` stays green.

## Suggested order

1. Agree on the variant IDs above with Members 2 and 3 (one message).
2. Change the portrait template and render **one** replication intro clip. Member 3 checks it in the swipe player on a real phone.
3. Write all scripts, then send them to the content reviewer as text.
4. Render all of them, update `check_assets.py` and the tests, commit, and push.
5. Member 2 deploys (`git pull` on PythonAnywhere, then Reload); then a phone check on the live site.

## Open questions for you

- How long does one 30 s portrait clip take to render? That decides whether 36 clips can be redone easily after review edits.
- Does eSpeak's voice hold up at TikTok pace, or does narration need to be faster or trimmed?
- Can the v2 follow-ups reuse the v1 diagrams with different beats, or do they need new diagram types in `animation.py`?
