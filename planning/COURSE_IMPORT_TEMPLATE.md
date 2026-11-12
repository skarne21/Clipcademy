# Course import template: course material → Gemini → Remotion clips

A template for a future **import feature**. You import a course's material (lecture PDFs, slides, notes), Gemini analyzes it and breaks it into lessons and clip storyboards, and Remotion renders the clips. It generalizes the pipeline that made the 35 biology clips so it works for **any course**.

## What has to change from the biology pipeline

Today each clip names one of five hand-built biology diagrams (`strand`, `repair`, `transcription`, `translation`, `timeline`). That can't scale to imported courses. Gemini can't draw a new diagram for every course, so the import pipeline needs a fixed **scene catalog** of general-purpose templates (steps, compare, flow, equation, labeled image and so on). Gemini's job is to choose a template and fill in its props, never to invent visuals. The biology diagrams stay as `custom:` templates for the four existing topics.

Everything else carries over:
- narration with word timings from ElevenLabs
- beats tied to spoken words
- the guide character and burned-in captions
- the 15–30 s length and the 3-second still limit
- source-linked review before anything reaches students

---

## Pipeline at a glance

| Stage | Who | Input | Output (JSON) | Gate |
| --- | --- | --- | --- | --- |
| 0. Ingest | Code | Uploaded files | `course.json`: file list, extracted text with page numbers | — |
| 1. Course map | **Gemini** | All course files | `course_map.json`: units → topics → objectives, with page refs | Instructor or reviewer edits the outline |
| 2. Lesson packet | **Gemini**, once per objective | That objective's pages | `packet.json`: verbatim excerpts, key terms, clip plan, misconceptions, questions | **Reviewer approves** (facts, questions) |
| 3. Storyboard | **Gemini**, once per clip | Approved packet + one clip from the plan | `clip.json`: narration, scenes, beats | Code validation (stage 4) |
| 4. Validate | Code | `clip.json` | Pass, or errors fed back to Gemini once | Hard fail after one retry |
| 5. Voice | ElevenLabs | Narration | Audio + per-word timings | — |
| 6. Render | Remotion | `clip.json` + timings | MP4, VTT, transcript, manifest with fingerprint | **Reviewer approves** the rendered clip |
| 7. Publish | Code | Approved fingerprint | Clip playable in the app | — |

Two human gates are non-negotiable. They are the same rule as US-17, US-18 and US-23: nothing Gemini writes reaches a student unreviewed, and no LLM call happens during a student session.

---

## Stage 0: ingest (code, no LLM)

- Upload each file with the **Gemini Files API** so Gemini reads PDFs and slides natively, including figures. Also extract plain text locally, page by page, so later stages can check quotes against it.
- Give every page a stable ref: `<course_code>-<file_id>-p<page>`, for example `BIOL2100-L19-p1`.
- Pull figures out as images (`assets/<ref>-fig<n>.png`). They can appear in clips through the `labeled_image` template, but only if the course's license or the instructor allows it.

```json
{
  "course_id": "biol2100_fall26",
  "title": "Intro Biology",
  "level": "first-year undergraduate",
  "files": [{"file_id": "L19", "title": "Lecture 19: DNA replication", "pages": 4, "gemini_file_uri": "files/abc123"}],
  "permissions": {"excerpts_in_clips": true, "figures_in_clips": false, "granted_by": "instructor", "date": "2026-11-02"}
}
```

---

## Stage 1: course map (Gemini)

**Settings:** a current Gemini Pro model, all course files attached, `responseMimeType: "application/json"` with a `responseSchema` matching the output below, and temperature around 0.2. This stage extracts structure; it should not invent anything.

```text
SYSTEM
You are a curriculum analyst for ClipCademy, an app that teaches through 15–30 second vertical
video clips followed by recall questions. You only describe what is in the attached course
material. Never add outside knowledge. Every item you return must cite the pages it comes from.

USER
Course: {{COURSE_TITLE}} ({{COURSE_LEVEL}}). Attached: {{FILE_LIST}}.

Break the course into units → topics → learning objectives.
- A learning objective is one idea a student should be able to recall or apply, small enough for
  4–6 clips and 2 quiz questions ("Explain why DNA polymerase needs a primer", not "DNA replication").
- For each objective give: the pages it comes from, a one-sentence plain-language summary,
  key terms, prerequisite objectives, and an estimate of difficulty (1–3).
- Flag passages that are unclear, contradictory, or seem to contain errors in "flags". Don't resolve them.
- Suggest which objectives are most worth clips: concepts students commonly get wrong,
  processes with steps, and comparisons. Skip pure logistics (due dates, grading).

Return JSON matching the schema.
```

