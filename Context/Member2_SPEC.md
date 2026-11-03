# Member 2 spec: questions and adaptive lesson logic

Owner: Member 2 · Code folder: `learning/` (this spec lives in `Context/`)
Source of truth: [Team_Spec.md](Team_Spec.md). If this file and Team_Spec disagree, Team_Spec wins until the team agrees on a change.
Subject: biology (confirmed). Lecture notes are in [Notes/](../Notes/).

## What I own

- The topic list and objective IDs
- The first lesson packet (source excerpts plus initial and follow-up teaching goals)
- The question bank, answer key, and feedback for every choice
- Mapping each wrong answer to a misconception and a video variant
- Answer checking and the next-action decision (`continue_questions`, `review_again`, `complete`, `needs_review`)
- Enforcing the two-cycle remediation limit
- Endpoints: `GET /topics`, `GET /questions/{question_id}`, `POST /attempts`, `POST /events` (storage and `events.csv` export)

Not mine: rendering video (Member 1), calling `/video-jobs`, UI, or browser storage (Member 3). I return a `next_video_request`, and Member 3 sends it to Member 1.

## Task list

Work through these in order. Each task ends with something I can share.

| # | Task | Output | Share with | Checkpoint |
| --- | --- | --- | --- | --- |
| 1 | Create topic list and objective IDs | `learning/data/topics.json` | M1, M3 | Kickoff |
| 2 | Write the first lesson packet | `learning/packets/dna_replication.synthesis_direction_and_primer.json` | M1, M3 (do this right away) | Kickoff |
| 3 | Write 2 initial and 4 retry questions (2 per misconception), with feedback for every choice | `learning/data/questions.json` | Team review | Kickoff |
| 4 | Map wrong choices to misconception IDs and video variants | `learning/data/answer_key.json` (server only) | M1 (variant IDs) | Kickoff |
| 5 | Build answer checking and transition rules | grading module | none | First independent build |
| 6 | Track remediation cycles and stop at 2 | part of the grading module | none | First independent build |
| 7 | Write sample responses for every endpoint, before the real video service exists | `learning/samples/*.json` | M3 | Kickoff / first independent build |
| 8 | Serve the three endpoints | API wrapper | M3 | First connection |
| 9 | Host `POST /events` and export `events.csv` (see Team_Spec.md, Activity events) | events endpoint | M3 | First connection |
| 10 | Return the follow-up request and a new question on wrong answers | verified with M3 | M1, M3 | Adaptive connection |
| 11 | Check sources, the answer key, and stopping rules | checklist below is ticked | Team | Demo readiness |

## Data

### Topics (`GET /topics`)

| `topic_id` | Label | Source refs | Availability | Objectives |
| --- | --- | --- | --- | --- |
| `dna_replication` | DNA replication | L19 pp. 1–3 | `available` | `synthesis_direction_and_primer` |
| `dna_repair` | DNA repair and telomeres | L20 p. 1 | `coming_soon` (→ `available` for the validation build) | `error_correction` |
| `transcription` | Transcription | L21 p. 1 | `coming_soon` | `template_strand_and_promoter` |
| `translation` | Translation | L22 pp. 1–2 | `coming_soon` | `codon_pairing_and_ribosome_sites` |

During development, `available` means the lesson is built, even while its packet is still `review_status: "draft"`. Before the build freeze, every `available` lesson must have its packet set to `review_status: "reviewed"` and all its items approved in content-audit.csv. Otherwise, set it back to `coming_soon` for the frozen build. The home page must not show unavailable topics as working.

```json
{
  "topics": [
    {
      "topic_id": "dna_replication",
      "label": "DNA replication",
      "source_refs": ["L19-p1", "L19-p2", "L19-p3"],
      "availability": "available",
      "objectives": [
        {
          "objective_id": "synthesis_direction_and_primer",
          "label": "Synthesis direction and the primer requirement",
          "required_question_ids": ["rep-q1", "rep-q2"]
        }
      ]
    },
    {
      "topic_id": "dna_repair",
      "label": "DNA repair and telomeres",
      "source_refs": ["L20-p1"],
      "availability": "coming_soon",
      "objectives": [
        {
          "objective_id": "error_correction",
          "label": "Proofreading, mismatch repair, and UV-damage repair",
          "required_question_ids": ["dr-q1", "dr-q2"]
        }
      ]
    }
  ]
}
```

### Lesson packet

The packet is shared by all three members. Member 1 renders from it and Member 3 displays it.

