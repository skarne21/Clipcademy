# ClipCademy: a moat to earn, not claim

Date: 2026-11-19. Board-style strategy proposal. The roles below are decision lenses, not actual directors or approvals. This is a product and pilot plan; the proposed capabilities are not shipped unless explicitly identified as current.

## Board decision

**Build the instructor-owned misconception loop for one course.** ClipCademy should become the quickest trustworthy way for an instructor to turn *their own lectures* into a short, assigned recall check, see the mistakes students actually make, and improve the next explanation and question set. The app quickly proposes topics from uploaded notes; the instructor edits the topic map and chooses how each topic should be taught. Students answer first, receive a source-linked video or text explanation for the specific error, then face a fresh question later. The instructor reviews and approves the version before students see it.

The proposed moat is the **accumulating, permissioned course record**: instructor-approved objectives, answer keys, source passages, misconception mappings, student error patterns, which approved explanation variants help on *new* questions, and the instructor's repeated use of that record across lectures and cohorts. The record becomes more valuable if it reliably saves preparation time and improves decisions about what to reteach. A competitor can copy short videos, a style picker, or a prompt. It takes sustained instructor participation and measured classroom use to recreate a trusted record for a particular course. This is a hypothesis about future defensibility, not a claim of exclusive data, a network effect, or a moat today.

**Customer and wedge:** start with an instructor teaching one exam-relevant course, with a narrow lecture set. The teacher is the distribution path and likely budget owner; the student is the daily user. The initial promise is: *“Give your class a three-question check from your lecture, see exactly what they missed, and send the next useful explanation.”* A class code and a one-minute student flow preserve the current concept. Do not expand into a universal video library or a general study chatbot.

## Why this is the strongest available path

| Board lens | What it sees | Decision for the moat |
| --- | --- | --- |
| Product | Six-student alpha cleared usability but missed its prespecified learning, return, and demand gates. A question-first set and fresh due questions directly test the weak points. | Optimize for an answer and actionable feedback before clip consumption. Tie the due set to the instructor's next quiz or lecture; measure voluntary and assigned use separately. |
| Education and ML | General AI products can already quiz on uploaded notes and explain mistakes. Fluent generated content and AI reviewers can both be wrong. | Use a reviewed course outline and answer standard; map each wrong answer to a named misconception; test each remedy on a *different* question. AI checks are drafting aids, with source checks and teacher approval before release. |
| Systems and trust | Today's beta auto-publishes generated material, starts with clips, and has known generation/regeneration risks. A teacher cannot build a habit around unreliable classes. | Make private, immutable course versions and explicit approval the foundation. Keep the prior approved version live through failed generation. Pin student sessions to versions and keep progress on the server. |
| Economics and investor | Per-clip review, unused renders, and broad subject expansion could consume margin before demand exists. | Review scripts and answer keys before rendering; render only reviewed, likely-used explanations. Measure cost per approved and watched explanation and contribution per lecture. Require a second assignment from the same instructor before scaling content. |

## The compounding loop

1. **Upload and fast topic map:** the instructor uploads notes. The app extracts a short topic outline with source locations, proposed objectives, key terms, and likely misconceptions. This is a quick draft for teacher correction, before costly voice or video work. Record permission and source scope; do not assume ownership of the instructor's materials.
2. **Teacher chooses a bounded teaching plan:** the instructor selects the few topics needed for the next assignment. The app recommends a style for each; the teacher can accept all recommendations at once, set one course-wide default, or override a specific topic. They can merge or remove topics and add a plain-language instruction such as “show the strand direction on a whiteboard” or “avoid the zipper analogy.” Uploading a long document does not generate a video for every extracted topic. The topic map can wait for later assignments.
3. **Generate a private lesson draft:** only for selected topics, create three question-first items for the lecture, fresh due questions, answer keys, source-linked feedback, misconception mappings, and concise scripts/storyboards for the chosen styles. Automated structural and source checks flag missing evidence, contradictory answers, and unsupported claims for teacher attention; they cannot establish factual correctness. The teacher sees a short summary of objectives, answer keys, and teaching approach, with flagged items expanded. They can edit text or request a targeted rewrite. A changed fact, answer, label, or source must be checked again. In the narrow pilot, the teacher also reviews the complete new question and script set so the defect rate and time burden can be measured.
4. **Render and release the videos:** generate a default short video only for selected topics and the approved remediation videos most likely to be needed; generate an alternate style only where the teacher elected to offer it. Automated checks verify structure, captions, duration, asset delivery, and consistency with the approved script. In the small pilot, the teacher previews every newly rendered clip and gives final approval of the complete version. Reused unchanged clips need no new content rewrite, though the teacher confirms they still match the lecture. The approved version is stable, and a failed replacement cannot erase it.
5. **Students practice and choose:** a student answers first, then sees the mapped video explanation or requests an explanation. If the teacher approved an alternate style for that topic, the student may switch between the available versions. The style never changes the answer key or declares a fixed “learning style.” A missing video leaves approved text feedback and the next question available. A later set uses new questions to see what stuck.
6. **The instructor gets a useful action:** show misconception counts, representative *anonymous* wrong answers where permitted, change on a new delayed question, and a suggested concept to reteach. The teacher can amend the next version or assign the next lecture set. Aggregate carefully: a small class or biased set can make a count misleading.
7. **Approved assets are reused:** carry forward stable objectives, approved explanations, corrections, and item history into the next cohort with a fresh review against changed notes. The teacher's course record saves work only if reuse is genuinely faster than preparing the material again.

