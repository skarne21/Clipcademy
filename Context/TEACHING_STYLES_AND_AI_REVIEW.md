# Teaching styles and two AI review layers

Date: 2026-11-19, revised the same day to match `planning/CLIPCADEMY_V2_BOARD_SPEC.md` v2.1. Status: **proposed product and engineering design; not implemented; deferred from pilot 1**.

> **Pilot 1 scope.** The style picker, guide and voice choices, and the Layer 2 style review are not part of pilot 1. They may enter a later pilot only when the eight conditions in spec §3.12 hold. One part of this note *is* in pilot 1, in reduced form: the Layer 1 source check runs on every script before voice spend, as spec §3.4 step 4 describes. Where this note and the spec disagree, the spec governs.

## Product idea

After a student has answered a question and is about to get an explanation, show a small choice of teaching styles. The picker never appears before question 1, which keeps the spec's question-first rule (spec §3.1), and it never delays the retry question. The app recommends one for the specific subject and concept, explains why, and lets the student choose another. Example: for DNA synthesis direction, recommend **whiteboard diagram** because the direction and growing end are easier to point out visually; also offer a real-life analogy or a worked example.

The choice is a preference, not a diagnosis of a fixed “learning style” or proof that one format teaches that student better. Measure whether a chosen style improves later recall, not just whether the student watches it.

The guide character and voice are separate choices from teaching style. Changing the guide must not change the approved facts, answer key, source references, or misconception mapping. Start with original characters and licensed voices. Named fictional characters and real celebrities need a separate rights-cleared path before commercial use.

## Style catalog for a small pilot

| Style | What changes | Good candidate topics | Check specific to the style |
| --- | --- | --- | --- |
| Whiteboard diagram | Draw and label a process in steps | Anatomy, molecular processes, circuits | Labels and arrows match the notes; no unexplained jump |
| Real-life situation | Place the concept in a familiar scenario | Applications, cause and effect | The analogy is accurate and its limits are stated |
| Worked example | Solve one representative problem step by step | Math, chemistry, coding exercises | Every step follows from the prior one and reaches the correct result |
| Visual process | Animate the parts of a mechanism | Cycles, pathways, procedures | Motion, order, and direction match the source |
| Compare and contrast | Put two commonly confused ideas side by side | Similar terms and misconceptions | The contrast is sourced and does not oversimplify |
| Socratic coach | Ask a question, pause, then give a hint and answer | Concept checks | The answer is hidden until the learner has a chance to respond |
| Story | Explain through a short sequence of events | Historical or causal topics | Story details do not introduce unsupported facts |
| Exam mode | Ask first, then give concise feedback and a fresh retry | Test preparation | No answer cue appears before submission |

Build only **whiteboard diagram** and **real-life situation** for the first styles pilot (after pilot 1), on one approved topic. Add a third style only after observing what students choose and whether it helps recall. The existing course renderer has five scene templates (`steps`, `compare`, `flow`, `term`, `myth_fact`); a new style may require a new scene or a different script, so the table is a product catalog, not a claim that all styles work today.

## Recommendation and student choice

1. The teacher-approved lesson outline tags each concept as `process`, `application`, `calculation`, `contrast`, or `recall`. A small deterministic mapping produces a default recommendation: process -> whiteboard; application -> real-life; calculation -> worked example; contrast -> compare; recall -> exam mode.
2. Show at most three choices and one plain reason for the recommendation. Label it **“Recommended for this topic”**, not “best for you.” The student can override without penalty.
3. Record `recommended_style`, `selected_style`, whether the student overrode the suggestion, and the topic/version ID. Do not use this preference to change grading or declare mastery. These fields fall under the data inventory in spec §3.11 and its retention rules.
4. The teacher can disable a style for a topic if its analogy or visual treatment would mislead students. Disabled styles do not appear in the picker.

An AI recommendation model is not needed for the first pilot. Add it only if the simple topic mapping produces obvious bad suggestions in observed sessions.

## Two AI layers before video rendering

The two layers inspect a **draft explanation script**, not an already rendered video. They run once per unique `(course_version, concept, teaching_style, script_version)` inside the draft generation job, never in a student session. No LLM or TTS call occurs when a student chooses a style or replays an explanation.

```text
Instructor notes + teacher-approved lesson outline + every style enabled for the topic
    -> draft script and scene plan (one per enabled style)
    -> deterministic schema checks
    -> Layer 1: source/accuracy review
    -> Layer 2: style/engagement review
    -> source review again if Layer 2 changed factual wording
    -> voice + render video and captions for every style      (still inside the draft job)
    -> asset and hash checks -> complete manifest
    -> teacher reviews the rendered version once and approves it (spec §3.5, §3.6)
    -> student picks a style -> served from the approved manifest
```

This follows the spec's review order: automated checks happen on scripts before any voice spend, and the teacher reviews once, on the complete rendered version.

### Layer 1: accuracy and source review

Input: the draft script, scene labels, answer/feedback text, and **only the note passages cited by that concept**. Uploaded notes are untrusted data; text inside them cannot change the review instructions.

