# ClipCademy v2.1: simulated board review and hardened pilot specification

Date: 2026-11-19. Revision: **v2.1** (same day). Status: **design proposal, not implemented or certified**. The board roles below are simulated review lenses, not real directors, and nothing here is an approval. No software is failproof. This design aims to keep failures visible, bounded, and recoverable.

**What changed in v2.1.** An eight-seat simulated board reviewed v2.0 together with `Context/TEACHING_STYLES_AND_AI_REVIEW.md`. The seats were CTO, AI, security and privacy, quality, learning science, strategy, CFO, and product. The full record is in `planning/BOARD_REVIEW_2026-11-19.md`. This revision adds:
- a commercial gate (Mandate 11, §3.13);
- a data-protection section (§3.11);
- model and prompt pinning with an evaluation set (Mandate 9, §3.5.1);
- the rule that scripts are checked before any voice spend (§3.4);
- learning-science controls (§3.1, §3.8);
- explicit deferral of teaching styles (§3.12);
- scaling limits (§3.14);
- owners, and pilot defaults where v2.0 left values blank.

Every number marked *(pilot default)* is a starting value to revise after measurement, not a measured result.

## Scope and baseline

ClipCademy is an education product, not an autonomous coding agent. The requested AI/ML, systems, developer experience, and investor perspectives apply to uploaded course material, generated lesson artifacts, student practice, and release operations. AST parsing, code execution sandboxes, and generated-import checks are not applicable to the current repository because it does not run generated source code. If the product later adds code execution, that requires a separate threat model and spec.

Source priority: the Nov 4-5 Part 1 written document and Alpha Demo establish alpha results and the **proposed** question-first/daily-set pivot; the Nov 17 feedback challenges that proposal; the Step 1 board table below evaluates the proposed responses; current code establishes what is built. The beta currently serves clips before questions and automatically publishes generated classes. This v2 specification replaces those beta behaviors for the narrow pilot. It does not rewrite historical alpha evidence.

Alpha evidence: six intro biology students completed a one-day study. Usability met its gate; recorded learning effect was +8.33 percentage points (5/6 positive), below the preset +15-point mean threshold; qualifying return was 0/6; “very disappointed” was 2/6. The separate one-point-per-student score adjustment yields -1.67 points (2/6 positive) and is a sensitivity analysis, not observed scoring. The Alpha Demo reported 0/35 expected clip URLs on the deployed host at its historical snapshot. Current live deployment health has not been verified in this review.

### Step 1. Board review of the proposed solutions

| Proposed solution and original weakness | What works; board perspectives | New risks and required change | Verdict |
| --- | --- | --- | --- |
| **Question first and a three-question due set** to address weak learning and 0/6 voluntary return | Product: recall before explanation is a clear task; a short set lowers time to value. Investor: more content is cheap only if it produces repeat use. | Product: “more questions” alone is not a return trigger. ML: recycling a memorized item can fake improvement. Add instructor relevance, new delayed questions, separate prompted from unprompted return, and a preregistered comparison. | **[APPROVED WITH MODIFICATIONS]** |
| **Teacher-reviewed private draft** to address unchecked AI content | Security: a private draft prevents bad answers reaching students. Product: a named teacher owns quality. | Investor: reviewing every clip for every lecture may erase margin. Systems: a draft could leak through public media routes or be approved while generation is incomplete. Require version-scoped access, a completeness gate, atomic approval, and measured review minutes. | **[APPROVED WITH MODIFICATIONS]** |
| **A versioned style card and shared lesson outline** to address inconsistent clips | ML: fixed terminology and scene templates reduce drift. Product: consistent clips are easier to follow. | ML: a prompt can still produce a fluent wrong claim; longer context increases cost and can degrade output. Use a compact, bounded style schema, deterministic content validation, and human review. Do not repeat the entire lecture in every call. | **[APPROVED WITH MODIFICATIONS]** |
| **Stage replacement, then switch the live class** to address destructive regeneration | Systems: a transaction can preserve the current version. Product: students retain a usable class during failure. | Systems: a database switch is not enough if files are overwritten or old progress points to deleted questions. Use immutable version directories, pin active student sessions, and retain old files until safe expiry. | **[APPROVED WITH MODIFICATIONS]** |
| **Bounded provider failure and retry handling** to address a stuck single worker | ML: a finite task graph eliminates the v2 wait deadlock. Systems: timeouts and a terminal failure free the queue. | Investor: automatic retries can multiply spend; product: hidden partial success looks like completion. Cap attempts and job budget, classify retryable errors, expose job stage and safe error code, and fail the draft if required items are missing. | **[APPROVED WITH MODIFICATIONS]** |
| **Server-owned progress and input validation** to address forged completion, malformed 500s, and unbounded dedupe memory | Security: a server-side state machine rejects out-of-order attempts. Product: a refresh can resume accurately. | Systems: anonymous sessions can be lost or replayed; stale clients may send an old version. Persist session/version/attempt IDs, enforce idempotency and sequence in one transaction, and return a recoverable conflict snapshot. | **[APPROVED WITH MODIFICATIONS]** |
| **Same-material chatbot comparison and instructor pilot** to test moat and demand | Investor: tests whether course workflow beats the cheapest substitute. Product: second assignment is stronger evidence than compliments. | Product: a poor chatbot prompt or unequal study time biases the comparison. Preregister tasks, prompt, time, scoring, and sample; distinguish an instructor assignment from voluntary return. Avoid claiming exclusivity from lecture permission. | **[APPROVED WITH MODIFICATIONS]** |
| **Failure-path release gate and evidence table** to address 68% coverage and weak presentation traceability | Systems: critical behavior matters more than a line percentage. Product: raw rows and demo status make claims auditable. | Systems: a large flaky suite can slow releases without improving safety. Use one reproducible Linux/container gate, deterministic fakes for paid providers, a short browser smoke, and an actual deployed media check. Report skips and failures. | **[APPROVED WITH MODIFICATIONS]** |
| **Universal lecture generation and a library of thousands of lectures** as a way to defend against copies | Investor: this scales review and generation cost before distribution or retention exists. ML: arbitrary subjects increase factual and visual errors. | Narrow the pilot to one instructor, one course, at most two lectures and two objectives per lecture. Reconsider breadth only after repeat assignment and positive contribution per lecture. | **[REJECTED - REQUIRES REDESIGN]** |
| **Student-chosen teaching styles with two AI script reviews** (`Context/TEACHING_STYLES_AND_AI_REVIEW.md`) to address one-size-fits-all clips (added in v2.1) | Learning science: framing styles as a preference, not a "learning style", is honest. AI: reviewing scripts before render avoids spending voice credits on drafts that get rejected. Product: the deterministic recommendation needs no model call. | Rendering on a student's first request breaks Mandate 6 and the completeness rule. Two styles double teacher review before review time is measured. Students who pick their own style cannot show that the style caused any gain. The picker competes with question-first placement. Style IDs have no column in the schema. Review-layer calls are missing from the cost cap. | **[DEFERRED - see §3.12]** |

