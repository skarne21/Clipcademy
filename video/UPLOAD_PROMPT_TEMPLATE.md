# Prompt templates: from an uploaded lecture to new ClipCademy clips

These prompts turn an uploaded lecture into new ClipCademy clips. They follow the same rules and file formats as the 35 existing clips. They were reconstructed from what the pipeline expects:

- the script rules in [Context/notes.md](../Context/notes.md)
- the packet format in [learning/packets/](../learning/packets/)
- the script format in [video/scripts/](scripts/)
- the beat checks in [video/beats.py](beats.py)

They are **not** a copy of the original chat prompts, which aren't stored in the repo.

The prompts work with any capable LLM. Paste one into Gemini or Claude, or send it from an upload feature's backend. Replace every `{{PLACEHOLDER}}` before sending.

## How an upload becomes a clip

| Step | Who | Input | Output | Where it goes |
| --- | --- | --- | --- | --- |
| 1 | Teacher or student | Lecture PDF or text | Upload | — |
| 2 | LLM, **Prompt A** | Lecture text | Lesson packet + questions + answer key | `learning/packets/`, `learning/data/` |
| 3 | **Human reviewer** | Packet | Corrected, approved packet | Same files, `review_status` updated |
| 4 | LLM, **Prompt B** (once per clip) | Approved packet + one variant | Clip script JSON | `video/scripts/<topic>.<variant>.json` |
| 5 | Render | Script | Draft clip | `python video/render.py --topic <topic> --variant <variant>` |
| 6 | **Human reviewer** | Rendered clip | Approval row with fingerprint | `Context/content-audit.csv` |
| — | Claude Code, **Prompt C** | Topic with no matching diagram | New Remotion scene | `video/remotion/src/scenes/` |

**Guardrail:** nothing the LLM writes reaches a student until a reviewer approves both the packet and the rendered clip (US-17, US-18). The LLM never runs during a student session.

**Diagrams limit what you can make right now.** The renderer can only draw five diagrams: `strand`, `repair`, `transcription`, `translation` and `timeline`. A lecture on another topic (for example cell division) needs a new diagram first, built with Prompt C. Otherwise Prompt B has nothing to animate.

---

## Prompt A: lesson packet and questions from an uploaded lecture

```text
You are preparing study material for ClipCademy, an app that teaches intro biology through
15–30 second vertical video clips followed by multiple-choice questions.

SOURCE (uploaded lecture; this is the ONLY source you may use):
Lecture {{LECTURE_NUMBER}}, "{{LECTURE_TITLE}}"
<<<
{{LECTURE_TEXT — paste the extracted text, with page markers like [p1], [p2]}}
>>>

TASK
Build one lesson packet for ONE learning objective: {{OBJECTIVE_IN_PLAIN_WORDS}}.
Use topic_id "{{TOPIC_ID}}" (snake_case, e.g. cell_division) and objective_id "{{OBJECTIVE_ID}}".
Question IDs use the prefix "{{QID_PREFIX}}" (e.g. "div").

RULES
1. Every fact must come from the SOURCE. Copy source excerpts word for word and tag each with a
   ref "L{{LECTURE_NUMBER}}-p<page>". Do not add outside knowledge.
2. If a passage is unclear, contradictory or you are unsure of it, do not use it. List it in
   "excluded_passages" with the reason.
3. Write 4–5 intro clip variants (intro_1 … intro_5). Each has a "teaching_goal": ONE plain sentence
   (under 12 words, middle-school reading level) that the clip must leave the student with.
   intro_1 introduces the idea; the last intro sets up the quiz.
4. Pick exactly 2 misconceptions students commonly have about this objective (snake_case IDs).
   Each misconception gets two follow-up variants: "<id>_followup" and "<id>_followup_2"
   (the second explains it a DIFFERENT way), and two retry questions.
5. Write 2 required questions ({{QID_PREFIX}}-q1, {{QID_PREFIX}}-q2) and 4 retry questions
   ({{QID_PREFIX}}-r1 … r4). 2–3 choices each. Each wrong choice maps to one misconception.
   Retry questions test the same idea as a required question but with new wording; never reuse a prompt.
   Don't let the longest choice be the right answer more than once.
6. Feedback for every choice: one or two short sentences, from the SOURCE, that explain why.

OUTPUT: one JSON object, no commentary, exactly this shape:
{
  "packet": {
    "topic_id": "...", "objective_id": "...", "label": "...",
    "source_excerpts": [{"ref": "L19-p1", "text": "verbatim excerpt"}],
    "excluded_passages": ["ref + reason"],
    "required_question_ids": ["{{QID_PREFIX}}-q1", "{{QID_PREFIX}}-q2"],
    "misconceptions": {
      "<misconception_id>": {"variant_ids": ["<id>_followup", "<id>_followup_2"],
                             "retry_question_ids": ["{{QID_PREFIX}}-r1", "{{QID_PREFIX}}-r3"]}
    },
    "variants": {
      "intro_1": {"teaching_goal": "...", "source_refs": ["L19-p1"]},
      "<id>_followup": {"teaching_goal": "...", "source_refs": ["..."]}
    },
    "review_points": ["the 2–4 facts a reviewer must confirm"],
    "review_status": "draft"
  },
  "questions": [
    {"question_id": "{{QID_PREFIX}}-q1", "objective_id": "...", "prompt": "...",
     "choices": [{"choice_id": "A", "text": "..."}, {"choice_id": "B", "text": "..."}]}
  ],
  "answer_key": {
    "{{QID_PREFIX}}-q1": {
      "correct_choice_id": "B", "counts_for": "{{QID_PREFIX}}-q1", "source_refs": ["..."],
      "choices": {
        "A": {"feedback": "...", "misconception_id": "<misconception_id>"},
        "B": {"feedback": "Correct. ...", "misconception_id": null}
      }
    }
  }
}
For retry questions, "counts_for" is the required question they stand in for.
```