```json
{
  "course_id": "biol2100_fall26",
  "units": [{
    "unit_id": "dna",
    "title": "DNA: copying, repair, expression",
    "topics": [{
      "topic_id": "dna_replication",
      "title": "DNA replication",
      "objectives": [{
        "objective_id": "synthesis_direction_and_primer",
        "summary": "New DNA grows only 5′→3′, and polymerase needs a primer to start.",
        "source_refs": ["BIOL2100-L19-p1", "BIOL2100-L19-p2"],
        "key_terms": ["5′ end", "3′ end", "primer", "primase"],
        "prerequisites": [],
        "difficulty": 2,
        "clip_priority": "high",
        "why": "Direction and primer are classic exam traps"
      }]
    }]
  }],
  "flags": [{"ref": "BIOL2100-L22-p1", "issue": "Says tRNAs have two subunits; elsewhere attributes subunits to the ribosome"}]
}
```

**Gate:** the reviewer edits this outline in the admin screen: merge or split objectives, drop low-value ones, resolve flags with the instructor.

---

## Stage 2: lesson packet (Gemini, once per objective)

**Settings:** attach only the objective's pages, use a `responseSchema`, temperature around 0.3.

```text
SYSTEM
Same as stage 1, plus: You write for students at a middle-school reading level. Short sentences.
Every fact must be traceable to a verbatim quote from the attached pages.

USER
Course: {{COURSE_TITLE}}. Objective: {{OBJECTIVE_ID}}: {{OBJECTIVE_SUMMARY}}.
Pages: {{SOURCE_REFS}}. Key terms: {{KEY_TERMS}}.

Build a lesson packet:
1. source_excerpts: verbatim quotes (copy exactly, no paraphrase) with their page ref.
   Anything unclear goes to excluded_passages with a reason.
2. clip_plan: 4–5 intro clips that build the idea in order, then follow-ups.
   Each clip has ONE teaching_goal: a plain sentence under 12 words that the clip's last line will say.
   The first intro hooks interest; the last intro ends by leading into the quiz.
3. misconceptions: exactly 2 common wrong ideas about this objective, each with a short
   description, the wrong belief in the student's words, and 2 follow-up clips:
   "<id>_followup" and "<id>_followup_2" (the second must use a different explanation or analogy).
4. questions: 2 required questions and 2 retry questions per misconception (4 total).
   2–4 choices. Every wrong choice maps to one misconception. Feedback for every choice,
   one or two sentences, from the excerpts. Retry questions test the same idea in new words.
   The correct answer must not be the longest choice in more than one question.
5. review_points: the 2–4 facts a reviewer must confirm against the source.

Return JSON matching the schema.
```

```json
{
  "course_id": "biol2100_fall26",
  "topic_id": "dna_replication",
  "objective_id": "synthesis_direction_and_primer",
  "label": "Synthesis direction and the primer requirement",
  "source_excerpts": [{"ref": "BIOL2100-L19-p1", "text": "DNA synthesis occurs only in the 5′ to 3′ direction, …"}],
  "excluded_passages": [{"ref": "BIOL2100-L19-p3", "reason": "Ligase/primer-removal order unclear"}],
  "key_terms": [{"term": "3′ end", "plain": "the end new pieces snap onto"}],
  "clip_plan": [
    {"variant_id": "intro_1", "kind": "intro", "teaching_goal": "DNA polymerase adds new pieces only to the 3′ end.", "source_refs": ["BIOL2100-L19-p1"]},
    {"variant_id": "primer_followup", "kind": "followup", "misconception_id": "primer_requirement", "teaching_goal": "Polymerase needs a primer's 3′ end to start.", "source_refs": ["BIOL2100-L19-p1", "BIOL2100-L19-p2"]}
  ],
  "misconceptions": {
    "primer_requirement": {
      "description": "Thinks polymerase or ligase can start a new strand from nothing",
      "student_belief": "Ligase adds the new bases",
      "variant_ids": ["primer_followup", "primer_followup_2"],
      "retry_question_ids": ["rep-r2", "rep-r4"]
    }
  },
  "questions": [{
    "question_id": "rep-q2", "role": "required", "prompt": "Why is a primer needed?",
    "choices": [
      {"choice_id": "A", "text": "DNA polymerase can't start a new strand", "correct": true, "feedback": "Correct. …", "misconception_id": null},
      {"choice_id": "B", "text": "Ligase uses it to add the new bases", "correct": false, "feedback": "…", "misconception_id": "primer_requirement"}
    ],
    "source_refs": ["BIOL2100-L19-p1"]
  }],
  "review_points": ["New nucleotides join the 3′ end", "Primase makes the RNA primer"],
  "review_status": "draft"
}
```

**Checks in code before review:**
- every `source_excerpts[].text` is found verbatim in the extracted page text;
- every question ID is referenced exactly once;
- every wrong choice has a misconception.