The board's main disagreement is about review: Security wants no unreviewed publication; Product resists a slow, per-clip workflow; Investor resists central staffing. Consensus for this pilot is **teacher approval of a complete version, automated structural checks, and founder audit of the first few classes**, with measured review time. No claim of factual verification is allowed before that process actually runs.

v2.1 settles three more disagreements:
- **Review order.** AI wanted scripts reviewed before render; systems and quality wanted everything rendered and hashed before approval. Both are adopted. Automated schema and source checks run on scripts *before* any voice or render spend. The teacher then reviews once, on the complete rendered manifest, so the teacher has no extra step.
- **Study rigor versus speed.** A re-read-notes comparison is added by counterbalancing concepts within each student. That works with one course and does not delay the pilot. The instructor's second assignment remains the go/no-go gate.
- **Teaching styles.** Deferred until the pilot reads out (§3.12).

### Step 2. Consensus architectural mandates

1. **One source of truth for class versions.** Every clip, question, media file, attempt, and review decision has a `version_id`. New sessions use the approved active version; existing sessions stay pinned to their original version. Never mutate or overwrite an approved version.
2. **Drafts are private and incomplete by default.** Public class, media, and attempt routes return only approved versions. Approval requires a complete manifest, source review, teacher confirmation, and a successful media integrity check. A failed or rejected draft leaves the active version intact.
3. **Generation is a bounded state machine, not an open-ended agent.** Fixed task graph; at most two concurrent provider calls; two attempts per retryable call; no recursive tool use; one repair attempt for schema-invalid output; finite job deadline and cost cap. Uploaded notes are data and cannot amend system rules.
4. **The server owns learning state.** The browser sends a selected choice and opaque IDs. It cannot submit `satisfied_question_ids`, `remediation_count`, or completion state. Attempt acceptance, result storage, and state transition are one transaction.
5. **Question first is a measurable product experiment.** A student sees a question before the explanatory clip and answer key. A later set uses new items for the same concepts. Measure instructor-prompted, reminder-driven, and unprompted use separately.
6. **Safety and cost limits are configuration with hard ceilings.** No provider call occurs in a student session. A pilot job cannot exceed the maximum objectives, source bytes, calls, renders, deadline, or estimated budget. A missing key or failed preflight fails before paid work.
7. **A release needs behavioral evidence.** Critical failure tests, teacher and student browser flows, media delivery, real-phone playback, and a versioned release record are required. Line coverage is reported but has no standalone pass threshold.
8. **Claims follow evidence.** The alpha's recorded and adjusted analyses stay separate. No learning, chatbot, reviewer-scale, moat, or “verified content” claim is made without the matching observation.
9. **Every generated artifact can be traced to its model and prompt.** Each version records the exact model ID (never a moving alias such as `-latest`) and the prompt version. A change of model or prompt ships only after the evaluation set passes (§3.5.1).
10. **No real student before a data inventory.** Every student-data type has a documented store, recipients, retention period and deletion path, and the AI vendors' terms are confirmed (§3.11).
11. **The pilot tests a business, not only software.** A named buyer, a test price and a review-hour rate are written down before recruiting. The pilot ends with a priced ask (§3.13). Passing every engineering gate without this does not count as a successful pilot.

### Step 3. Hardened code specification v2.1

#### 3.1 Product boundary and pilot limits

