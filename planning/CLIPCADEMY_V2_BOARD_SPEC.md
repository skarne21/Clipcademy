# ClipCademy v2.0: simulated board review and hardened pilot specification

Date: 2026-11-19. Status: **design proposal, not implemented or certified**. The four board roles below are review lenses simulated for this request, not actual directors or approvals. No software is failproof; this design aims to keep failures visible, bounded, and recoverable.

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

The board's main disagreement is about review: Security wants no unreviewed publication; Product resists a slow, per-clip workflow; Investor resists central staffing. Consensus for this pilot is **teacher approval of a complete version, automated structural checks, and founder audit of the first few classes**, with measured review time. No claim of factual verification is allowed before that process actually runs.

### Step 2. Consensus architectural mandates

1. **One source of truth for class versions.** Every clip, question, media file, attempt, and review decision has a `version_id`. New sessions use the approved active version; existing sessions stay pinned to their original version. Never mutate or overwrite an approved version.
2. **Drafts are private and incomplete by default.** Public class, media, and attempt routes return only approved versions. Approval requires a complete manifest, source review, teacher confirmation, and a successful media integrity check. A failed or rejected draft leaves the active version intact.
3. **Generation is a bounded state machine, not an open-ended agent.** Fixed task graph; at most two concurrent provider calls; two attempts per retryable call; no recursive tool use; one repair attempt for schema-invalid output; finite job deadline and cost cap. Uploaded notes are data and cannot amend system rules.
4. **The server owns learning state.** The browser sends a selected choice and opaque IDs. It cannot submit `satisfied_question_ids`, `remediation_count`, or completion state. Attempt acceptance, result storage, and state transition are one transaction.
5. **Question first is a measurable product experiment.** A student sees a question before the explanatory clip and answer key. A later set uses new items for the same concepts. Measure instructor-prompted, reminder-driven, and unprompted use separately.
6. **Safety and cost limits are configuration with hard ceilings.** No provider call occurs in a student session. A pilot job cannot exceed the maximum objectives, source bytes, calls, renders, deadline, or estimated budget. A missing key or failed preflight fails before paid work.
7. **A release needs behavioral evidence.** Critical failure tests, teacher and student browser flows, media delivery, real-phone playback, and a versioned release record are required. Line coverage is reported but has no standalone pass threshold.
8. **Claims follow evidence.** The alpha's recorded and adjusted analyses stay separate. No learning, chatbot, reviewer-scale, moat, or “verified content” claim is made without the matching observation.

### Step 3. Hardened code specification v2.0

#### 3.1 Product boundary and pilot limits

- Pilot tenant: one named instructor and one course; at most two uploaded lectures, two objectives per lecture, two mapped misconceptions per objective, and two follow-up versions per misconception. A request beyond these limits returns `422 PILOT_LIMIT` before generation.
- Initial assignment: exactly three required questions per lecture. A second, due set contains exactly three **different** questions on the same concepts, available 24 hours after the first set is completed. Do not claim the due set is voluntary if the instructor assigns it or a reminder drives it.
- Student session: no LLM or TTS calls. All questions, answer keys, feedback, clips, and captions come from an approved immutable version. Biology `BIO101` may remain available as a separate legacy path, labeled as such; its study and beta data must not be mixed with v2 pilot metrics.
- On the first useful screen for a lecture, present question 1 with no intro clip. An optional “Review first” action may play an approved clip, but log that exposure and analyze those students separately. The answer and explanation are hidden until submission.
- Wrong answer: show short feedback, then the misconception's approved v1 clip and a new retry question. If the same misconception is missed again, use its approved v2 clip and a different retry. After two remediation cycles for the objective, show `needs_review`. A failed clip may be skipped with text feedback and a visible “Clip unavailable” notice; the answer and retry remain available. Correct answers never erase the remediation count.

#### 3.2 Data schema and invariants

Use SQLite on the existing persistent volume, with foreign keys enabled and migrations applied before serving traffic. IDs are server-generated UUIDs except the existing six-character join code. Essential tables/fields:

```text
courses(course_id PK, teacher_id, join_code UNIQUE, title, active_version_id NULL, created_at)
course_versions(version_id PK, course_id FK, parent_version_id NULL, state,
                style_version, manifest_sha256 NULL, created_at, approved_at NULL,
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
                test_manifest_json, deployed_at, smoke_result_json)
```

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