**After Prompt A:**
1. Save `packet` as `learning/packets/<topic_id>.<objective_id>.json`.
2. Merge `questions` into `learning/data/questions.json` and `answer_key` into `learning/data/answer_key.json`.
3. Add the topic to `learning/data/topics.json`.
4. Run `python learning/check_content.py`. It flags mismatched IDs and adds pending rows to `Context/content-audit.csv`.
5. A reviewer checks every excerpt against the lecture before Prompt B runs.

---

## Prompt B: one clip script (run once per variant)

Fill in `{{DIAGRAM_CATALOG}}` with the matching entry from the table under the prompt.

```text
You write narration and animation cues for ONE ClipCademy clip: a 15–30 second vertical video
with a stick-figure guide, an animated biology diagram and burned-in captions.

APPROVED PACKET (your only source of facts):
{{PASTE THE APPROVED PACKET JSON}}

THIS CLIP
- variant_id: {{VARIANT_ID}}              (e.g. intro_2, primer_followup, primer_followup_2)
- teaching_goal: {{TEACHING_GOAL}}         (copy from packet.variants)
- source_refs: {{SOURCE_REFS}}
- clip type: {{intro | follow-up v1 | follow-up v2 (must use a different analogy/approach than v1)}}
- position: {{e.g. "intro 2 of 5" / "last intro" / "follow-up after the student chose X"}}

SCRIPT RULES
1. Hook in the first 2 seconds: open on a question or surprising claim. The "title" (on screen from
   frame 1) is that hook in under 8 words. Any fact in the hook must be in the packet excerpts.
2. One idea, paid off: the last teaching line is the teaching_goal, said in one sentence.
3. Short sentences, under 12 words, middle-school words. At most one new term, explained in plain
   words the first time ("the 3-prime end, the end new pieces snap onto").
4. Exactly one everyday analogy, and it must not teach anything false.
5. 45–70 words of narration (about 150–170 words a minute, 15–30 seconds).
6. Write numbers and symbols the way they are spoken: "5-prime", not 5′.
7. End with a swipe line: intros tease the next clip ("But it can't start from nothing. Swipe.");
   the last intro ends "Let's see what you remember."; follow-ups end "Now try the question again."
8. No hype words ("mind-blowing", "insane"). The fun comes from the guide's reactions.

ANIMATION CUES ("beats")
- Each beat is {"on": "<word or short phrase from the narration>", "do": ["action", ...]}.
- "on": "^" means the first frame. After that, cues must appear in the narration IN ORDER,
  matched as whole words, ignoring case and punctuation.
- Something must change on screen at least every 2–3 seconds: aim for a beat every 4–6 words.
- Only use the actions, targets and stage keys listed for this diagram:
{{DIAGRAM_CATALOG}}
- Available everywhere: pose:<talk|present|shrug|think|thumbs|celebrate|wag|surprised>,
  point:<target>, pulse:<target>, zoom:<target>, zoom_out, card:<short on-screen text, max 30 chars>,
  step:<one word>.

EXAMPLE OF A FINISHED SCRIPT (style and shape to match):
{{PASTE video/scripts/dna_replication.intro_2.json}}

OUTPUT: one JSON object, no commentary:
{
  "topic_id": "...", "objective_id": "...", "variant_id": "{{VARIANT_ID}}", "format": "vertical",
  "teaching_goal": "...", "source_refs": [...], "review_status": "pending",
  "review_notes": {
    "hook_claim": "the hook's claim + the excerpt ref that supports it",
    "analogy": "the analogy + what the reviewer should check it doesn't imply",
    "new_term": "the one new term, or 'none new'"
  },
  "scenes": [{
    "diagram": "{{DIAGRAM}}", "title": "...", "narration": "...",
    "stage": { ... only keys allowed for this diagram ... },
    "beats": [{"on": "^", "do": ["pose:think", "pulse:..."]}, ...]
  }]
}
```

### Values for `{{DIAGRAM_CATALOG}}`

These come from [video/beats.py](beats.py); update this table if a new diagram is added.