- Pilot tenant: one named instructor and one course; at most two uploaded lectures, two objectives per lecture, two mapped misconceptions per objective, and two follow-up versions per misconception. A request beyond these limits returns `422 PILOT_LIMIT` before generation.
- Initial assignment: exactly three required questions per lecture. A second, due set contains exactly three **different** questions on the same concepts, available 24 hours after the first set is completed. Do not claim the due set is voluntary if the instructor assigns it or a reminder drives it.
- Due-set priority: objectives that ended `needs_review` or were missed in the first set fill the due set's slots first, using retry items not yet asked in that session. If no unused item remains for such an objective, the due set includes that objective's key points and the teacher dashboard flags it. A weak objective is never silently dropped from spaced practice.
- Due-set notice: when the first student's due set unlocks, the teacher dashboard shows a ready-to-send class message with the join link. Returns after that message is sent count as `instructor_prompted`. The pilot sends no automated email or push, so `reminder_driven` is reserved for a later channel and must read zero in pilot 1.
- Student session: no LLM or TTS calls. All questions, answer keys, feedback, clips, and captions come from an approved immutable version. Biology `BIO101` may remain available as a separate legacy path, labeled as such; its study and beta data must not be mixed with v2 pilot metrics.
- On the first useful screen for a lecture, present question 1 with no intro clip. An optional “Review first” action may play an approved clip, but log that exposure and analyze those students separately. The answer and explanation are hidden until submission.
- Wrong answer: show short feedback, then the misconception's approved v1 clip and a new retry question. If the same misconception is missed again, use its approved v2 clip and a different retry. After two remediation cycles for the objective, show `needs_review`. A failed clip may be skipped with text feedback and a visible “Clip unavailable” notice; the answer and retry remain available. Correct answers never erase the remediation count.

#### 3.2 Data schema and invariants

Use SQLite on the existing persistent volume, with foreign keys enabled and migrations applied before serving traffic. IDs are server-generated UUIDs except the existing six-character join code. Essential tables/fields:

```text
courses(course_id PK, teacher_id, join_code UNIQUE, title, active_version_id NULL, created_at)
course_versions(version_id PK, course_id FK, parent_version_id NULL, state,
                style_version, model_id, prompt_version, voice_id, renderer_version,
                manifest_sha256 NULL, created_at, approved_at NULL,
                approved_by NULL, rejection_reason NULL)
version_items(item_id PK, version_id FK, objective_id, kind, variant_id NULL,
              content_json, source_refs_json, source_verified, artifact_sha256 NULL)
generation_jobs(job_id PK, course_id FK, version_id FK, state, stage, error_code NULL,
                attempts_used, estimated_cost_minor, started_at NULL, deadline_at,
                finished_at NULL)
student_sessions(session_id PK, course_id FK, version_id FK, opaque_token_hash UNIQUE,
                 created_at, last_seen_at, expires_at)
set_instances(set_id PK, session_id FK, lecture_id, kind, state, due_at NULL,
              current_question_id NULL, current_objective_id NULL, revision)
objective_states(set_id FK, objective_id, status, remediation_count,
                 satisfied_json, asked_retry_json, PRIMARY KEY(set_id, objective_id))
attempts(attempt_id PK, set_id FK, version_id FK, question_id, selected_choice_id,
         request_sha256, result_json, resulting_revision, created_at)
review_events(review_id PK, version_id FK, teacher_id, decision, checklist_json,
              review_seconds, created_at)
release_records(release_id PK, commit_sha, build_id, migration_version,
                model_id, prompt_version, eval_result_json,
                test_manifest_json, deployed_at, smoke_result_json)
eval_runs(eval_run_id PK, model_id, prompt_version, eval_set_version,
          seeded_error_catch_rate, golden_pass_rate, result_json, created_at)
```

`model_id` must be an exact, dated provider model identifier. Generation refuses to start if the configured model is an alias. Changing any of `model_id`, `prompt_version`, `voice_id` or `renderer_version` produces a new version; it never alters an approved one.

`course_versions.state` is one of `draft`, `generating`, `ready_for_review`, `approved`, `rejected`, `failed`, `superseded`. Only `approved` or `superseded` versions may be pinned by students; `superseded` stays readable for existing sessions. `courses.active_version_id` points only to `approved`. A draft's files live under `/data/courses/<course_id>/versions/<version_id>/` and are never written into another version's directory. Media URLs resolve through the session's pinned version and the stored manifest, never a filename supplied by the client. The public class code alone never grants draft access.

Allowed version transitions: `draft -> generating -> ready_for_review -> approved`; `ready_for_review -> rejected`; `draft|generating -> failed`; `approved -> superseded` only when another version is approved. `rejected`, `failed`, and `superseded` are terminal. A correction creates a new child draft with `parent_version_id` set to the rejected/failed version, preserving the audit trail. No API accepts an arbitrary state change.

Source verification is an explicit enum: `exact_text_match`, `teacher_checked_pdf`, `unverified`. `unverified` blocks approval. A source ref merely present in model JSON does not count as verified. The instructor's checklist records each correction; the product may say “teacher approved” only if `approved_by` and the checklist are persisted.

All version and attempt writes use short SQLite transactions (`BEGIN IMMEDIATE` where needed). The course active-version switch and approval record commit together. File writing and rendering happen **outside** that transaction; approval verifies files and hashes before entering it. Do not hold a database lock across provider or render calls.

Migration from current beta rows: create a version for each existing course and copy its clips/questions and media references without changing the old files. Mark the version `draft`, not `approved`, because automatic publication did not establish teacher review. Keep legacy student routes available only for existing explicitly identified beta classes during a short transition; do not silently treat their browser `localStorage` state as trusted v2 state. The teacher must approve a complete migrated version before v2 pilot sharing. If migration fails, retain the old database and media snapshot and do not start the v2 server.

