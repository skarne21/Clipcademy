# Vertical clips, 4–5 per topic: work split

From the lead, 2026-11-03. These decisions came from the product owner. Shared decisions first, then each member's tasks.

## Decisions (everyone)

| | Today | Wanted |
| --- | --- | --- |
| Clips per topic before the quiz | 1 intro clip | **4–5 intro clips**, watched in order, then the quiz (same quiz flow as the MVP) |
| Length | 45–55 s | **15–30 s**, one idea per clip |
| Format | 960×540 landscape | **Vertical 9:16**, full-screen on a phone |
| Look | Captions in a track only | **TikTok style**: full-screen swipe, large burned-in captions, side buttons, progress bar |
| Wrong answer | 1 follow-up clip per misconception, reused on the second cycle | **1 clip, then a retry question. Wrong again → a second, differently explained clip** (max 2 cycles, as today) |
| Topics | Replication and repair | **All 4**: replication, repair, transcription, translation |
| Old clips | 6 landscape clips | **Replace** them all; one format only |
| Deadline | | **Before the study (Day 0)**, rendered *and* content-reviewed |

Still fixed: every clip comes from a fixed, reviewed script. Wrong answers **select** a pre-made clip; nothing is generated live and no LLM writes anything (Team_Spec, line 9). Hosted mode stays `prerendered`.

**Clip count:** per topic, 4–5 intro clips + 2 misconceptions × 2 follow-up versions = 8–9. Across 4 topics: **32–36 clips** (today: 6), about 50 MB at 720×1280.

### Shared contract (agree first; blocks everyone)

- **Variant IDs:** intro clips `intro_1` … `intro_5`; follow-ups `<misconception>_followup` (v1) and `<misconception>_followup_2` (v2).
- **`/topics`** returns an ordered list of intro video requests per objective, `intro_video_requests: [...]`, in place of the single `initial_video_request`.
- **`/attempts`** returns the v1 follow-up request on the first wrong cycle and the v2 one on the second.
- **Ready job response:** unchanged, plus `width` and `height`.
- **Screen safe zones at 720×1280.** The UI draws here and clips keep it clear:
  - top 120 px: progress bar
  - right 120 px: side buttons
  - bottom 200 px: controls and swipe hint
  - Captions go in roughly y = 760–1000.

---

## Member 1: video (scripts, renderer, clips)

1. **Portrait template.** Change `template.json` and `animation.py` to 720×1280: the guide and diagram stack vertically, and everything stays out of the safe zones above. Same guide, colors and voice.
2. **Burned-in captions.** Large, centered, word-by-word highlight, 2 lines max. Keep writing `.vtt` and `.txt` (accessibility and the transcript button).
3. **One pilot clip first.** Render replication `intro_1` and send it to Member 3 to check in the swipe player on a real phone before scripting the rest.
4. **Write the scripts.** 15–30 s each, one idea each, and each clip must make sense alone (students swipe back and forth). Every claim comes from that packet's `source_excerpts`. Anything missing goes to Member 2, never straight into a script. Proposed sequences:

   | Topic (packet) | Intro clips | Follow-ups (v1 and v2 each) |
   | --- | --- | --- |
   | Replication (`synthesis_direction_and_primer`) | 1 polymerase adds to the 3′ end · 2 so synthesis runs 5′→3′ · 3 it can't start on a bare template · 4 primase lays an RNA primer · 5 recap | `growth_direction`, `primer_requirement` |
   | Repair (`error_correction`) | 1 proofreading during synthesis · 2 mismatch repair after · 3 UV bonds adjacent bases · 4 the damage is cut out and refilled · 5 recap | `repair_timing`, `uv_damage` |
   | Transcription (`template_strand_and_promoter`) | 1 RNA polymerase reads the template strand · 2 template vs coding strand · 3 the promoter marks the start · 4 recap | `template_vs_coding`, `promoter_role` |
   | Translation (`codon_pairing_and_ribosome_sites`) | 1 codon–anticodon pairing · 2 A site · 3 P site · 4 E site · 5 recap | `site_roles`, `anticodon_pairing` |

   The v2 follow-up explains the same misconception **a different way**, with another diagram or analogy, not the same narration re-cut.
5. **Send the scripts to the reviewer as text, before rendering**, so content fixes don't cost re-renders.
6. **Render all 32–36 clips.** Delete the old landscape files in the same commit. Update `check_assets.py` and the tests.
7. **`jobs.py`:** add `width`/`height` to the ready response. The catalog picks up the new scripts on its own.
8. **Housekeeping:** in `render.py`, change `read_text()`/`write_text()` to `encoding='utf-8'`. It was left unchanged on merge because the fingerprint includes `render.py`. Since everything is being re-rendered, now is the time.
9. **Answer for the team:** how long one 30 s clip takes to render; whether eSpeak holds up at this pace; whether the v2 clips need new diagram types.

## Member 2: content, API, hosting

1. **Packets.** For all 4 packets, add the ordered intro variants (`intro_1` …) with teaching goals and `source_refs`, and a second follow-up variant (`_followup_2`) per misconception. Add source excerpts wherever Member 1's scripts need a claim the packet doesn't cover yet.
2. **Transcription and translation.** Finish their draft packets and question banks so they can go from `coming_soon` to `available` after review.
3. **API.** `/topics` returns `intro_video_requests`. `/attempts` picks the v1 follow-up on the first wrong cycle and the v2 on the second. Update the samples, `check_content.py` and the tests.
4. **Content review.** Add a `content-audit.csv` row for each new clip (32–36) and get the reviewer booked now: this is the riskiest part of the schedule. `approved_version` = the clip's fingerprint, as today.
5. **Hosting.** After each video push: `git pull` on PythonAnywhere, keep `/media/` mapped, then Reload. The clips grow from 9 MB to about 50 MB; check the disk. Before Day 0:
   - turn `CLIPCADEMY_VIDEO_PREVIEW` off
   - make sure only approved clips are deployed
   - set the frozen build ID
   - run the freeze checklist in Member2_DEVLOG

## Member 3: web app (player and flow)

1. **Vertical swipe player.**
   - Full-screen 9:16 video.
   - Swipe up for the next intro clip, swipe down for the previous one.
   - A progress bar at the top ("Clip 2 of 5").
   - Side buttons on the right: replay, captions on/off, transcript.
   - Stay inside the safe zones in the shared contract.
2. **Flow.** The lesson plays the `intro_video_requests` in order, and after the last clip the quiz opens (same quiz screens as now). Follow-up clips for wrong answers open in the same player, then the retry question.
3. **Loading.** Request each clip's job when its slide comes up, and preload the next one. Keep the existing "couldn't load" + Retry state for each clip.
4. **Events.** Send `video_started`/`video_completed` per clip with its `variant_id`. Check `events.csv` still gives one row per clip view.
5. **Pilot check.** Test Member 1's first portrait clip on a real phone (iOS Safari and Android Chrome): inline playback, captions, nothing overlapping.
6. **Build and tests.** Extend the e2e suite (`web/e2e/`) for swiping, ordering, and a refresh mid-feed. Then a new build ID (`study-4`), and send the build to Member 2 via the `deploy-dist` branch.

## Order and dependencies

1. **Everyone:** agree on the shared contract (one message).
2. **Member 1:** pilot clip → **Member 3:** phone check in the swipe player. (Member 2 starts the packets and books the reviewer in parallel.)
3. **Member 2:** packets → **Member 1:** scripts → reviewer (as text).
4. **Member 1:** render everything. **Member 2:** API. **Member 3:** finish the player and flow.
5. **Member 2:** deploy → **all:** phone check on the live site → freeze before Day 0.