**Converting for today's app:** split the packet into the existing `learning/packets/*.json`, `questions.json` and `answer_key.json`. The fields map one-to-one.

**Gate:** the reviewer approves the packet (`review_status: "reviewed"`).

---

## Stage 3: storyboard (Gemini, once per clip)

This is where Gemini "goes into Remotion". It writes the narration and chooses **templates from the scene catalog** below, with props and beats. It never writes React code.

**Settings:** approved packet + one `clip_plan` entry + the scene catalog (as JSON) + one finished example clip. Use a `responseSchema`, temperature around 0.6 so the hooks and analogies get some variety.

```text
SYSTEM
You storyboard ONE ClipCademy clip: a 15–30 second vertical (9:16) video with a friendly
stick-figure guide, one animated visual, and word-by-word captions.
You may ONLY use templates, props and actions from SCENE_CATALOG. You do not write code.

WRITING RULES
1. Hook in the first 2 seconds: a question or surprising claim, also shown as the on-screen title
   (under 8 words). Any fact in the hook must be in the excerpts.
2. One idea. The last teaching line states the teaching_goal in one sentence.
3. Sentences under 12 words, plain words, at most one new term (explained the first time).
4. Exactly one everyday analogy that doesn't teach anything false.
5. 45–70 words of narration. Write symbols as spoken ("5-prime", "x squared").
6. Ending line: intros tease the next clip and end "Swipe."; the last intro ends
   "Let's see what you remember."; follow-ups end "Now try the question again."
7. Follow-up v2 must use a different template or analogy than v1: {{V1_SUMMARY_IF_ANY}}.
8. No hype words. Fun comes from the guide's reactions and the visuals.

VISUAL RULES
- 1–2 scenes. Pick the template that matches the idea's shape:
  ordered steps → steps; two things contrasted → compare; cause and result → flow;
  formula → equation; a figure with parts → labeled_image; "wrong idea vs right idea" → myth_fact.
- Beats: {"on": "<word or phrase in the narration>", "do": ["action", …]}. "^" = first frame.
  Cues must appear in the narration in order. Add a beat every 4–6 words so the screen
  changes at least every 2–3 seconds.
- Every element ID used in an action must be defined in that scene's props.

INPUT
Packet: {{APPROVED_PACKET_JSON}}
This clip: {{CLIP_PLAN_ENTRY}}  (position: {{e.g. "intro 2 of 5"}})
SCENE_CATALOG: {{SCENE_CATALOG_JSON}}
Example finished clip: {{EXAMPLE_CLIP_JSON}}

Return JSON matching the schema.
```

### Clip output format

This extends today's `video/scripts/*.json`. `diagram` becomes `template` plus `props`.

```json
{
  "course_id": "biol2100_fall26",
  "topic_id": "dna_replication",
  "objective_id": "synthesis_direction_and_primer",
  "variant_id": "primer_followup",
  "format": "vertical",
  "teaching_goal": "Polymerase needs a primer's 3′ end to start.",
  "source_refs": ["BIOL2100-L19-p1", "BIOL2100-L19-p2"],
  "review_status": "pending",
  "review_notes": {
    "hook_claim": "Hook claim + supporting ref",
    "analogy": "A starter block that building begins from; check it doesn't imply primase builds the whole strand",
    "new_term": "none new (follow-up)"
  },
  "scenes": [{
    "template": "steps",
    "title": "Why can't polymerase just start?",
    "props": {
      "steps": [
        {"id": "s1", "text": "Bare template"},
        {"id": "s2", "text": "Primase lays a primer"},
        {"id": "s3", "text": "Polymerase extends it"}
      ]
    },
    "narration": "Here's the problem. A bare template has no starting point. Polymerase can't begin here. So primase steps in. It lays down a short RNA primer. Think of it as a starter block. Now polymerase has a 3-prime end. It extends the primer with DNA. Now try the question again.",
    "beats": [
      {"on": "^", "do": ["pose:think", "reveal:s1"]},
      {"on": "can't", "do": ["shake:s1", "pose:shrug"]},
      {"on": "primase", "do": ["reveal:s2", "highlight:s2"]},
      {"on": "starter block", "do": ["card:A starter block", "pose:present"]},
      {"on": "extends", "do": ["reveal:s3", "highlight:s3", "pose:thumbs"]},
      {"on": "try", "do": ["zoom_out"]}
    ]
  }]
}
```

---

## Scene catalog (build these once in Remotion)

These are general-purpose templates, so any course can use them. Build each as a React component in `video/remotion/src/scenes/` and register its props and actions in `video/beats.py` (`DIAGRAMS` → `TEMPLATES`). The JSON version of this table is what you paste into Gemini as `SCENE_CATALOG`.