Preflight checks keys, upload limits, aggregate provider payload size, disk free space for one replacement plus the active version, objective/item ceilings, and estimated spend against a configured pilot cap. Default cap: **$5 estimated provider spend per generated draft**, with hard stop before a call that would exceed it; the estimate must include at most two attempts and one schema repair per item. Actual provider bills may differ, so record both estimates and actual invoices. If cost cannot be estimated, do not queue the job. No paid calls occur in preflight.

Gemini calls: timeout 90 seconds per attempt; retry **once** only for `429`, `408`, `500`, `502`, `503`, `504`, or a network timeout. Backoff 2 seconds plus 0-1 second jitter; honor `Retry-After` only up to 30 seconds. No retry for authentication, quota-exhausted with a long reset, malformed request, unsafe output, or schema-invalid JSON. A schema-invalid response gets **one** correction call if still within the job budget; otherwise fail that item. At most two provider calls are concurrent. For each misconception, generate v1 then v2 sequentially in the same bounded task; independent misconceptions may run in parallel. No event wait or recursive retry loop.

ElevenLabs/render: one TTS attempt, one retry only for transient `429`/`5xx`/timeout under the same budget, and one render attempt. A renderer failure marks the draft failed; required clips are not silently omitted. Missing key fails before generation. Error responses expose `error_code`, safe message, and `job_id`, never raw provider body, uploaded text, key, or stack trace. Detailed diagnostics stay in restricted logs.

Completeness rule: before `ready_for_review`, every approved target lecture has its required question pool, answer keys, feedback for every choice, source checks, v1/v2 clips for each configured misconception, transcript, captions, render manifest, and matching hashes. Any missing required item fails the draft; a prior active version remains live. An optional intro clip may be omitted without blocking a question-first lesson, but the manifest must say it was omitted.

#### 3.5 Content and style validation

The style card is a versioned JSON object with fields `audience_level`, `voice_id`, `reading_level_rule`, `term_glossary`, `pronunciations`, `caption_zone`, `duration_seconds`, `scene_catalog_version`, and `max_new_terms_per_clip`. The saved approved outline lists concepts, source excerpt IDs, required questions, misconception IDs, and clip teaching goals. Limit the style card to 4 KiB and each excerpt passed to a clip call to 2 KiB; select only excerpts referenced by that clip. Do not append the whole lecture or prior model transcript to each prompt.

Parse model output as JSON into typed schemas; reject unknown fields, out-of-range lengths, unknown templates/actions/targets, unknown source IDs, unsupported media paths, and duplicate item IDs. Validate that each question has one correct answer, feedback for every choice, a misconception mapping for wrong choices, and no answer key in student responses. Verify exact quotes for text uploads; for PDFs require teacher confirmation against the displayed page image or extracted passage. Check terminology against the glossary and clip timing/caption safe zones deterministically. A format pass is **not** a factual pass. The teacher sees questions, correct answers, feedback, source snippets with page reference, video, captions, and the v1/v2 explanation pair before approval.

Review checklist: source support, answer correctness, misleading distractors, misconception mapping, clip factual accuracy, style consistency, caption readability, and v2 meaningfully different from v1. Every item must be checked; a rejected item rejects the whole version. Corrections start a child draft, never change the reviewed manifest in place or go directly to students. Record seconds spent and number of corrections for unit economics.

#### 3.6 Publication, regeneration, and deletion

Teacher workflow: `create -> upload -> generate private draft -> review -> approve/reject -> share`. The existing share link may be shown before approval, but student access returns a clear `CLASS_NOT_READY` state and no draft content. Approval endpoint requires `If-Match: <manifest_sha256>` so a stale review page cannot approve a changed draft. If the manifest or any file hash changes, return `409 REVIEW_STALE` and require re-review. `POST /teacher/courses/{course_id}/versions/{version_id}/approve` performs the final transaction and returns the new active version ID. Repeating the same approval is idempotent; a different decision returns `409`.

Regeneration creates a **new** version. It never calls the current `replace_all` on the active version. A failed or rejected replacement leaves `active_version_id` untouched. When a new version is approved, new sessions pin it; existing sessions keep their old version and media. Retain superseded versions at least 30 days and until no unexpired student session references them; then delete with a logged cleanup job. Disk pressure blocks new generation before it deletes a referenced version. Teacher delete is version-scoped, and an approved version cannot be edited in place; removing a bad item requires a replacement version or an emergency unpublish that clearly tells students the class is temporarily unavailable.