```json
{
  "topic_id": "dna_replication",
  "objective_id": "synthesis_direction_and_primer",
  "source_excerpts": [
    { "ref": "L19-p1", "text": "DNA synthesis occurs only in the 5′ to 3′ direction, meaning new bases are being added to the 3′ end of an existing strand. DNA polymerase can only add new bases to the 3′ end of an existing complementary strand. It can't synthesize a complementary strand of DNA from scratch." },
    { "ref": "L19-p2", "text": "Before this happens, primase synthesizes a short sequence of RNA that is complementary to the DNA on the top strand. The new result is RNA primer because it prepares (primes) the strand for DNA polymerase. Unlike DNA polymerase, primase can start synthesis from scratch on a single stranded template strand. Once the primer is made, DNA polymerase can start adding deoxyribonucleotides." }
  ],
  "variants": {
    "initial": { "teaching_goal": "Explain 5′→3′ synthesis at the 3′ end and why a primer is needed", "source_refs": ["L19-p1", "L19-p2"] },
    "direction_followup": { "teaching_goal": "Explain growth direction and which end grows", "source_refs": ["L19-p1"] },
    "primer_followup": { "teaching_goal": "Explain why DNA polymerase needs a primer", "source_refs": ["L19-p1", "L19-p2"] }
  },
  "review_status": "draft"
}
```

Do not include the Lecture 19 joining/primer-removal sequence until the instructor clarifies it.

### All four lessons (draft content)

Every topic now has one objective with a lesson packet, 2 required questions, 4 retries, and feedback for every choice. The data files are the source of truth:

| File | Contents |
| --- | --- |
| [learning/data/topics.json](../learning/data/topics.json) | `GET /topics` response |
| [learning/data/questions.json](../learning/data/questions.json) | `GET /questions` content, with no answers |
| [learning/data/answer_key.json](../learning/data/answer_key.json) | Correct choice, `counts_for`, and feedback/misconception per choice (server only) |
| [learning/packets/](../learning/packets/) | One packet per objective: source excerpts, excluded passages, misconception → follow-up variant and retry order, and teaching goals with key points for Member 1 |

| Topic | Objective | Misconceptions → follow-up variant | Question IDs |
| --- | --- | --- | --- |
| DNA replication | `synthesis_direction_and_primer` | `growth_direction` → `direction_followup`, `primer_requirement` → `primer_followup` | `rep-*` |
| DNA repair | `error_correction` (proofreading, mismatch repair, UV repair) | `repair_timing` → `timing_followup`, `uv_damage` → `uv_followup` | `dr-*` |
| Transcription | `template_strand_and_promoter` | `template_vs_coding` → `template_followup`, `promoter_role` → `promoter_followup` | `tx-*` |
| Translation | `codon_pairing_and_ribosome_sites` (anticodons, A/P/E sites) | `site_roles` → `sites_followup`, `anticodon_pairing` → `pairing_followup` | `tl-*` |

Passages Team_Spec flags as unclear are left out and listed in each packet's `excluded_passages`: L19 ligase/primer-removal order, L20 cancer/senescence claim, L21 upstream/downstream, and L22 "tRNAs consist of two subunits." DNA repair is the second lesson for the validation study. Flip its `availability` to `available` in topics.json once its items pass the content audit and Member 1 has rendered its three clips. Transcription and translation stay `coming_soon` for the study, because their notes have unclear or inconsistent passages.

The replication lesson is detailed below. The other lessons follow the same pattern.

### Question bank (replication)

| ID | Role | Prompt | Choices | Correct | Wrong choice leads to |
| --- | --- | --- | --- | --- | --- |
| `rep-q1` | required | Which end receives new nucleotides during DNA synthesis? | A. 5′ end · B. 3′ end | B | A → `growth_direction` → `direction_followup` → `rep-r1` |
| `rep-q2` | required | Why is a primer needed? | A. DNA polymerase needs an existing complementary strand to extend · B. Ligase adds all new bases · C. DNA is synthesized only 3′ to 5′ | A | B → `primer_requirement` → `primer_followup` → `rep-r2` · C → `growth_direction` → `direction_followup` → `rep-r1` |
| `rep-r1` | retry for q1 | A complementary primer is already present. Where does DNA polymerase add the next DNA nucleotide? | A. Its 3′ end · B. Its 5′ end | A | B → `growth_direction` → `direction_followup` → `rep-r3` |
| `rep-r2` | retry for q2 | Which enzyme makes the RNA primer? | A. Ligase · B. Primase · C. DNA polymerase | B | A, C → `primer_requirement` → `primer_followup` → `rep-r4` |
| `rep-r3` | 2nd retry for q1 | DNA polymerase is adding nucleotides to a growing strand. In which direction does the new strand grow? | A. 5′ to 3′ · B. 3′ to 5′ | A | B → `needs_review` (limit reached) |
| `rep-r4` | 2nd retry for q2 | Once the RNA primer is in place, which enzyme adds DNA nucleotides to it? | A. Primase · B. DNA polymerase · C. Ligase | B | A, C → `needs_review` (limit reached) |