#### 3.3 Teacher authentication and upload boundary

- For the one-instructor pilot, keep one revocable teacher secret, but exchange it for an 8-hour server-side session cookie with `HttpOnly`, `Secure`, `SameSite=Lax`; clear it on sign-out. Do not persist the teacher secret in browser `localStorage`. Mutating teacher routes require a CSRF token bound to that session. Require HTTPS outside localhost.
- Production browser access uses an explicit allowed-origin list containing only the deployed app origin. Requests with another `Origin` receive no permissive CORS header. Do not rely on CORS as authentication; session and CSRF checks still apply.
- Limit sign-in to five failed attempts per client IP in 15 minutes, then return `429` with a 15-minute retry window; log only a keyed hash or redacted IP, not credentials. Put a second edge limit on upload and generation routes. This is a pilot control, not a substitute for teacher accounts at broader scale.
- Accepted uploads: PDF, UTF-8 `.txt`, UTF-8 `.md`; max 18 MiB per file, 24 MiB total raw bytes per draft, max two files, max 100 extracted pages per PDF. Enforce decoded/encoded provider request size before queueing. Reject malformed PDFs, encrypted PDFs, invalid UTF-8, empty files, suspicious path names, and files that exceed limits with `413` or `422`. Store under a server-generated filename, not the upload name. Treat all extracted content as untrusted data, never as instructions to the model or the application.
- The renderer must use only the existing typed scene catalog. No uploaded document, generated JSON, or script may become an executable shell command, JavaScript, Python, file path outside its version directory, or arbitrary network URL. Run rendering with a non-privileged process, no host secrets beyond the voice key needed for its call, and a bounded CPU/memory/time limit suitable for the pilot host. If the host cannot enforce that boundary, restrict pilots to trusted instructor files and document the residual risk; do not call it sandboxed.

#### 3.4 Generation, retries, and cost state machine

`generation_jobs.state`: `queued -> preflight -> generating -> rendering -> validating -> ready_for_review`; any nonterminal state may go to `failed`. A process restart marks a running job `failed` with `INTERRUPTED`; the teacher may create a new draft and retry. Do not auto-resume an uncertain paid call. One queued/running job per course and one active rendering job per worker; queue position is visible. A job that exceeds 30 minutes becomes `failed` with `DEADLINE_EXCEEDED` after its current bounded provider/render call returns or is terminated.

Preflight checks keys, upload limits, aggregate provider payload size, disk free space for one replacement plus the active version, objective/item ceilings, and estimated spend against a configured pilot cap. Default cap: **$5 estimated provider spend per generated draft**, with hard stop before a call that would exceed it; the estimate must include at most two attempts and one schema repair per item. Actual provider bills may differ, so record both estimates and actual invoices. If cost cannot be estimated, do not queue the job. No paid calls occur in preflight. The $5 figure is a placeholder until the first measured draft. After that, set the cap at 1.5× the measured cost of a complete draft and record the basis in the release record.

Stage order inside `generating`. Every step after a check runs only if that check passes:
1. Outline.
2. Scripts and questions.
3. Deterministic schema validation (§3.5).
4. Automated source check: each factual claim must map to a cited excerpt, with an exact match for text uploads.
5. Voice.
6. Render.
7. Asset and hash checks.

A script that fails step 3 or 4 gets the single repair attempt allowed below. No voice credit is spent on a script that has not passed both checks. The source check is a filter, not verification; the teacher review in §3.5 remains the factual gate. Its calls count toward the job's cost estimate and its call count.

Gemini calls: timeout 90 seconds per attempt; retry **once** only for `429`, `408`, `500`, `502`, `503`, `504`, or a network timeout. Backoff 2 seconds plus 0-1 second jitter; honor `Retry-After` only up to 30 seconds. No retry for authentication, quota-exhausted with a long reset, malformed request, unsafe output, or schema-invalid JSON. A schema-invalid response gets **one** correction call if still within the job budget; otherwise fail that item. At most two provider calls are concurrent. For each misconception, generate v1 then v2 sequentially in the same bounded task; independent misconceptions may run in parallel. No event wait or recursive retry loop.

ElevenLabs/render: one TTS attempt, one retry only for transient `429`/`5xx`/timeout under the same budget, and one render attempt. A renderer failure marks the draft failed; required clips are not silently omitted. Missing key fails before generation. Error responses expose `error_code`, safe message, and `job_id`, never raw provider body, uploaded text, key, or stack trace. Detailed diagnostics stay in restricted logs.

Completeness rule: before `ready_for_review`, every approved target lecture has its required question pool, answer keys, feedback for every choice, source checks, v1/v2 clips for each configured misconception, transcript, captions, render manifest, and matching hashes. Any missing required item fails the draft; a prior active version remains live. An optional intro clip may be omitted without blocking a question-first lesson, but the manifest must say it was omitted.

#### 3.5 Content and style validation

The style card is a versioned JSON object with fields `audience_level`, `voice_id`, `reading_level_rule`, `term_glossary`, `pronunciations`, `caption_zone`, `duration_seconds`, `scene_catalog_version`, and `max_new_terms_per_clip`. The saved approved outline lists concepts, source excerpt IDs, required questions, misconception IDs, and clip teaching goals. Limit the style card to 4 KiB and each excerpt passed to a clip call to 2 KiB; select only excerpts referenced by that clip. Do not append the whole lecture or prior model transcript to each prompt.

