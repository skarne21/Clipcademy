# Prompt: make one ClipCademy stick-figure clip

Copy everything inside the box below into Gemini (or any LLM). Fill in the five `{{…}}` lines at the top and paste your source material. The reply is one JSON file. Save it as `video/scripts/<topic_id>.<variant_id>.json`, then render it:

```sh
python video/render.py --topic <topic_id> --variant <variant_id>
```

The renderer adds the stick-figure guide, the diagram, the ElevenLabs voice, word-by-word captions and sound effects. If it stops with an error (for example `Beat cue 'snap' not found`), paste the error back to Gemini and ask it to fix only that.

**Limit:** the renderer can only draw the five diagrams listed in the prompt: DNA replication, DNA repair, transcription, translation, and a during/after timeline. A topic outside those needs a new diagram built in Remotion first.

---

```text
You are writing ONE short educational video for ClipCademy. The video is 15–30 seconds, vertical
(9:16), and shows a friendly stick-figure guide next to an animated diagram, with big word-by-word
captions. You write the narration and the animation cues. A renderer turns your JSON into the video.
You do not write code. Output only the JSON object described at the end.

=== THIS CLIP ===
topic_id:      {{e.g. dna_replication}}
objective_id:  {{e.g. synthesis_direction_and_primer}}
variant_id:    {{intro_1 … intro_5, or <misconception>_followup, or <misconception>_followup_2}}
teaching_goal: {{the ONE sentence the student must leave with, e.g. "New DNA only grows from 5′ to 3′."}}
clip type:     {{"intro N of M" | "last intro" | "follow-up after the student chose: <wrong answer>" |
                 "second follow-up (explain it differently from: <summary of first follow-up>)"}}

=== SOURCE MATERIAL (the ONLY facts you may use) ===
{{Paste the lecture excerpts, each tagged with a ref like [L19-p1]}}

=== WRITING RULES ===
1. HOOK in the first 2 seconds: open on a question or surprising claim. The "title" is that hook,
   under 8 words, shown on screen from the first frame. Any fact in the hook must be in the source.
2. ONE idea per clip. The last teaching sentence is the teaching_goal, said plainly.
3. Short sentences (under 12 words), middle-school words. At most one new term, explained in plain
   words the first time it appears.
4. Exactly ONE everyday analogy (blocks snapping together, a road crew, a lock and key). It must not
   teach anything false.
5. 45–70 words of narration. Write symbols the way they are spoken: "5-prime", not 5′ or 5'.
6. LAST LINE:
   - intro clips: a one-line tease of the next idea ending in "Swipe."
     e.g. "But it can't start from nothing. Swipe."
   - the last intro: "Let's see what you remember."
   - follow-ups: "Now try the question again."
7. No hype words ("mind-blowing", "insane", "crazy"). The fun comes from the guide reacting.

=== ANIMATION CUES ("beats") ===
Each beat: {"on": "<word or short phrase from the narration>", "do": ["action", "action", ...]}
- {"on": "^"} means the first frame. Always start with one.
- Every "on" cue must appear in the narration, IN ORDER, as whole words (case and punctuation ignored).
- Put a beat every 4–6 words: the screen must change at least every 3 seconds or the render fails.
- Use ONLY the actions and targets listed below for the diagram you choose. Anything else fails.

Actions for EVERY diagram:
  pose:<talk|present|shrug|think|thumbs|celebrate|wag|surprised>   the guide's reaction
  point:<target>      the guide points at a part
  pulse:<target>      a part glows briefly
  zoom:<target>       camera zooms to a part
  zoom_out            camera returns to the full view
  card:<text>         a pop-up card with a short fact (max 30 characters; you may use symbols like 5′ → 3′ here)
  step:<word>         a small numbered step label (one or two words)

Choose ONE diagram:

1. "strand" (DNA replication)
   targets: template, new_5, new_3, strand, primer, ghost, arrow, polymerase, primase
   actions: label:5 / label:3 (show the 5′ / 3′ end labels), extend or extend:<n> (new pieces click
            onto the 3′ end, n of them), bounce (a piece bounces off the wrong end), arrow (direction
            arrow), ghost (a faded empty spot: "nothing to build on"), polymerase (DNA polymerase arrives),
            fail (an attempt fails), primase (primase arrives and lays an RNA primer)
   stage (starting picture): {"strand": <pieces already built, default 3>, "primer": <RNA primer pieces,
            default 0>, "slots": <strand length, default 10>}

2. "repair" (DNA damage and repair)
   targets: top, bottom, damage, section, gap, backbone, protein, polymerase, three_end
   actions: extend, misadd (a wrong base is added), excise (wrong base removed), fix (correct base put
            in), scan (repair protein scans along), found (protein finds the damage), cut, remove,
            replace, reseal, uv (UV light hits), bond (two neighboring bases bond together), bulge
            (the backbone bulges), polymerase
   stage: {"bottom": <bases on the bottom strand, default 9>, "wrong": <index of a mismatched base>}

3. "transcription" (DNA → RNA)
   targets: coding, template, promoter, rna, rna_end, polymerase, middle, arrow
   actions: polymerase (RNA polymerase arrives), try (it tries to start), fail, open (the DNA opens),
            extend or extend:<n> (RNA grows), arrow
   stage: {"rna": <RNA pieces already made, default 0>, "open": true|false}

4. "translation" (RNA → protein at the ribosome)
   targets: a_site, p_site, e_site, codon, anticodon, start, mrna, chain, peptide, trna
   actions: enter or enter:p (a tRNA enters the A site, or starts in the P site), pair (anticodon pairs
            with the codon), reject:<codon> (a wrong tRNA is rejected, e.g. reject:UUA), bond (peptide
            bond forms), shift (ribosome moves along), exit (tRNA leaves from the E site)
   stage: {} or {"p_trna": true}

5. "timeline" (comparing what happens DURING vs AFTER a process)
   targets: during, after, line
   actions: timeline (draw the timeline), mark:during, mark:after

=== EXAMPLE OF A FINISHED CLIP (match this style and shape) ===
{"topic_id":"dna_replication","objective_id":"synthesis_direction_and_primer","variant_id":"intro_2",
"format":"vertical","teaching_goal":"New DNA only grows from 5′ to 3′.","source_refs":["L19-p1"],
"review_status":"pending","review_notes":{"hook_claim":"\"DNA only gets built one way\": L19-p1, DNA
synthesis occurs only in the 5′ to 3′ direction.","analogy":"New pieces \"snap onto\" the 3′ end like
blocks clicking together. Check it does not imply pieces can join anywhere else.","new_term":"3′ end
(the end new pieces join), introduced with 5′ as the strand's two ends."},
"scenes":[{"diagram":"strand","title":"DNA only gets built ONE way. Why?",
"narration":"DNA only gets built one way. Here's why. Every strand has two different ends. The 5-prime
end. And the 3-prime end. New pieces can only snap onto the 3-prime end. One way. Every time. New DNA
only grows from 5-prime to 3-prime. But it can't start from nothing. Swipe.",
"stage":{"strand":3,"slots":10},
"beats":[{"on":"^","do":["pose:think","pulse:strand"]},{"on":"built","do":["pulse:template"]},
{"on":"here's","do":["point:strand"]},{"on":"every strand","do":["pulse:strand"]},
{"on":"ends","do":["pulse:template","pose:present"]},{"on":"5-prime","do":["label:5","pulse:new_5","point:new_5"]},
{"on":"3-prime","do":["label:3","pulse:new_3","point:new_3"]},{"on":"only","do":["bounce","pose:wag"]},
{"on":"snap","do":["zoom:new_3","extend","point:new_3"]},{"on":"one way","do":["pose:thumbs"]},
{"on":"every time","do":["zoom_out","pulse:strand"]},{"on":"grows","do":["arrow","card:New DNA grows 5′ → 3′"]},
{"on":"can't","do":["pose:think"]},{"on":"nothing","do":["ghost","pose:shrug"]},{"on":"swipe","do":["pulse:ghost"]}]}]}

=== OUTPUT ===
Return ONLY this JSON object (no markdown fences, no commentary):
{
  "topic_id": "...",
  "objective_id": "...",
  "variant_id": "...",
  "format": "vertical",
  "teaching_goal": "...",
  "source_refs": ["the refs your facts came from"],
  "review_status": "pending",
  "review_notes": {
    "hook_claim": "the hook's claim + the source ref that supports it",
    "analogy": "the analogy + what a reviewer should check it doesn't wrongly imply",
    "new_term": "the one new term and how you explained it, or 'none new'"
  },
  "scenes": [{
    "diagram": "strand | repair | transcription | translation | timeline",
    "title": "the hook, under 8 words",
    "narration": "45–70 words",
    "stage": { only the stage keys listed for that diagram },
    "beats": [ {"on": "^", "do": [...]}, ... ]
  }]
}

Before answering, check: every "on" cue appears in the narration in order; every action and target
is in the lists for your diagram; the narration is 45–70 words and ends with the required last line.
```

---

## Before a student sees it

- **The clip is a review copy.** It has `review_status: "pending"`, and the app won't serve it to students until a reviewer approves it in `Context/content-audit.csv` with the clip's fingerprint. Run `python learning/check_content.py` to add the row.
- **The reviewer checks:**
  - every fact against the cited source;
  - the hook's claim is in the source;
  - the analogy doesn't teach anything false.
- **Free draft first:** `CLIPCADEMY_VOICE=espeak python video/render.py …` renders with an offline voice so you don't spend ElevenLabs credits while fixing the script. It needs `pip install espeakng-loader`.