| Diagram | Use for | Actions | Targets | Stage keys (defaults; copy values from a similar script in `video/scripts/`) |
| --- | --- | --- | --- | --- |
| `strand` | DNA replication | `label:5`, `label:3`, `extend`, `bounce`, `arrow`, `ghost`, `polymerase`, `fail`, `primase` | template, new_5, new_3, strand, primer, ghost, arrow, polymerase, primase | strand 3, primer 0, slots 10 |
| `repair` | DNA damage and repair | extend, misadd, excise, fix, scan, found, cut, remove, replace, reseal, uv, bond, bulge, polymerase | top, bottom, damage, section, gap, backbone, protein, polymerase, three_end | bottom 9, slots 9; also used: copying, damaged, section, wrong |
| `transcription` | DNA → RNA | polymerase, try, fail, open, extend, arrow | coding, template, promoter, rna, rna_end, polymerase, middle, arrow | rna 0, start_slot 2, slots 10; also used: open |
| `translation` | RNA → protein | enter, pair, reject, bond, shift, exit | a_site, p_site, e_site, codon, anticodon, start, mrna, chain, peptide, trna | none by default; also used: p_trna |
| `timeline` | "during vs. after" comparisons (any topic) | timeline, `mark:during`, `mark:after` | during, after, line | none |

**After Prompt B:**
1. Save the output as `video/scripts/<topic_id>.<variant_id>.json`.
2. Render a free draft with the offline voice: `CLIPCADEMY_VOICE=espeak python video/render.py --topic <topic_id> --variant <variant_id>`. This needs the `espeakng_loader` Python package (`pip install espeakng-loader`). The render fails with a clear message if a cue isn't in the narration, an action or target isn't allowed, the clip is outside 15–30 s, or there's a still stretch longer than 3 s. Paste that message back to the LLM and ask it to fix only that problem.
3. When the draft looks right, render with ElevenLabs (drop `CLIPCADEMY_VOICE`). One clip's narration is about 350 characters, so about 350 credits, roughly $0.05.
4. Give the reviewer the script's `narration` and `review_notes`. **Don't run `video/write_scripts.py` for uploaded clips.** It regenerates only the 35 built-in scripts from its own table, and `SCRIPTS_FOR_REVIEW.md` lists only those. New clips won't appear there unless you add them to that table.
5. Run `python learning/check_content.py` to add the clip's audit row.

---

## Prompt C: a new diagram for a topic outside the five (Claude Code)

Use this only when Prompt A's topic can't be drawn with an existing diagram.

```text
In this repo (ClipCademy), add a new Remotion diagram called "{{DIAGRAM_NAME}}" for
{{TOPIC_IN_PLAIN_WORDS}} (Lecture {{LECTURE_NUMBER}}), so clip scripts can animate it.

Context: read video/README.md, Context/notes.md (script and visual rules), video/beats.py (DIAGRAMS
registry and checks) and an existing scene in video/remotion/src/scenes/ (e.g. strand) as the model.

What the diagram must show, from the approved packet learning/packets/{{TOPIC_ID}}.{{OBJECTIVE_ID}}.json:
- Parts on screen (targets): {{e.g. chromosome, centromere, spindle, cell_membrane}}
- Things that happen (actions): {{e.g. condense, align, separate, pinch}}
- Starting setup (stage keys with defaults): {{e.g. phase: 0}}

Requirements:
1. Register the diagram in beats.DIAGRAMS with its actions, targets and stage defaults, and give each
   new action a sound in SOUNDS.
2. Match the existing look: same guide character, colors, card and caption styles, 720×1280,
   safe zones clear (top 120 px, right 120 px, bottom 200 px; captions stay in y 760–1000).
3. Tests first: add failing tests to video/test_beats.py for the new actions and targets, commit,
   then implement until they pass. Keep the existing tests green.
4. Render one sample script with CLIPCADEMY_VOICE=espeak and show me a frame from the middle of it.
```

---

## Upload feature: what the backend needs to do

To run this from an upload button instead of by hand:

1. **Extract the text** from the uploaded PDF, keeping page numbers so refs like `L23-p2` are possible.
2. **Send Prompt A** with the text filled in, and check the reply is valid JSON in the shape above. If it isn't, ask the model to fix it once, then stop and show the error.
3. **Save it as a draft**, not live: `review_status: "draft"` on the packet and `pending` on each audit row.
4. **Wait for reviewer approval** of the packet in the review screen.
5. **Send Prompt B once per variant.** Each misconception has two follow-ups, so 2 misconceptions plus 4–5 intros make 8–9 clips per objective. Each script goes into `video/scripts/`.
6. **Render on a machine with Node, Remotion and an ElevenLabs key.** The PythonAnywhere host can't render video, so rendering runs locally or on a worker.
7. **Wait for reviewer approval of each rendered clip.** Only then does the clip's fingerprint go into `approved_version` and become playable for students.

US-23 (issue #31) covers this feature. Its acceptance criteria apply here:
- every claim in a draft names the excerpt it came from;
- drafts can't be served until a reviewer approves them;
- no LLM call happens during a student session;
- the reviewer can see what the LLM drafted and what they changed.