Sources: q1, r1, and r3 come from L19 p. 1. q2 and r4 come from L19 pp. 1–2. r2 (which enzyme makes the primer) comes from L19 p. 2 only.

Every choice needs its own feedback text, including the correct one. Draft the feedback below, then get team review:

| Question | Choice | Feedback (draft) |
| --- | --- | --- |
| `rep-q1` | A | New nucleotides are added to the 3′ end, so the strand grows 5′ to 3′. |
| `rep-q1` | B ✓ | Correct. DNA polymerase adds to the 3′ end, so synthesis runs 5′ to 3′. |
| `rep-q2` | A ✓ | Correct. DNA polymerase can only extend an existing complementary strand, and the primer provides that start. |
| `rep-q2` | B | Ligase joins pieces of DNA. It does not add the new bases. DNA polymerase extends a primer that primase made. |
| `rep-q2` | C | DNA is synthesized 5′ to 3′. The primer matters because polymerase needs an existing start to extend. |
| `rep-r1` | A ✓ | Correct. The primer's 3′ end is where polymerase adds the next nucleotide. |
| `rep-r1` | B | Polymerase adds to the 3′ end, never the 5′ end. |
| `rep-r2` | A | Ligase joins DNA fragments. Primase makes the RNA primer. |
| `rep-r2` | B ✓ | Correct. Primase makes the RNA primer that DNA polymerase extends. |
| `rep-r2` | C | DNA polymerase can't start a strand on its own. Primase makes the primer first. |
| `rep-r3` | A ✓ | Correct. Nucleotides join at the 3′ end, so the strand grows 5′ to 3′. |
| `rep-r3` | B | The new strand grows 5′ to 3′ because nucleotides are added only at the 3′ end. |
| `rep-r4` | A | Primase makes the primer but doesn't extend it. DNA polymerase adds the DNA nucleotides. |
| `rep-r4` | B ✓ | Correct. Primase starts the strand with RNA, then DNA polymerase extends it. |
| `rep-r4` | C | Ligase closes gaps in the backbone without adding new bases. DNA polymerase extends the primer. |

Choice C on `rep-q2` names the wrong direction, so it goes to the direction follow-up (team decision, now also in Team_Spec). Answering `rep-r1` correctly does not count for `rep-q2`, so the student comes back to `rep-q2` afterwards. This is the one allowed repeat: a missed required question returns after its follow-up so the student recalls it correctly. Retry questions are never shown twice.

These questions are the app's practice bank. The study's pre-test and post-test in [assessment.md](assessment.md) must never reuse or closely reword them, so check both files whenever either changes.

The misconception mapping is a teaching choice, not a diagnosis of what the student was thinking.

`GET /questions/{id}` must never include the correct answer or misconception IDs. Keep those in `answer_key.json`, read only by the grading code.

```json
{
  "question_id": "rep-q2",
  "objective_id": "synthesis_direction_and_primer",
  "prompt": "Why is a primer needed?",
  "choices": [
    { "choice_id": "A", "text": "DNA polymerase needs an existing complementary strand to extend" },
    { "choice_id": "B", "text": "Ligase adds all new bases" },
    { "choice_id": "C", "text": "DNA is synthesized only 3′ to 5′" }
  ]
}
```

## Grading and transition rules

### `POST /attempts` request

```json
{
  "attempt_id": "attempt-001",
  "question_id": "rep-q2",
  "selected_choice_id": "B",
  "objective_id": "synthesis_direction_and_primer",
  "remediation_state": {
    "objective_status": "in_progress",
    "expected_question_id": "rep-q2",
    "remediation_count": 0,
    "satisfied_question_ids": ["rep-q1"],
    "asked_retry_ids": []
  }
}
```