Output: structured JSON containing each factual claim, its supporting excerpt ID and exact quote or page location, a verdict of `supported`, `unsupported`, or `unclear`, and a proposed correction. A missing, unverifiable, or contradictory source blocks the script. The model may suggest a correction but cannot silently approve its own rewrite. At most **one** correction draft is generated, then the revised script is checked again. If it still fails, mark it `needs_human_edit`.

Mechanical checks also require valid excerpt IDs, a source for each claim, valid diagram labels and directions, one correct answer per question, and feedback for every choice. Exact text quotes can be checked against text notes. PDF passages need a teacher to inspect the displayed page or extracted text because matching a model's claimed citation is insufficient.

An AI accuracy pass means **“no unsupported claim found by this check,” not “factually verified.”** Teacher approval remains required before students see a new script. Measure Layer 1 against the golden set and the seeded-error corpus (spec §3.5.1), and record which model runs it. Do not use it to shorten teacher review until its miss rate has been reported.

### Layer 2: teaching-style and engagement review

Input: the source-checked script, selected style, approved outline, and a short rubric for that style. It must not receive permission to add new factual claims.

Output: structured JSON with `style_fit`, `hook_clear`, `one_idea`, `plain_language`, `pacing`, `visual_change`, `closing_payoff`, and concrete revision suggestions. Each field is `pass` or `revise` with a reason. For example, a whiteboard clip must build the diagram in understandable steps; a real-life example must stay concrete and identify where its analogy stops applying.

Allow **one** style revision. If it changes a claim, term definition, number, sequence, or diagram label, run Layer 1 again. If it only changes nonfactual delivery, validate the revised script mechanically. A style pass does not override an accuracy failure.

The engagement model's score is a drafting aid, not evidence that students will find the clip engaging. Use clip completion, student interviews, repeat choice, and delayed recall to evaluate the rendered result.

## Cost, latency, and fallback rules

- A student choice never triggers an LLM review, a TTS call or a render. Every enabled style for a topic is generated, reviewed and rendered inside the draft job. Keep the number of styles small, at most two per topic in the first styles pilot. Do not pre-generate combinations of style and character beyond what the teacher has enabled.
- The teacher reviews the rendered clips for every enabled style before the version is approved; each style's clips are part of the manifest (spec §3.4 completeness rule). If a style's render fails, the draft fails, or the teacher disables that style for the topic and the job regenerates a new version without it. A missing required clip is never silently dropped. If an approved clip fails to *play* for a student, show the approved text explanation with “Video unavailable.” The answer and the retry stay available. Never block the next question on video.
- Cap the pipeline at one initial script, one accuracy correction, and one engagement revision per concept/style. A factual change from the engagement revision gets one final accuracy pass. Include all of these calls in the preflight cost estimate and the job deadline (spec §3.4). If any required check cannot finish within the deadline or cost cap, stop with a visible failed-draft state; do not publish partial content.
- Cache and manifest keys include:
  - course version, concept ID, style ID and script hash;
  - `model_id` and `prompt_version`;
  - renderer version, guide ID and voice ID.

  A changed source, script, model, prompt, style rubric, guide or voice cannot reuse an old approval or asset by accident. The spec schema needs `style_id`, `guide_id` and `teaching_move` on `version_items` before this ships (spec §3.12).
- Log model calls, retries, tokens/charges where available, teacher review minutes, render time, failures, and unique viewers per variant. Calculate cost per **approved and watched** explanation, not only cost per generated draft.

## How to test whether this is an advantage

For one concept, offer two approved styles with the same learning objective and answer standard. Randomly assign a style to part of the cohort and let the rest choose. Only the randomized group can show whether a style *causes* better recall; the self-choosing group shows preference. Record which style students choose and whether they finish it. Later, use a **new** question to test recall; do not reuse the prompt from the clip. Also compare time to first useful answer and teacher review effort. Review time for two styles must fit the per-lecture contribution target in spec §3.13. Keep instructor-prompted and voluntary use separate.

This feature becomes a defensible advantage only if course-specific style choices and mistake data improve the student's outcome or the instructor's repeat use at a sustainable cost. A style picker, AI judge scores, and character skins alone are easy to copy.

## Relation to current project

- `Context/Team_Spec.md` and `planning/CLIPCADEMY_V2_BOARD_SPEC.md` define the reviewed-content and question-first direction. This note adds a student choice and two pre-render script checks. It does not supersede the teacher approval, server-owned progress, or no-provider-calls-in-student-sessions requirements, and spec §3.12 sets when it may be built.
- Named characters, celebrity voices and any licensed voice need a named rights owner before use (spec §3.12 condition 8).
- `video/course/generate.py` currently drafts clips with Gemini and validates their structure; `video/course/templates.py` provides five scene types. Neither is the two-layer review described here.
- `learning/course_worker.py` and `learning/courses.py` currently publish generated course material without this review gate. Do not describe the proposed style picker or AI layers as shipped.
