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

## Keep them watching: engagement and plain language (everyone)

Goal: each clip should feel like a short TikTok explainer, made to be watched, and the student should still be able to **recall** the idea in the quiz afterwards. Engagement is there to serve recall, so nothing here adds content a reviewer hasn't approved.

### Script rules (every clip)

1. **Hook in the first 2 seconds.** Open on a question or a surprising claim, with on-screen text from frame 1. No walk-in or wave intro, because those first seconds are when people swipe away. Examples: "DNA can only be built in one direction. Here's why." / "Your DNA gets damaged by sunlight. So why are you fine?" (Any fact or number in a hook must be in the packet's sources.)
2. **One idea, paid off by the end.** The hook's question is answered in the clip, and the last line is that answer in one sentence.
3. **Simple words.** Short sentences (aim for under 12 words) at a middle-school reading level. Explain a term in plain words the first time it appears ("the 3′ end, the end new pieces snap onto"), then use it the same way every time. One new term per clip at most.
4. **One analogy per clip, reviewed.** Something everyday (a zipper, a train only boarding at the back, a spell-checker). The reviewer checks that it doesn't teach anything false; an analogy that bends the biology gets cut.
5. **Something changes on screen every 2–3 seconds:** a zoom, a highlight pulse, a label popping in, the guide reacting. No still frame longer than 3 s.
6. **Pace:** about 150–170 words a minute. A 25 s clip is about 60–70 words, so cut anything that isn't the one idea.
7. **End with a reason to swipe.** One line teasing the next clip ("But it can't start from nothing. Swipe."). The clip still makes sense alone, and the last intro clip ends with "Let's see what you remember" to lead into the quiz.
8. **Fun comes from the guide and the visuals, not hype words.** The guide reacts: it shrugs, gets surprised, pulls a thumbs-up. No "mind-blowing" or "supercharge" (UI_Guidelines).

### Before and after (same reviewed claims, from `dna_replication.initial`)

> **Now (≈18 s, textbook):** "DNA strands run in opposite directions. This is called antiparallel. Notice that the template runs from three prime to five prime, while the complementary strand runs from five prime to three prime."

> **Wanted (≈20 s):** "DNA only gets built one way. Here's why. *(label pops: 5′ … 3′)* Every strand has two different ends. The 5-prime end. And the 3-prime end. *(pulse on 3′)* New pieces can only snap onto the 3-prime end. *(nucleotide flies in, clicks)* So new DNA always grows 5-prime to 3-prime. One way. Every time. *(guide: thumbs-up)* But it can't start from nothing. Swipe."

### Voice and sound (the biggest gap today)

- **eSpeak sounds robotic**, which pushes students away within seconds. Member 1 should test **Piper** (free, offline, open-source neural text-to-speech; runs on a laptop) against eSpeak on the pilot clip. The catch: Piper doesn't report when each word is spoken, so the word-highlight timing would need alignment (e.g. timestamps from a local Whisper model). Pick whichever stays reliable before Day 0. A natural voice is worth more than perfect word highlighting.
- **Short sound effects** (pop when a label appears, click when a base joins, whoosh on a zoom) and an optional very quiet music bed. Only sounds we make ourselves (e.g. with FFmpeg's tone generators) or CC0-licensed ones; record the source of each in `video/README.md`.
- The same 1-second sound starts every clip, so the series feels like one show.

### Recommended addition (needs product owner OK): a 1-tap prediction

TikTok explainers often put a poll on screen ("Which end grows? A or B"). Doing this in the hook, **before** the clip explains the idea, gets the student guessing from memory first. That's the active-recall goal, and it holds attention. The clip then shows the answer. Tapping is optional, the answer isn't graded, and nothing is shown before they tap. The 4–5-clips-then-quiz flow stays the same. Cost: one reviewed prediction prompt per intro clip (Member 2), one overlay (Member 3), one `prediction_answered` event. **Not in the task lists below until approved.**

### How we'll know it works

These come from events we already send (`video_started`, `video_completed`) plus the swipe events Member 3 adds:
- **Completion rate per clip:** a clip that most students skip before the end gets rewritten.
- **Drop-off per position:** do students quit at clip 3 of 5?
- **Quiz accuracy after the feed vs today's single clip:** engagement has to keep recall the same or better, or it isn't worth it.

Add these to `validation-plan.md` (Member 2).

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
2. **Burned-in captions.** Large and centered, 1–3 words on screen at a time with the spoken word highlighted, TikTok style. Keep writing `.vtt` and `.txt` (accessibility and the transcript button).
3. **Pacing and template.** Drop the walk-in and wave for short clips: the guide is on screen at frame 1 and the hook text shows straight away. Make sure something changes every 2–3 s (see the engagement rules).
4. **Voice and sound.** Compare Piper and eSpeak on the pilot clip. Add our own or CC0 sound effects and the 1-second series sound, and record their sources.
5. **One pilot clip first.** Render the replication "builds one way" clip from the before/after example and send it to Member 3 for a phone check, and to the product owner for the "does this feel like TikTok" check, before scripting the rest.
6. **Write the scripts** following the script rules above: a hook in 2 s, one idea, plain words, one reviewed analogy, a swipe teaser at the end. 15–30 s each, and each clip must make sense alone (students swipe back and forth). Every claim comes from that packet's `source_excerpts`. Anything missing goes to Member 2, never straight into a script. Proposed sequences:

   | Topic (packet) | Intro clips | Follow-ups (v1 and v2 each) |
   | --- | --- | --- |
   | Replication (`synthesis_direction_and_primer`) | 1 polymerase adds to the 3′ end · 2 so synthesis runs 5′→3′ · 3 it can't start on a bare template · 4 primase lays an RNA primer · 5 recap | `growth_direction`, `primer_requirement` |
   | Repair (`error_correction`) | 1 proofreading during synthesis · 2 mismatch repair after · 3 UV bonds adjacent bases · 4 the damage is cut out and refilled · 5 recap | `repair_timing`, `uv_damage` |
   | Transcription (`template_strand_and_promoter`) | 1 RNA polymerase reads the template strand · 2 template vs coding strand · 3 the promoter marks the start · 4 recap | `template_vs_coding`, `promoter_role` |
   | Translation (`codon_pairing_and_ribosome_sites`) | 1 codon–anticodon pairing · 2 A site · 3 P site · 4 E site · 5 recap | `site_roles`, `anticodon_pairing` |

   The v2 follow-up explains the same misconception **a different way**, with another diagram or analogy, not the same narration re-cut.
7. **Send the scripts to the reviewer as text, before rendering**, so content fixes don't cost re-renders.
8. **Render all 32–36 clips.** Delete the old landscape files in the same commit. Update `check_assets.py` and the tests. Add a test that fails if a script runs over 30 s or has a still stretch longer than 3 s.
9. **`jobs.py`:** add `width`/`height` to the ready response. The catalog picks up the new scripts on its own.
10. **Housekeeping:** in `render.py`, change `read_text()`/`write_text()` to `encoding='utf-8'`. It was left unchanged on merge because the fingerprint includes `render.py`. Since everything is being re-rendered, now is the time.
11. **Answer for the team:** how long one 30 s clip takes to render; whether eSpeak holds up at this pace; whether the v2 clips need new diagram types.

## Member 2: content, API, hosting

1. **Packets.** For all 4 packets, add the ordered intro variants (`intro_1` …) with teaching goals and `source_refs`, and a second follow-up variant (`_followup_2`) per misconception. Add source excerpts wherever Member 1's scripts need a claim the packet doesn't cover yet.
2. **Transcription and translation.** Finish their draft packets and question banks so they can go from `coming_soon` to `available` after review.
3. **API.** `/topics` returns `intro_video_requests`. `/attempts` picks the v1 follow-up on the first wrong cycle and the v2 on the second. Update the samples, `check_content.py` and the tests.
4. **Content review.** Add a `content-audit.csv` row for each new clip (32–36) and get the reviewer booked now: this is the riskiest part of the schedule. `approved_version` = the clip's fingerprint, as today. Add two checks to the reviewer's list for each clip: **the analogy doesn't teach anything false**, and **the hook's claim is in the sources**.
5. **Plain-language teaching goals.** Write each intro variant's `teaching_goal` as the one sentence the clip must leave the student with ("New DNA only grows from 5′ to 3′"). That sentence becomes the clip's last line and what the quiz checks.
6. **Validation metrics.** Add per-clip completion, drop-off by position, and quiz accuracy (feed vs today's single clip) to `validation-plan.md`.
7. **Hosting.** After each video push: `git pull` on PythonAnywhere, keep `/media/` mapped, then Reload. The clips grow from 9 MB to about 50 MB; check the disk. Before Day 0:
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
4. **Events.** Send `video_started`/`video_completed` per clip with its `variant_id`, and add `clip_swiped` (`variant_id`, direction, seconds watched) so we can see where students drop off. Check `events.csv` still gives one row per clip view.
5. **Feel.**
   - Clips start the moment their slide is on screen (muted autoplay is allowed on phones; a tap turns the sound on, and it stays on for the rest of the feed).
   - A clip loops if the student doesn't swipe.
   - Show a small "Swipe up" hint on the first clip only.
   - Instant swipe (preload the next clip so there's no spinner between clips).
   - A short, simple "Correct" animation in the quiz. No points or streaks for now: they add scope before Day 0 and don't help recall.
6. **Pilot check.** Test Member 1's first portrait clip on a real phone (iOS Safari and Android Chrome): inline playback, captions, nothing overlapping.
7. **Build and tests.** Extend the e2e suite (`web/e2e/`) for swiping, ordering, and a refresh mid-feed. Then a new build ID (`study-4`), and send the build to Member 2 via the `deploy-dist` branch.

## Order and dependencies

1. **Everyone:** agree on the shared contract (one message).
2. **Member 1:** pilot clip (new script style, voice test) → **Member 3:** phone check in the swipe player → **product owner:** "does this feel like TikTok and is it clear?" Don't script the other 31–35 clips until this passes. (Member 2 starts the packets and books the reviewer in parallel.)
3. **Member 2:** packets → **Member 1:** scripts → reviewer (as text).
4. **Member 1:** render everything. **Member 2:** API. **Member 3:** finish the player and flow.
5. **Member 2:** deploy → **all:** phone check on the live site → freeze before Day 0.