This is a reinforcing loop only if the instructor uses the insight, corrects content, and assigns again. More answer events alone are not a moat. Prefer a small, high-quality dataset that changes instruction over a large pile of click logs.

### Keep teacher review small enough to finish

For the first two-topic pilot, aim for one default explanation per topic, one alternate style on one topic, and at most two video follow-ups for the most important misconceptions: **about five newly rendered clips**, rather than a full video for every possible wrong answer and style. Other approved feedback can be text until a mistake is common enough to justify a clip. The teacher reviews three questions and their answer/feedback pairs as a batch for the lecture, then the short scripts for those five clips, and finally previews the five rendered results before publication. The exact count is a pilot cap to test, not a permanent product limit. Record active review minutes and corrections; if this is still too burdensome, reduce the clip set or ask the instructor for an answer key instead of treating teacher time as free.

At larger scale, reuse unchanged, previously approved assets and show the teacher a focused diff when notes or scripts change. Automated checks can flag mismatched captions, missing sources, and broken files, but they cannot certify subject accuracy or automatically approve a new factual explanation. Any future lighter review policy must be tested with real defect and correction data before it replaces the pilot's full preview.

### Board decision on large uploads and review load

| Lens | Concern | Required design choice |
| --- | --- | --- |
| Product | A teacher will abandon a workflow that turns every upload into homework. | Show the topic map quickly, let the teacher accept style recommendations in bulk, and ask for decisions only on topics selected for the next assignment. Time the workflow with an instructor who gets no help. |
| Education and trust | A model can confidently write the wrong explanation or answer. | Keep new factual content private until the teacher accepts a bounded batch. Show source and answer-key exceptions clearly. Do not label AI output “verified.” For the pilot, review every new question, script, and rendered clip to learn the actual defect rate. |
| Systems | Long notes multiplied by topics, styles, misconceptions, and retries can create an unbounded queue and cost. | Separate fast extraction from generation. Cap selected topics, styles, clips, model calls, spend, and job time. Cache immutable approved assets and never regenerate all content on a minor edit. |
| Economics | Human review and video creation may cost more than the course is worth. | Generate the default style first, allow at most one alternate where selected, use text feedback for rare mistakes, and measure total teacher minutes and cost per approved, watched clip. Stop broadening if contribution per lecture stays negative. |

**Decision:** a teacher should not review every possible question and video from a large upload. The app should generate only a small selected assignment. Full review of that small batch is the current pilot's trust and measurement gate, not a viable promise for unlimited uploads. Later, expand only with evidence that automated checks, source-grounded drafts, reuse, and focused review reduce teacher time without allowing unacceptable errors. If the teacher still has to do extensive editing, the product is not solving their problem; narrow generation to teacher-supplied answer keys and a few high-value clips.

## Minimum product changes from the current beta

**Must precede a live instructor pilot**

- Fix bounded generation failure and preserve the active class during failed regeneration. Verify the actual deployed media, including captions and playback. These protect the trust on which the loop depends.
- Add private draft, deterministic completeness/source checks, instructor review and version approval. Record source status honestly, including PDF passages that require human checking.
- Put a fast, editable topic map immediately after upload. Let the teacher select topics for one assignment, accept style recommendations in bulk, and override only where needed before questions, scripts, voice, and video are generated. Show one grouped content review for the selected batch, with direct edits and targeted regeneration, before the short final media preview.
- For one course, present three questions before explanations; save server-owned progress; add three fresh due questions after 24 hours. Keep the existing mapped follow-up clips where they help. Track prompted, reminder-driven, and unprompted returns separately.
- Give the instructor one concise misconception report: objective, number eligible, first-answer distribution, due-question result, and the approved source/explanation that could be revised. Do not make the dashboard a new analytics platform.

**Run as a contained experiment, after the core loop works**

- Let the teacher select a default style for each pilot topic and offer an alternative where they believe it helps. Test two approved explanation styles for one concept, starting with whiteboard and real-life situation as proposed in `Context/TEACHING_STYLES_AND_AI_REVIEW.md`. Keep the same objective, answer standard, and new delayed question. Collect choice and override, but judge value by recall, teacher effort, and cost rather than preference or watch time alone.
- Use the two AI script review layers to catch issues before rendering, with deterministic checks and teacher sign-off. Label model output as a check, not a certification. Cache by course/version/concept/style/script and media versions so replays do not incur new model calls.