Pilot defaults for the style card:
- `duration_seconds`: 15-30, hard limit 35. This keeps one idea per clip within working-memory limits.
- `max_new_terms_per_clip`: 2. A third new term must be defined in an earlier clip or moved to its own clip.
- `reading_level_rule`: sentences of at most 20 words, and every glossary term defined on first use.

Misconceptions and distractors come from the approved outline, not from the clip calls. The model proposes up to two misconceptions per objective, each with the source excerpt or common-error rationale behind it. The teacher accepts, edits or replaces each one during outline review, before any script is written. Every misconception in the outline records whether it is `teacher_written` or `teacher_accepted_model`.

v1 and v2 remediation clips for one misconception must differ in *teaching move*, not only wording. Each records a `teaching_move` drawn from `{rule_restatement, worked_contrast, visual_sequence, everyday_analogy, error_walkthrough}`, and v1 and v2 must use different moves. The checklist item "v2 meaningfully different" is checked against these recorded moves.

Parse model output as JSON into typed schemas; reject unknown fields, out-of-range lengths, unknown templates/actions/targets, unknown source IDs, unsupported media paths, and duplicate item IDs. Validate that each question has one correct answer, feedback for every choice, a misconception mapping for wrong choices, and no answer key in student responses. Verify exact quotes for text uploads; for PDFs require teacher confirmation against the displayed page image or extracted passage. Check terminology against the glossary and clip timing/caption safe zones deterministically. A format pass is **not** a factual pass. The teacher sees questions, correct answers, feedback, source snippets with page reference, video, captions, and the v1/v2 explanation pair before approval.

Review checklist: source support, answer correctness, misleading distractors, misconception mapping, clip factual accuracy, style consistency, caption readability, and v2 meaningfully different from v1. Every item must be checked; a rejected item rejects the whole version. Corrections start a child draft, never change the reviewed manifest in place or go directly to students. Record seconds spent and number of corrections for unit economics. A child draft regenerates only the rejected items and any items that depend on them. Unchanged, already-approved items are carried over by hash and are not paid for again, but they are still shown for re-confirmation.

#### 3.5.1 AI quality evaluation

Deterministic fake providers prove that the pipeline works, not that the model is right. A separate evaluation set closes that gap:

- **Golden set.** 30-50 items built from the pilot lecture: claims, questions and feedback, each with the teacher's verdict. Every teacher correction recorded under §3.5 is added to the set with its corrected version.
- **Seeded-error corpus.** At least 20 scripts with one known planted fault each, for example:
  - a reversed direction, such as 3'→5' synthesis;
  - a wrong enzyme;
  - a claim with no source;
  - a distractor that is actually correct;
  - an answer cue leaked before submission.
- **When it runs.** Before the first pilot generation, and before any change to `model_id` or `prompt_version`. It makes real provider calls, is not part of CI, and its cost is logged.
- **What is recorded.** The golden pass rate and the seeded-error catch rate for the automated source check, stored in `eval_runs` and referenced from the release record.
- **Pass bar.** *(pilot default)* No regression from the previous run on the golden set, and at least 80% of seeded errors caught. A catch rate below that does not block the pilot, because teacher review is the gate. It does block any claim that automated checks reduce review effort.
- **Independence.** Record which model runs the source check. If it is the same model family as the generator, report that, since their errors may be correlated.
- **Disagreement log.** Log every case where the automated check and the teacher disagree. Report the automated miss rate before the check is ever used to shorten teacher review.

#### 3.6 Publication, regeneration, and deletion

Teacher workflow: `create -> upload -> generate private draft -> review -> approve/reject -> share`. The existing share link may be shown before approval, but student access returns a clear `CLASS_NOT_READY` state and no draft content. Approval endpoint requires `If-Match: <manifest_sha256>` so a stale review page cannot approve a changed draft. If the manifest or any file hash changes, return `409 REVIEW_STALE` and require re-review. `POST /teacher/courses/{course_id}/versions/{version_id}/approve` performs the final transaction and returns the new active version ID. Repeating the same approval is idempotent; a different decision returns `409`.

Regeneration creates a **new** version. It never calls the current `replace_all` on the active version. A failed or rejected replacement leaves `active_version_id` untouched. When a new version is approved, new sessions pin it; existing sessions keep their old version and media. Retain superseded versions at least 30 days and until no unexpired student session references them; then delete with a logged cleanup job. Disk pressure blocks new generation before it deletes a referenced version. Teacher delete is version-scoped, and an approved version cannot be edited in place; removing a bad item requires a replacement version or an emergency unpublish that clearly tells students the class is temporarily unavailable.

#### 3.7 Student API, state transitions, and recovery

On class join, create an opaque 128-bit session token and persist its hash server-side; return a `session_id` and the pinned `version_id`. Store only the opaque token in browser storage. A lost token starts a new anonymous session; do not pretend prior progress is recovered. Token expiry: 30 days after last use, capped at 60 days from creation. Do not put the token in a URL or log it.

Join and session creation are rate-limited because a six-character code can be guessed. *(Pilot defaults)*:
- 20 join attempts per client IP per 10 minutes, then `429`;
- 10 new sessions per IP per hour;
- 200 sessions per course per day, then `429 CLASS_JOIN_LIMIT`, with the teacher alerted.