#### 3.7 Student API, state transitions, and recovery

On class join, create an opaque 128-bit session token and persist its hash server-side; return a `session_id` and the pinned `version_id`. Store only the opaque token in browser storage. A lost token starts a new anonymous session; do not pretend prior progress is recovered. Token expiry: 30 days after last use, capped at 60 days from creation. Do not put the token in a URL or log it.

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

Return metric: unique students who answer at least one due-set question 24-72 hours after first-set completion, reported in separate `unprompted`, `instructor_prompted`, and `reminder_driven` categories. Opening the app, watching a clip, or answering immediately after the first set is not a return. Teacher repeat metric: the instructor assigns a second lecture set and states a concrete next-term usage or payment commitment. Do not infer willingness to pay from “very disappointed.”

Per-lecture contribution: attributable revenue minus model and voice calls, rendering/hosting/storage, teacher review minutes valued at the agreed rate, founder support, and refunds. Report rejected-draft spend and retries. Decision to expand requires repeat assignment, a measured advantage on a task users care about, and nonnegative observed contribution for the pilot course; otherwise narrow content or stop. These are business gates, not claims that one pilot proves product-market fit.

#### 3.9 Release and recovery gates

Automated gate on one clean Linux/container build: schema migration test from the current database, class-version transaction tests, provider 429/timeout/bad JSON, missing key, failed render, restart during generation, stale approval, draft/media access denial, malformed IDs and nested types, forged completion, duplicate/out-of-order attempts, old-version session after regeneration, and cleanup retention. Use deterministic fake providers; no paid calls in CI. Test that generated text containing “ignore previous instructions” remains inert data. Record pass/fail/skip names and exact environment; a coverage percentage alone never passes a release.

Browser gate: teacher create/upload/generate/review/approve and reject; student join/question-first/wrong answer/follow-up/new retry/refresh/due set/conflict recovery. Check at 320 px width and with reduced motion. On the actual deployed build, verify build ID, all manifest media and caption URLs, byte-range playback, one complete student path, and one teacher path. Test iOS Safari and Android Chrome on real devices before inviting students. The historical 0/35 deployed-asset failure is a named regression case.

Deployment: back up the SQLite database and active media manifest, run migration, deploy a build with a unique ID, execute smoke tests, then open pilot access. If migration or smoke fails, stop new sessions and restore the prior app/database/media snapshot together; do not roll back only code while leaving an incompatible schema. Document the actual restore command and perform one restore rehearsal on a copy of pilot data before launch. Expose a teacher-facing incident status and a job ID when generation fails. Do not claim a test passed if skipped, a phone was not used, or the host was not checked.

#### 3.10 Implementation sequence

1. Fix the current generation deadlock, provider error classification, and destructive regeneration behind deterministic failure tests. Add immutable versions and atomic active-version switching.
2. Add private drafts, manifest verification, approval/rejection, teacher session protection, and version-scoped media access. Observe one full teacher review before optimizing its UI.
3. Move student progress to server-owned sessions and persistent idempotent attempts. Then add the question-first and due-set flow for one course. Keep the old biology route isolated.
4. Run the release/restore checks and one real instructor pilot. Measure review time, actual charges, return source, delayed recall, and second assignment. Only then decide whether broader course generation is justified.

## Evidence used for this specification

- `Context/Team_Spec.md`, `planning/USER_STORIES.md`, `Context/readteaming/FOUNDER_REDTEAM_RESPONSE.md`.
- Current implementation: `learning/courses.py`, `learning/course_worker.py`, `learning/grading.py`, `learning/server.py`, `video/course/gemini.py`, `video/course/generate.py`, `video/course/questions.py`, `video/course/templates.py`, `web/src/platform/teach.js`, `web/src/platform/class.js`.
- Study: `validation/study/RESULTS.md`, `validation/study/metrics.json`, `validation/study/score-adjustments.csv`.
- User-provided Part 1 written PDF, Alpha Demo PDF, and Nov 17 feedback image (the source files for the alpha findings and critique summarized at the top of this document).
