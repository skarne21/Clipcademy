# Presentation notes

## Cost analysis: the 35 explainer videos

**The headline:** 35 clips (14.4 minutes of video in total) cost about **$2.30 of ElevenLabs credits**. Everything else was
free. The only money actually spent is one month of the ElevenLabs Starter plan (**$6**).

### What we made

| | |
|---|---|
| Clips | 35 (4 topics: 4–5 intros each, plus targeted follow-ups) |
| Format | 720×1280 vertical, 24 fps, 15–30 s each (shortest 20.2 s, longest 29.9 s) |
| Total running time | 863 s, about 14.4 minutes |
| Narration in the final scripts | 12,019 characters (about 343 per clip) |
| Storage for all MP4s | 43.2 MB (about 1.2 MB per clip) |

### Where the money goes

| Item | Tool | What it used | Cost |
|---|---|---|---|
| Voice and word timings for captions | ElevenLabs API (`eleven_multilingual_v2`, voice Liam) | About 15,500 credits: 15,139 characters of narration across 47 requests, plus 4 short voice samples (~6 s each) used to choose the voice | **≈ $2.30** |
| Animation and video rendering | Remotion with an SVG character, on a laptop | About 10 s per clip, so about 6 minutes for all 35 | $0 |
| Captions | Built from ElevenLabs' character timings (no separate captioning service) | Included in the voice request | $0 |
| Sound effects and encoding | Own short sounds, FFmpeg | Local | $0 |
| Hosting | PythonAnywhere free plan | 43 MB of the 512 MiB account (about 8%) | $0 |
| **Total spend for this round** | | | **≈ $2.30 of credits, from a $6 month** |

*How the rate is worked out:* the Starter plan is $6 a month. Our account shows 40,000 credits for that, so one credit
is $0.00015 and 1 credit buys 1 character of narration. 15,500 credits × $0.00015 ≈ $2.30. (ElevenLabs' public
listing says 30,000 credits for Starter. At that rate the same work comes to about $3.10. Either way it fits in one
month's allowance.)

### Unit costs

| Unit | Credits | Cost |
|---|---|---|
| One clip (final narration, average) | ~343 | **≈ $0.05** |
| One minute of finished video | ~835 | ≈ $0.13 |
| One new topic (about 9 clips) | ~3,100 | ≈ $0.46 |
| Re-voicing every clip once (e.g. to fix narration pace, #21) | ~12,000 | ≈ $1.80 |

### Why it stayed cheap

- **Narration is cached.** Audio is saved by its exact text and voice settings (`video/.cache/tts/`). Changing the
  animation, captions or layout and re-rendering spends **nothing**. Only changing what is spoken costs credits.
  A test (`video/test_tts.py`) checks that the same narration is never billed twice.
- **About 20% overhead.** We paid for 15,139 characters, and the final scripts are 12,019. The other ~3,100 were
  re-takes after rewriting scripts (for example `dna_replication.intro_2`).
- **Rendering happens ahead of time, on a laptop.** The free host can't render video (one web worker, no Node).
  It just serves finished MP4s, so there is no server cost per student view.
- **A free fallback exists.** `CLIPCADEMY_VOICE=espeak` renders an offline draft voice for $0, which is useful for
  testing a script before paying for the real voice.

### Limits if we scaled up

- **Credits:** 40,000 credits a month is about 115 new clips (about 13 topics) a month on Starter.
- **Storage is the tighter limit.** At about 1.2 MB a clip, the 512 MiB free host holds roughly 400 clips, and fewer
  once the app itself is counted. The next step up would be a paid host or a separate file store, not a bigger voice plan.
- **Live generation per student** (rendering a new clip for each wrong answer) would cost about $0.05 per clip in
  credits, plus a host that can run rendering. For the study every clip is pre-rendered from an approved script.
- **Licensing:** Starter includes a commercial licence for the voice. Remotion is free for individuals and small
  teams. A larger company would need a Remotion company licence.

*Prices from ElevenLabs' pricing page and 2026 summaries of it. Check elevenlabs.io/pricing before quoting a price as current.*