A failed code lookup takes the same time as a successful one. The teacher can rotate the join code; existing sessions keep working.

A lost token cannot be recovered in pilot 1. The class page tells students this plainly and advises them to use one browser on one device.

```json
POST /courses/{join_code}/attempts
{
  "attempt_id": "UUID",
  "session_id": "UUID",
  "set_id": "UUID",
  "version_id": "UUID",
  "expected_revision": 3,
  "question_id": "q_123",
  "selected_choice_id": "B"
}
```

The server authenticates the opaque session token, loads `set_instances` and the pinned answer key, and checks version, question, set, and revision. It does **not** accept client progress fields. Same `attempt_id` plus identical normalized request returns the stored result; same ID with different content returns `409 ATTEMPT_ID_REUSED`. Wrong expected revision, stale version, or out-of-order question returns `409 STATE_CONFLICT` with the current safe progress snapshot (no answer key). The result and new revision are committed atomically before the response. If the response is lost, the client resends the same attempt ID and receives the same result after refresh or server restart.

Set states: `not_started -> question -> feedback -> followup -> retry_question -> feedback`, then either next required question, `complete`, or `needs_review`. The due set moves `locked -> due` at `due_at`, then follows the same question-first path. A student may exit after any committed step; resume reads server state. `objective_states` holds a maximum of two remediation cycles **per objective** and the asked retry IDs. No retry question repeats within one set. Set completion requires every required concept's question to be answered correctly; a `needs_review` objective makes the set `needs_review` once the remaining required questions are handled. Missing clip delivery does not change answer state. A deleted/unpublished class returns `CLASS_UNAVAILABLE` with a plain recovery message; it never silently resets progress.

US-03 observable criteria: after the final correct required answer, Home shows Complete; after the second failed remediation cycle, Home shows Needs review; after refresh during a retry, Resume opens that retry; after a conflict, Home reflects the server snapshot and never falsely shows Complete. Each has one API and one browser check.

#### 3.8 Metrics, study protocol, and economics

Record a stable anonymous participant/session ID, course/version/build ID, lecture and set ID, event type, client and server UTC time, assignment/reminder exposure, first question time, answer and correctness, clip start/completion, review minutes, generation call count, retries, estimated and billed provider cost, render duration, and failure code. Deduplicate events by UUID. Do not store student names in study exports; store instructor contact details separately. Export raw anonymized rows and scoring rules alongside aggregate results.

Preregister the next pilot before recruitment. Compare ClipCademy with a strong chatbot using the same course material, equal study time, a fixed normal-user prompt, new assessment questions, and a post-test at least 48 hours later. Randomize or counterbalance assignment where feasible; document deviations, outside studying, missing data, and instructor/reminder exposure. Report group sizes, raw and adjusted results separately, uncertainty, and limitations. A small pilot can discover major friction but cannot establish a durable causal advantage or broad market demand.

Preregistration must fix the following before the first invite:
- **Primary outcome.** Percent correct on *new* items at least 48 hours after study. Items are written for the same objectives, share no wording with practice items, and are frozen before data collection. Everything else is secondary.
- **Comparisons.**
  - (a) *Within-student re-read control.* Each student's objectives are split by counterbalanced assignment: half are studied in ClipCademy and half by re-reading the matching note excerpts for equal time. This answers "compared to what?" without needing a large sample.
  - (b) *Chatbot arm*, as above, where enough students are available.
  - (c) *Optional clip-versus-text comparison.* Randomize some wrong answers to text feedback only, which reuses the existing "Clip unavailable" path, to test whether clips add learning beyond feedback.
- **Sample and stopping.** Write down the target number of completers and a fixed end date. Do not stop early because results look good. *(Board judgment)* With fewer than about 20 completers per comparison, report effect sizes with intervals as descriptive results only and make no significance claim.
- **Consent.** Get written consent with plain-language data use. Ask the institution whether IRB review or an exemption is needed, and record the answer before recruiting.
- **Misconception repair rate.** Secondary outcome: for each misconception, success on the retry after the v1 clip and after the v2 clip. This is the product's distinct learning signal and the honest basis for any later claim of an advantage.

Teacher funnel metric: **time from first upload to an approved, shareable class.** *(Pilot default)* target: 60 minutes or less for one lecture, including a 30-minute generation deadline. Record each stage (upload, generation, review, corrections, approval) so the slowest stage is known. Review minutes per approved lecture are reported with the contribution figure.

Return metric: unique students who answer at least one due-set question 24-72 hours after first-set completion, reported in separate `unprompted`, `instructor_prompted`, and `reminder_driven` categories. Opening the app, watching a clip, or answering immediately after the first set is not a return. Teacher repeat metric: the instructor assigns a second lecture set and states a concrete next-term usage or payment commitment. Do not infer willingness to pay from “very disappointed.”

Per-lecture contribution: attributable revenue minus model and voice calls, rendering/hosting/storage, teacher review minutes valued at the agreed rate, founder support, and refunds. Report rejected-draft spend and retries. Decision to expand requires repeat assignment, a measured advantage on a task users care about, and nonnegative observed contribution for the pilot course; otherwise narrow content or stop. These are business gates, not claims that one pilot proves product-market fit.

#### 3.9 Release and recovery gates