| Template | Good for | Props (Gemini fills) | Template actions |
| --- | --- | --- | --- |
| `title_card` | Hooks, one-line takeaways | `text`, `subtitle?` | `reveal`, `emphasize:<word>` |
| `steps` | Processes, procedures, algorithms, phases | `steps[{id, text, icon?}]` (2–6) | `reveal:<id>`, `highlight:<id>`, `check:<id>`, `shake:<id>` |
| `compare` | A vs B (mitosis vs meiosis, supply vs demand) | `left{title, points[{id,text}]}`, `right{…}` | `reveal:<id>`, `highlight:<id>`, `link:<id>-<id>`, `winner:left\|right` |
| `flow` | Cause → effect, pathways, feedback loops | `nodes[{id, text}]`, `edges[{from, to, label?}]` (≤6 nodes) | `reveal:<id>`, `pulse_edge:<from>-<to>`, `highlight:<id>`, `block:<id>` |
| `timeline` | History, sequences in time, "during vs after" | `events[{id, label, when}]` | `reveal:<id>`, `mark:<id>`, `span:<id>-<id>` |
| `equation` | Math, physics, chemistry, stats formulas | `latex`, `parts[{id, latex, meaning}]` | `reveal:<id>`, `highlight:<id>`, `explain:<id>`, `substitute:<id>=<value>` |
| `labeled_image` | A figure with named parts (cell, circuit, map) | `image` (an approved asset), `labels[{id, text, x, y}]` (0–1 coordinates) | `reveal:<id>`, `point:<id>`, `zoom:<id>`, `circle:<id>` |
| `myth_fact` | Misconception follow-ups | `myth`, `fact` | `show_myth`, `cross_out`, `show_fact` |
| `term` | Defining one new word | `term`, `plain`, `example` | `reveal_plain`, `reveal_example` |
| `chart` | Small data stories (≤8 points) | `kind: bar\|line`, `series[{id, label, values}]`, `axes` | `draw:<id>`, `highlight_point:<id>:<i>`, `annotate:<text>` |
| `code` | CS courses | `language`, `lines[]` | `highlight_line:<n>`, `step_to:<n>`, `show_output:<text>` |
| `custom:<name>` | Hand-built subject diagrams (today's `strand`, `repair` etc.) | Defined per diagram | Defined per diagram |

**Available in every template:** `pose:<talk|present|shrug|think|thumbs|celebrate|wag|surprised>`, `point:<id>`, `pulse:<id>`, `zoom:<id>`, `zoom_out`, `card:<≤30 chars>`, `step:<one word>`.

**Layout limits** for every template: 720×1280. Keep the safe zones clear (top 120 px, right 120 px, bottom 200 px), and keep captions in y 760–1000. Text in props is capped (step text ≤ 24 characters, node text ≤ 18), so nothing overflows. The validator rejects props over the limits instead of shrinking the text.

---

## Stage 4: validation (code, before spending voice credits)

Reject the clip and send the errors back to Gemini **once** if any of these fail:
- JSON matches the schema; the template exists; props are within limits; every action and target ID is defined.
- Every beat cue appears in the narration, in order (`beats.resolve`).
- Narration is 45–70 words, has no symbols that TTS will misread, and ends with the required swipe line.
- `teaching_goal` appears, near enough, as the last teaching sentence.
- The hook's claim and every number appear in the packet excerpts. Check with simple matching, and flag anything else for the reviewer.

After voicing, the existing checks still run: 15–30 s, and no still stretch over 3 s.

---

## Stages 5–7: voice, render, publish (existing code)

- **Voice:** `video/tts.py` sends the narration to ElevenLabs with timestamps, cached by text and voice settings. Give each course a voice setting in `course.json` if it shouldn't use the default voice.
- **Render:** `video/render.py` → Remotion. It runs on a laptop or worker with Node, not on PythonAnywhere.
- **Fingerprint and review:** same as now. The reviewer approves the rendered clip, `approved_version` is set to its fingerprint, and only then does the app serve it.

**Cost per clip** (narration of about 350 characters): about $0.05 in ElevenLabs credits, plus three Gemini calls per objective and one per clip. Remotion rendering is free for teams of up to 3.

---

## Build order

1. **Scene catalog first.** Build `steps`, `compare`, `flow`, `myth_fact` and `title_card` in Remotion. These cover most clips in any course. Re-make 3 existing biology clips with them to prove they look as good as the hand-built diagrams.
2. **Stages 1–2** with Gemini on one new course's material, plus the admin review screen for the outline and packets.
3. **Stage 3 + validator** for that course. Measure how often clips pass validation on the first try.
4. Add `equation`, `labeled_image`, `chart` and `code` as new courses need them.
5. **US-23 acceptance criteria apply throughout:**
   - every claim names its excerpt;
   - drafts can't be served before approval;
   - no LLM call happens during a student session;
   - the reviewer sees what Gemini drafted and what they changed.
