# ClipCademy board review: v2 spec and teaching-styles proposal

Date: 2026-11-19. Scope: `planning/CLIPCADEMY_V2_BOARD_SPEC.md` (SPEC) and `Context/TEACHING_STYLES_AND_AI_REVIEW.md` (STYLES) only. Directors read nothing else, so anything that exists in code but not in these documents counts as a gap here. The board consists of simulated review roles defined in `.claude/agents/board-*.md`. They are not real directors.

## Scorecard

| Director | Verdict | Headline |
| --- | --- | --- |
| Strategy (CEO) | **Red** | No buyer, price or channel. The only evidence of demand is 0/6 return and 2/6 "very disappointed" (SPEC:11). |
| CTO | Yellow | A sound, conservative pilot design, but STYLES reopens rendering triggered by students. Growth past one instructor is not modeled. |
| AI Director | Yellow | Good claim-level grounding. No pinned model or prompt version and no factual eval set. |
| Security and Privacy | Yellow | Strong private-draft and server-state design. No data inventory, vendor terms, retention or deletion policy. |
| Quality and Reliability | Yellow | A strong release gate on paper (SPEC:157-161). The grading state machine needs table-driven tests, and none of it is built yet. |
| Learning Science | Yellow | Question-first and new delayed items are right. No re-read control, no sample size, and spacing is a single 24-hour step. |
| CFO | Yellow | Spending caps and cost logging are good. No price, revenue source, review-hour rate or runway. |
| Product and Growth | Yellow | The student loop is well specified. No target for upload-to-approved-class time and no trigger that tells students the due set is open. |

## Where the board agrees

1. **The two documents contradict each other on rendering.** Seven of eight directors found this. STYLES:75 lets "a first request" trigger rendering. SPEC:36 and SPEC:46 forbid any LLM or TTS call during a student session, and SPEC:106 requires every clip to be rendered and hashed before review. STYLES:88 says it "does not supersede" SPEC, yet it does.
2. **Teaching styles should stay out of pilot 1.** Seven of eight agree. Security did not object, provided styles are pre-rendered. Styles double the teacher's review load (STYLES:75 against SPEC:18 and SPEC:27), blur what the pilot can attribute results to, and are missing from SPEC's build sequence (SPEC:3.10).
3. **The commercial side is empty.** SPEC:153's contribution formula starts with "attributable revenue", but no document says who pays, how much, or at what rate teacher review is valued.
4. **Teacher review is the real factual gate and the largest cost**, and its time has not been measured (SPEC:27, SPEC:112, STYLES:60).
5. **The plan's honesty is an asset.** Rules such as "no claim without evidence" (SPEC:38), the warning that "a format pass is not a factual pass" (SPEC:112), and the statement that styles are "not a learning style" (STYLES:9) would hold up in front of a district or a department chair.

## Disagreements and the chair's rulings

| Issue | Positions | Ruling |
| --- | --- | --- |
| When review happens relative to rendering | AI Director: adopt STYLES's order of reviewing scripts before render, so no voice credits are spent on drafts that get rejected. CTO and Quality: everything must be rendered and hashed before approval. | **Both.** Automated checks (schema checks plus Layer 1 source review) run on scripts *before* voice and render. The teacher reviews once, on the complete rendered manifest. This adds no extra teacher step. |
| Study design versus speed | Learning Science: a three-arm preregistered study with a minimum sample size. Strategy and CFO: the buyer and the second assignment matter more. | **Run the study, but don't let it block the pilot.** Add a re-read-notes condition through counterbalancing *within each student* (some concepts with clips, some with notes). That works at a single-course scale. The second assignment remains the go/no-go gate. |
| Whether styles come back | Product and CFO: only after due-set return and the second assignment. Learning Science: only with random assignment of styles. | **Both conditions apply.** Styles return after the pilot reads out, with randomized assignment for part of the cohort, and every style pre-rendered in the manifest. |

## The one thing that makes everything else irrelevant

The pilot can pass every engineering gate in SPEC 3.9 and still teach the company nothing about whether it has a business. Alpha return was 0/6, and no buyer or price is written down. **Pilot 1 must test a priced ask to a named buyer, not only whether the software holds up.**

## Resolutions

1. **Fix the conflict between STYLES and SPEC.** Mark teaching styles and the two AI review layers as *deferred from pilot 1* in STYLES. Replace STYLES:75 with "every style is rendered and hashed into the approved manifest; no provider call is triggered by a student". Add Layer 1 script review as an automated step before render in SPEC 3.4. Owner: spec author. Due: 2026-11-21.
2. **Write the one-page business case before recruiting.** It covers the paying buyer (recommended: the intro-bio instructor or their department), a test price, the hourly rate for teacher review, a contribution target per lecture, and the channel for instructors 2 through 10. Ask the pilot instructor for payment as a priced ask. Owner: founder. Due: 2026-11-26.
3. **No real student joins until a data inventory is published.** It lists each data type, where it is stored, which vendors receive it, how long it is kept, and how it is deleted (including backups). It also confirms Gemini and ElevenLabs no-training and retention terms, states student ages and whether anyone is under 13, records the instructor's attestation of rights to the notes, and adds a rate limit on join and session creation. Owner: security and privacy lead. Due: before the first student invite.
4. **Make AI quality measurable.** Add `model_id` and `prompt_version` to `course_versions`, `release_records` and the cache key. Build a golden set of 30-50 items from the pilot lecture and the teacher's corrections, plus a corpus of scripts with deliberately planted errors. No model or prompt change ships without an eval run. Include the review-layer calls in the $5 preflight estimate. Owner: AI and pipeline lead. Due: before the first pilot generation.
5. **Preregister the pilot and close the gaps in the student loop.**
   - Primary outcome: the score on new items at 48 hours.
   - A re-read-notes comparison through within-student counterbalancing, plus the chatbot arm (SPEC:149).
   - A minimum sample size and a stopping rule.
   - `needs_review` and missed objectives go into the due set first.
   - The instructor sends a link when the due set opens, logged as `instructor_prompted`.
   - A written target for time from upload to an approved class.
   - Table-driven tests over every state and event pair in SPEC:141.

   Owner: product lead with learning science. Due: before recruitment.

## Open questions for the founders (consolidated)

- Which exact Gemini model ID is used: a pinned version or a moving alias? Which model runs the review layers, and is it independent of the generator?
- What are the measured render time, disk use and dollar cost per clip and per version? Is the $5 cap based on real prices?
- Do the server and worker share SQLite safely (WAL mode, busy timeout)? What CPU, memory and time limits does the renderer actually get?
- Who writes the misconceptions and distractors? What clip length and how many new terms per clip are the targets?
- Who is paged when generation or the deployed smoke test fails? Who confirms that real-phone playback was actually tested?
- Is IRB or consent handling needed for the pilot study?
- Who owns rights clearance for guide characters and voices (STYLES:11)?