Automated gate on one clean Linux/container build: schema migration test from the current database, class-version transaction tests, provider 429/timeout/bad JSON, missing key, failed render, restart during generation, stale approval, draft/media access denial, malformed IDs and nested types, forged completion, duplicate/out-of-order attempts, old-version session after regeneration, and cleanup retention. Use deterministic fake providers; no paid calls in CI. Test that generated text containing “ignore previous instructions” remains inert data. Record pass/fail/skip names and exact environment; a coverage percentage alone never passes a release.

The set state machine (§3.7) is tested from a table, not one case per criterion. Every (state, event) pair in the transition list has a row giving the expected next state or the expected `409`. The table must include these combinations:
- correct after one failed cycle;
- two objectives in remediation at once;
- refresh during `followup` and during `retry_question`;
- a retry pool exhausted before two cycles finish;
- a `needs_review` objective entering the due set;
- a conflict snapshot received while on the feedback screen.

A test that fails without a code change is quarantined and named in the release record, and fixed or deleted within one week. It is never silently retried. Every past production incident becomes a named regression test. The 0/35 media failure is the first.

Browser gate: teacher create/upload/generate/review/approve and reject; student join/question-first/wrong answer/follow-up/new retry/refresh/due set/conflict recovery. Check at 320 px width and with reduced motion. On the actual deployed build, verify build ID, all manifest media and caption URLs, byte-range playback, one complete student path, and one teacher path. Test iOS Safari and Android Chrome on real devices before inviting students. The historical 0/35 deployed-asset failure is a named regression case.

Deployment: back up the SQLite database and active media manifest, run migration, deploy a build with a unique ID, execute smoke tests, then open pilot access. If migration or smoke fails, stop new sessions and restore the prior app/database/media snapshot together; do not roll back only code while leaving an incompatible schema. Document the actual restore command and perform one restore rehearsal on a copy of pilot data before launch. Expose a teacher-facing incident status and a job ID when generation fails. Do not claim a test passed if skipped, a phone was not used, or the host was not checked.

Operations ownership for the pilot:
- One named person is on call during pilot study windows. That person is alerted on a failed generation job, a failed deployed smoke check, disk use above 80%, or any `5xx` on student routes.
- *(Pilot default)* Recovery time objective: student routes restored within 4 hours. Data loss is limited to the time since the last backup, taken daily and before every deploy.
- The person who ran the real-phone checks signs the release record with device, OS and browser versions.

The SQLite file is shared by the web server and the worker process. Enable WAL mode and a busy timeout of at least 5 seconds, and keep transactions short (see §3.2).

#### 3.10 Implementation sequence

0. **Before any code:** write the business case (§3.13) and the data inventory (§3.11). Confirm vendor data terms. Pin the model ID. Open the preregistration draft (§3.8). These cost hours, not weeks, and they decide whether the rest is worth building.
1. Fix the current generation deadlock, provider error classification, and destructive regeneration behind deterministic failure tests. Add immutable versions and atomic active-version switching.
2. Add private drafts, manifest verification, approval/rejection, teacher session protection, and version-scoped media access. Add the script-before-voice checks (§3.4). Observe one full teacher review before optimizing its UI.
3. Move student progress to server-owned sessions and persistent idempotent attempts. Then add the question-first and due-set flow for one course, with due-set priority and the teacher notice. Keep the old biology route isolated.
4. Build the golden set and the seeded-error corpus, and record the first `eval_runs` row (§3.5.1). Then run the release/restore checks and one real instructor pilot. Measure:
   - time to an approved class;
   - review time;
   - actual charges;
   - where returns come from;
   - delayed recall against the re-read control;
   - whether the instructor makes a second assignment, and their answer to the priced ask.

   Only then decide whether broader course generation is justified.
5. **Not before step 4 reads out:** teaching styles (§3.12) and any growth past the limits in §3.14.

#### 3.11 Data protection and privacy

The data inventory is a precondition for inviting any student (Mandate 10). It covers:

| Data | Where stored | Sent to | Retention *(pilot default)* | Deletion |
| --- | --- | --- | --- | --- |
| Instructor notes (uploads, extracted text) | `/data` volume, under a server-generated name | Gemini: only cited excerpts of 2 KiB or less per call | Life of the course, plus 30 days | Teacher deletes the course; the cleanup job removes files and excerpts |
| Generated scripts, questions, media | Version directories | ElevenLabs: script text only | As in §3.6 | Version cleanup job |
| Student session, attempts, objective states | SQLite | No third party | 180 days after the pilot ends, or earlier on request | Delete by `session_id`, including from the next backup cycle |
| Anonymized study export | Separate export folder | Research team only | Per the consent form | As in the consent form |
| Instructor contact details | Kept apart from study data | No third party | Life of the relationship | On request |
| Restricted logs and diagnostics | Host logs | Host provider | 30 days | Rotation |
| Backups | Encrypted off-volume copy | Host or storage provider | 30 days, rolling | Expire, so deletions reach backups within 30 days |

Rules:
- **Vendor terms.** Use only API tiers whose terms exclude training on submitted data. Record each vendor's retention period in the inventory, and recheck before each term.
- **No student data in prompts.** No student identifier, answer or free text is ever sent to a model provider. Only instructor material and generated scripts are sent.
- **Age.** Pilot 1 is limited to students aged 18 or older at a postsecondary institution. Any younger audience needs a separate COPPA and FERPA review and parental-consent design before launch.
- **Rights to the notes.** The upload form records the instructor's statement that they own the notes or have permission to process them, together with the timestamp.
- **Encryption.** The `/data` volume and backups are encrypted at rest using the host's encryption, or the gap is written in the inventory as a residual risk.
- **Access requests.** Because sessions are anonymous, a student exercises access or deletion through the instructor or by presenting their session ID from the class page's "My data" panel. Response time is 30 days or less.
- **Parent or student question.** The inventory is written so it can be sent as-is in answer to "what data do you hold about me and who has seen it?"