**Defer:** character or celebrity likenesses, a broad style catalog, arbitrary subject coverage, thousands of lectures, live student-facing generation, and a school-wide account platform. None strengthens this course-specific loop before repeat assignments and positive economics exist.

## Moat ladder and evidence gates

| Stage | Defensible asset sought | Evidence to move on | What would disprove it |
| --- | --- | --- | --- |
| 0. Functional pilot | Reliable teacher-approved class and question-first student path | One instructor publishes without team intervention; no draft leak; old class survives failures; deployed clips work | Review is confusing or the class fails in real use |
| 1. Workflow pull | Instructor distribution and habit | The same instructor assigns a second lecture set, uses the misconception report to change teaching, and gives a concrete next-term use or payment commitment | Teacher can get equal value from notes plus a general AI tool with less effort |
| 2. Learning advantage | Tested misconception-to-remedy mappings | Preregistered same-material, equal-time comparison with a strong chatbot; new questions at least 48 hours later; report all participants, uncertainty, and return source | Delayed recall, task completion, or teacher time is no better than the alternative |
| 3. Reuse and economics | Approved course assets reused across cohorts | Measured decline in review minutes or cost on a second cohort, stable or improving quality, and nonnegative contribution per lecture | Every cohort requires near-total rework or video/review cost outruns value |
| 4. Expansion | Repeated instructor/course relationships | Several independent instructors repeat the pattern with limited founder help and explicit permission to use their materials | Growth requires bespoke services or broad content generation before teacher pull |

The first pilot should stay within the narrow limits in `planning/CLIPCADEMY_V2_BOARD_SPEC.md` (one named instructor, one course, at most two lectures and two objectives per lecture). The later three-teacher pilot proposed in the red-team response is an expansion check, after the one-instructor workflow and reliability gate. Set numeric success thresholds and a comparison protocol *before* recruiting; do not choose a threshold after seeing results.

## Test against the strongest substitute

As of this decision, [ChatGPT Study Mode](https://help.openai.com/en/articles/11780217-study-mode) can work with uploaded course material, quiz a student, and explain errors; [NotebookLM](https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-app-quizzes-flashcards/) offers source-based quizzes and flashcards. These are real substitutes for basic clip and quiz generation. ClipCademy's proposed advantage must therefore be instructor-approved course alignment, an assigned workflow, a stable misconception record, and measurable follow-through. This is a strategic inference from those products' stated capabilities, not a claim that either lacks teacher features.

In the comparison, give both groups the same material and study time. Use a strong, ordinary-user chatbot prompt, not a deliberately weak one. Score unaided time to first useful answer, correct answers on unseen questions at 48 hours or later, instructor preparation/review minutes, return by trigger, and a concrete repeat-assignment decision. Document outside studying and missing data. A small pilot can expose friction and estimate direction, but cannot prove a durable causal learning advantage.

## Data and economics rules that make this credible

- Obtain the instructor's permission to process notes and tell them when third-party models receive them. Keep the approved course record scoped to that instructor and version. Use student attempts for aggregate improvement only under the pilot's consent and retention rules; do not sell or pool identifiable student responses across courses.
- Keep the answer key, source evidence, teacher corrections, and student attempt sequence auditable. Report the alpha's recorded +8.33 percentage-point effect separately from the -1.67-point sensitivity analysis; neither met the preset +15-point mean gate. The alpha also recorded 0/6 qualifying returns and 2/6 “very disappointed.”
- Per lecture, log draft acceptance, corrections, teacher and founder review minutes, provider and rendering charges, hosting, support, and reuse. Contribution = attributable revenue minus these costs. If the first course cannot be reviewed and reused economically, narrow to teacher-provided answer keys and clips only for frequent mistakes before widening generation.

## Board recommendation in one sentence

Earn a moat by becoming the trusted, repeated recall-and-misconception workflow inside an instructor's actual course; treat videos, style choices, and AI review as supporting components whose value must be proven against strong general-purpose study tools.

## Internal evidence and design sources

- `planning/PRODUCT_WEAKNESSES_SOLUTIONS.md` — current weaknesses, smallest product changes, competitor test, economics, and stop rules.
- `planning/CLIPCADEMY_V2_BOARD_SPEC.md` — simulated board decisions, reliability and approval architecture, narrow pilot, and evidence gates.
- `Context/TEACHING_STYLES_AND_AI_REVIEW.md` — proposed style choice and two script review layers; explicitly unimplemented.
- `Context/readteaming/FOUNDER_REDTEAM_RESPONSE.md` — verified reliability risks and later three-teacher pilot proposal.
- `validation/study/RESULTS.md` and `README.md` — alpha measurements and the current product behavior.