Member 3 saves `remediation_state` and sends it back with each attempt. The client keeps the state, and I make the decision. An empty state (`{}`) means a fresh start: status `in_progress`, count 0, and the expected question is the objective's first required question. Restart and Reset demo send an empty state. For a prototype the client is trusted to hold the state, but I check that it's consistent (rule 6).

### Storage

Attempts (for idempotency) and events are stored server-side in one SQLite file, so they survive a server restart. The stored attempt keeps the full request body and the response.

## Service

**Stack:** Python 3.11+ with the standard library only (`wsgiref`, `sqlite3`, `json`). There are no third-party packages, no framework, and no LLM or other API keys: grading is rule-based and every question and feedback line is pre-written. The code is in `learning/`: grading in `grading.py`, the WSGI app in `app.py` (it exposes `application`), and their tests next to them. Run `python learning/app.py` to serve locally with `wsgiref`. The same `application` object runs unchanged on the host (see Hosting).

**Configuration** (environment variables):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8000` | Port to listen on. Endpoints have no path prefix (`/topics`, `/attempts`, …) |
| `CLIPCADEMY_DB` | `learning/clipcademy.db` | SQLite file (git-ignored) |
| `CLIPCADEMY_ALLOWED_ORIGINS` | `*` | Comma-separated browser origins allowed by CORS. Set this to the app's URL when the build is frozen |
| `CLIPCADEMY_BUILD_IDS` | empty | Comma-separated valid build IDs, set at the build freeze. While it's empty, every event that carries a `build_id` exports as `unknown` |
| `CLIPCADEMY_ADMIN_TOKEN` | unset | Required to export events. If it's unset, the export is disabled |

**Errors:** every 4xx response has the body `{"error": {"field": "...", "message": "..."}}`. The status is `400` for a bad request, `404` for an unknown path or question ID, and `409` for the conflicts in rule 6.

### `POST /events`

Member 3 sends one JSON event per action. The fields are the [events.csv](events.csv) columns, minus the ones the server adds (`timestamp_utc`, `build_id_status`).

- **Required on every event:** `event_id`, `participant_id`, `session_id`, `event_name`, `client_timestamp_utc` (ISO 8601 UTC, the time of the action on the device). `build_id` is expected but can be missing, in which case the event is still stored with status `missing`.
- **`event_name`** must be one of the Activity events in Team_Spec. Each name also requires its extra fields: `topic_id` for `topic_selected`; `variant_id` for `video_started`, `video_completed`, and `followup_requested`; `question_id` and `correct` (a JSON boolean) for `question_answered`; `objective_id` for `objective_completed` and `objective_needs_review`. Include `topic_id` and `objective_id` whenever they're known, so lesson splits don't need lookups.
- **Responses:** an invalid event gets `400` naming the field. A new event gets `201`. A repeated `event_id` gets `200` with `{"duplicate": true}`, is not stored again, and is not an error, so Member 3's retries are safe.
- **Two timestamps:** the server records the receipt time as `timestamp_utc`. Member 3 retries failed sends, so a Day 0 action could arrive on Day 1. The analysis therefore uses `client_timestamp_utc` to assign events to calendar days (see validation-plan.md).

### Exporting `events.csv`

`GET /events.csv` with the header `Authorization: Bearer <CLIPCADEMY_ADMIN_TOKEN>` returns every stored event as CSV in the [events.csv](events.csv) column order, oldest first. Each row's `build_id_status` is `ok`, `missing`, or `unknown`, computed against `CLIPCADEMY_BUILD_IDS` at export time. A wrong or missing token gets `401`. The export is protected because it holds participant activity.

### Rules

1. **Required questions.** Each objective's required questions and retry order come from its packet (`required_question_ids`, `misconceptions.*.retry_question_ids`), and `counts_for` in the answer key says which required question a retry stands in for. For replication, the objective requires `rep-q1` and `rep-q2`. A correct answer on a retry question also counts for the required question it stands in for (`rep-r1`/`rep-r3` count for `rep-q1`, and `rep-r2`/`rep-r4` count for `rep-q2`).
2. **Correct answer:** add the question to `satisfied_question_ids`.
   - If any required question is still unsatisfied, return `continue_questions` with `next_question_id` set to the first unsatisfied one. A single correct answer must never skip the remaining required questions.
   - If all are satisfied, return `complete`.
3. **Wrong answer:**
   - If `remediation_count < 2`, return `review_again`, increment `remediation_count`, and include the mapped `misconception_id`, the `next_video_request` built from the packet variant, and `next_question_id` set to the first retry question for that misconception that is not yet in `asked_retry_ids` (direction: `rep-r1`, then `rep-r3`; primer: `rep-r2`, then `rep-r4`). Add it to `asked_retry_ids`, so every follow-up video is followed by a question the student hasn't seen.
   - If `remediation_count == 2`, return `needs_review`. Set `feedback` to the chosen choice's feedback and `review_points` to the packet's `variants.initial.key_points`. Both are already reviewed content, so nothing new needs writing. Send no video request and no next question.
4. **Limit:** at most two follow-up cycles **per objective in total** (team decision). A correct answer does not reset the count. Example: missing q1 (cycle 1), answering the retry correctly, then missing q2 is cycle 2, and the next wrong answer returns `needs_review`.
5. **Idempotency:** if an `attempt_id` has been seen before with the same body, return the stored result unchanged. Do not create a second attempt, count another cycle, or issue another video request. The same `attempt_id` with a different body gets `409` and changes nothing.
6. **Errors:** the error must say which field is wrong.
   - `400` for unknown question or choice IDs, a question that doesn't belong to the objective, or a malformed body.
   - `400` for an inconsistent `remediation_state`: an ID in `satisfied_question_ids` or `asked_retry_ids` that isn't part of this objective, a retry ID in `asked_retry_ids` that isn't a retry, or a `remediation_count` outside 0–2.
   - `409` if `objective_status` is `complete` or `needs_review`. The student has to restart first.
   - `409` if `question_id` isn't the state's `expected_question_id`.
7. **State updates:** every response sets `objective_status` (`in_progress`, `complete`, or `needs_review`) and `expected_question_id` (the `next_question_id`, or `null` when the objective is finished).

### `POST /attempts` response

Every response returns the updated `remediation_state`, so Member 3 can save it.

```json
{
  "attempt_id": "attempt-001",
  "question_id": "rep-q2",
  "correct": false,
  "action": "review_again",
  "feedback": "Ligase joins pieces of DNA. It does not add the new bases. DNA polymerase extends a primer that primase made.",
  "misconception_id": "primer_requirement",
  "next_video_request": {
    "topic_id": "dna_replication",
    "objective_id": "synthesis_direction_and_primer",
    "variant_id": "primer_followup",
    "teaching_goal": "Explain why DNA polymerase needs a primer",
    "source_refs": ["L19-p1", "L19-p2"]
  },
  "next_question_id": "rep-r2",
  "remediation_state": { "objective_status": "in_progress", "expected_question_id": "rep-r2", "remediation_count": 1, "satisfied_question_ids": ["rep-q1"], "asked_retry_ids": ["rep-r2"] },
  "review_points": null,
  "source_refs": ["L19-p1", "L19-p2"]
}
```

For `continue_questions`, `complete`, and `needs_review`, `misconception_id` and `next_video_request` are `null`. `next_question_id` is `null` for `complete` and `needs_review`. `review_points` is filled only for `needs_review`. `feedback` always comes from `answer_key.json`, so the examples above use its exact text.

## Test cases

Each case starts from an empty `remediation_state` unless it says otherwise.

| # | Sequence | Expected |
| --- | --- | --- |
| 1 | q1=B | `continue_questions`, next `rep-q2` |
| 2 | q1=B, q2=A | `complete` |
| 3 | q1=A | `review_again`, `direction_followup`, next `rep-r1`, count 1 |
| 4 | q1=B, q2=B | `review_again`, `primer_followup`, next `rep-r2`, count 1 |
| 5 | q1=B, q2=C | `review_again`, `direction_followup`, next `rep-r1`, count 1 |
| 5b | q1=B, q2=C, r1=A | `continue_questions`, next `rep-q2` |
| 5c | q1=A, r1=A, q2=B, r2=A | `review_again` (count 2) → `needs_review` (a correct answer doesn't reset the count) |
| 6 | q1=B, q2=B, r2=B | `complete` (this is the demo walkthrough) |
| 7 | q1=A, r1=A | `continue_questions`, next `rep-q2` |
| 8 | q1=A, r1=B, r3=B | `review_again` → `review_again` (count 2, next `rep-r3`) → `needs_review` |
| 8b | q1=A, r1=B, r3=A | `continue_questions`, next `rep-q2` |
| 8c | q1=B, q2=B, r2=C | `review_again` (count 2, `primer_followup`, next `rep-r4`) |
| 8d | `POST /events` with a repeated `event_id` | Stored once |
| 8e | `POST /events` with no `build_id`, then one with a build ID not on the list | Both stored; `build_id_status` is `missing` and `unknown` in the export |
| 8f | Case 8, last response | `needs_review` with `feedback` from `rep-r3` choice B and `review_points` from the packet |
| 9 | Send the same `attempt_id` twice | Identical response both times, count goes up only once |
| 9b | Same `attempt_id`, different `selected_choice_id` | `409`, nothing changes |
| 10 | Unknown `question_id` or `choice_id` | `400` with a clear error |
| 10b | `asked_retry_ids` contains `dr-r1` on the replication objective | `400` naming `remediation_state.asked_retry_ids` |
| 10c | Any attempt after `complete` or `needs_review` | `409` |
| 10d | Empty state, answer `rep-q2` first | `409`, expected `rep-q1` |
| 11 | `GET /questions/rep-q2` | No answer key fields in the response |

Cover these cases with one runnable test file next to the grading code.

## Done when

- [ ] Every choice returns the expected feedback and next action (cases 1–8)
- [ ] Wrong answers request the matching video variant and a retry question
- [ ] One correct answer doesn't skip any remaining required questions (case 1)
- [ ] Two failed remediation cycles lead to `needs_review` (case 8)
- [ ] A repeated submission creates no extra attempt and no extra video request (case 9)
- [ ] Every released question, feedback line, and packet has a reviewed source ref
- [ ] Sample responses are committed and Member 3 has used them
- [ ] Topic availability matches the lessons that are actually built

## Decisions

1. **Language and framework:** Python standard library (see Service). Members 1 and 3 can use any stack, because they connect to this service over HTTP.
2. **Member 3 hasn't started building**, so the sample responses (task 7) come first. Member 3 builds against them, then switches to the live service by changing one base URL in their data-access module.

3. **Hosting:** PythonAnywhere free (Beginner) account. It's the cheapest option that works, at $0 with no card. See Hosting.

## Hosting

**Choice:** a free PythonAnywhere account, serving the app at `https://<username>.pythonanywhere.com` with HTTPS included. It's the cheapest host that fits, because SQLite needs a disk that survives restarts:

| Option | Cost | Why not |
| --- | --- | --- |
| **PythonAnywhere Beginner** | $0, no card | **Chosen.** Persistent 512 MiB disk, one Python web app, and static file mappings |
| Render free | $0 | Free services spin down after 15 minutes idle, and free services have no persistent disk, so SQLite data would be lost |
| Fly.io | Pay as you go (about $2+/month) | No free tier for new accounts since October 2024 |
| Koyeb free | $0 + $29 card hold | Scales to zero, and needs a card |
| Oracle Cloud Always Free VM | $0, needs a card | Works, but means running a whole server (OS updates, HTTPS, firewall). Fallback only if PythonAnywhere's limits are hit |

**One origin for everything:** the PythonAnywhere web app runs this WSGI service. Static file mappings serve Member 3's built files at `/` and Member 1's pre-rendered clips at `/media/`. Students get one link and the browser needs no CORS. The API paths (`/topics`, `/questions/…`, `/attempts`, `/events`, `/events.csv`) and Member 1's `/video-jobs` are routed to Python, and every other path is served as a static file.

**Limits and how the plan handles them:**
- **512 MiB disk:** this holds the code, the SQLite file, the web build, and the clips. Keep the clips to around 30–60 s at 720p or lower, so the 9 validation clips use well under 200 MiB.
- **Restricted outbound internet and limited CPU:** no video is rendered on the host. Member 1 renders the clips ahead of time, and the hosted `/video-jobs` returns the stored clip for the requested variant. That's the "served from a previously rendered version" case in Team_Spec, and presenters say so.
- **The web app expires one month after it's last extended:** click "Run until 1 month from today" on the Web tab right before Day 0, so it can't lapse during Days 0–2.
- **One web worker:** requests are handled one at a time, which is fine for 6 participants and short SQLite writes.
- **Configuration:** set the environment variables (see Service) at the top of the PythonAnywhere WSGI file before importing `application`.
- **Backups:** download `clipcademy.db` and the `events.csv` export at the end of Day 2. Free accounts can be cleaned up after long inactivity.

Verify these limits on PythonAnywhere's [free account page](https://help.pythonanywhere.com/pages/FreeAccountsFeatures/) before deploying, because free tiers change.

## Open questions for the team

1. **Who owns the PythonAnywhere account?** Create one team account, and share access through the dashboard, not a shared password.