#### 3.12 Deferred: teaching styles and two-layer AI review

`Context/TEACHING_STYLES_AND_AI_REVIEW.md` is **not part of pilot 1**. It may enter a later pilot only when all of these hold:

1. Pilot 1 has read out on due-set return and on the instructor's second assignment, and per-lecture contribution is nonnegative or there is a costed plan to make it so.
2. Every offered style is rendered, hashed and listed in the approved manifest before the version is approved. No provider call is ever triggered by a student (Mandate 6). This replaces the original "render on first request" rule; the styles note was revised on 2026-11-19 to match.
3. The schema adds `style_id`, `guide_id` and `teaching_move` to `version_items`. The cache and manifest key includes `model_id`, `prompt_version`, `style_id`, `guide_id`, `voice_id` and `renderer_version`.
4. The review-layer calls are included in the preflight cost estimate and the job deadline, and both are re-measured using the deterministic fakes for the worst case.
5. The picker appears only **after** a question has been answered, never before question 1, so question-first stays intact. It never delays the retry question.
6. For the evaluation, part of the cohort is randomly assigned a style, because self-chosen styles cannot show that the style caused a gain.
7. Teacher review time for two styles has been measured on one lecture and fits the contribution target in §3.13.
8. Guide characters and voices are original or licensed, with a named rights owner.

#### 3.13 Commercial gate

Before recruiting, write down on one page:
- **Buyer.** *(Board recommendation)* the intro-biology instructor or their department, with students joining through instructor assignment.
- **Test price,** stated in the form it would be charged (per course per term, or per section).
- **Review-hour rate** used in per-lecture contribution.
- **Per-lecture contribution target.**
- **Channel for instructors 2-10,** for example teaching centers, department chairs or conference contacts, with a named list of at least 10 targets.
- **Competitors.** A short table of what an intro-STEM instructor would use instead (AI quiz and flashcard generators, lecture-video tools, the LMS's own quiz bank, a general chatbot), and the one task where ClipCademy must win.

The pilot closes with a **priced ask** to the instructor for the next term. Record the outcome verbatim: yes, no, or a stated condition. "Very disappointed" scores, compliments and a free second assignment are recorded as interest, not willingness to pay.

#### 3.14 Scaling limits and what breaks first

The pilot design is intentionally single-host. *(Board judgment, to replace with measurements from pilot 1)*:

| Scale | First expected limit | Signal to watch | Response |
| --- | --- | --- | --- |
| About 10 classes | The render queue: one render job at a time, each up to 30 minutes | Queue wait for teachers; time to an approved class | A second worker host, or render jobs run outside the web container |
| About 100 classes | Disk on `/data` from 30-day version retention; reliability of the cleanup job | Disk-use alarm at 80%; MB per version | Object storage for media; tighter retention for superseded versions |
| About 1,000 classes | The single teacher secret; one SQLite writer | Lock-wait time; sign-in support load | Per-teacher accounts with SSO; a server database |

Record render seconds per clip and MB per version from the first pilot draft, and recompute this table from those numbers.

#### 3.15 Owners and open decisions

| Item | Owner | Due |
| --- | --- | --- |
| Resolve the styles note against this spec (§3.12); edit the styles note to match | Spec author | 2026-11-21 |
| Business case (§3.13) | Founder | 2026-11-26, before recruiting |
| Data inventory, vendor terms, age and consent decision (§3.11) | Security and privacy lead | Before the first student invite |
| Pinned model ID, golden set, seeded-error corpus (§3.5.1) | AI and pipeline lead | Before the first pilot generation |
| Preregistration (§3.8), including sample size and IRB answer | Product lead with learning science | Before recruitment |
| On-call person, restore rehearsal (§3.9) | Engineering lead | Before launch |

Questions this spec cannot answer yet:
- measured cost and render time per clip;
- the providers' exact data-retention terms;
- whether the pilot institution requires IRB review;
- the instructor's current time from upload to an approved class.

## Evidence used for this specification

- `Context/Team_Spec.md`, `planning/USER_STORIES.md`, `Context/readteaming/FOUNDER_REDTEAM_RESPONSE.md`.
- Current implementation: `learning/courses.py`, `learning/course_worker.py`, `learning/grading.py`, `learning/server.py`, `video/course/gemini.py`, `video/course/generate.py`, `video/course/questions.py`, `video/course/templates.py`, `web/src/platform/teach.js`, `web/src/platform/class.js`.
- Study: `validation/study/RESULTS.md`, `validation/study/metrics.json`, `validation/study/score-adjustments.csv`.
- User-provided Part 1 written PDF, Alpha Demo PDF, and Nov 17 feedback image (the source files for the alpha findings and critique summarized at the top of this document).
- v2.1: `Context/TEACHING_STYLES_AND_AI_REVIEW.md` and the eight-seat simulated board review in `planning/BOARD_REVIEW_2026-11-19.md`. Values marked *(pilot default)* or *(board judgment)* are proposals, not measurements.
