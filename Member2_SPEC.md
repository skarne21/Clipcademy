# Member 2 spec: questions and adaptive lesson logic

Owner: Member 2 · Folder: `learning/` (plus the shared lesson packets)
Source of truth: [Team_Spec](Team_Spec). If this file and Team_Spec disagree, Team_Spec wins until the team agrees on a change.
Subject: biology (confirmed). Lecture notes are in [Notes/](Notes/).

## What I own

- The topic list and objective IDs
- The first lesson packet (source excerpts plus initial and follow-up teaching goals)
- The question bank, answer key, and feedback for every choice
- Mapping each wrong answer to a misconception and a video variant
- Answer checking and the next-action decision (`continue_questions`, `review_again`, `complete`, `needs_review`)
- Enforcing the two-cycle remediation limit
- Endpoints: `GET /topics`, `GET /questions/{question_id}`, `POST /attempts`

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
| 9 | Return the follow-up request and a new question on wrong answers | verified with M3 | M1, M3 | Adaptive connection |
| 10 | Check sources, the answer key, and stopping rules | checklist below is ticked | Team | Demo readiness |

## Data

### Topics (`GET /topics`)

| `topic_id` | Label | Source refs | Availability | Objectives |
| --- | --- | --- | --- | --- |
| `dna_replication` | DNA replication | L19 pp. 1–3 | `available` | `synthesis_direction_and_primer` |
| `dna_repair` | DNA repair and telomeres | L20 p. 1 | `coming_soon` | none |
| `transcription` | Transcription | L21 p. 1 | `coming_soon` | none |
| `translation` | Translation | L22 pp. 1–2 | `coming_soon` | none |

Only topics with a finished and reviewed lesson can be `available`. The home page must not show unavailable topics as working.

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
    { "topic_id": "dna_repair", "label": "DNA repair and telomeres", "source_refs": ["L20-p1"], "availability": "coming_soon", "objectives": [] }
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
    { "ref": "L19-p1", "text": "<paste the approved excerpt>" },
    { "ref": "L19-p2", "text": "<paste the approved excerpt>" }
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

### Question bank

| ID | Role | Prompt | Choices | Correct | Wrong choice leads to |
| --- | --- | --- | --- | --- | --- |
| `rep-q1` | required | Which end receives new nucleotides during DNA synthesis? | A. 5′ end · B. 3′ end | B | A → `growth_direction` → `direction_followup` → `rep-r1` |
| `rep-q2` | required | Why is a primer needed? | A. DNA polymerase needs an existing complementary strand to extend · B. Ligase adds all new bases · C. DNA is synthesized only 3′ to 5′ | A | B → `primer_requirement` → `primer_followup` → `rep-r2` · C → `growth_direction` → `direction_followup` → `rep-r1` |
| `rep-r1` | retry for q1 | A complementary primer is already present. Where does DNA polymerase add the next DNA nucleotide? | A. Its 3′ end · B. Its 5′ end | A | B → `growth_direction` → `direction_followup` → `rep-r3` |
| `rep-r2` | retry for q2 | Which enzyme makes the RNA primer? | A. Ligase · B. Primase · C. DNA polymerase | B | A, C → `primer_requirement` → `primer_followup` → `rep-r4` |
| `rep-r3` | 2nd retry for q1 | DNA polymerase is adding nucleotides to a growing strand. In which direction does the new strand grow? | A. 5′ to 3′ · B. 3′ to 5′ | A | B → `needs_review` (limit reached) |
| `rep-r4` | 2nd retry for q2 | DNA polymerase sits on a bare template strand with no primer. What happens? | A. It cannot start a new strand · B. It starts a new strand at the 5′ end · C. Ligase starts the strand instead | A | B, C → `needs_review` (limit reached) |

Sources: q1, r1, and r3 come from L19 p. 1. q2, r2, and r4 come from L19 pp. 1–2.

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
| `rep-r4` | A ✓ | Correct. Without a primer, DNA polymerase has nothing to extend. |
| `rep-r4` | B | DNA polymerase can't start a strand anywhere on its own. It needs a primer to extend. |
| `rep-r4` | C | Ligase joins DNA pieces and doesn't start strands. Primase makes the primer, and polymerase extends it. |

Choice C on `rep-q2` names the wrong direction, so it goes to the direction follow-up (team decision; this changes Team_Spec's original mapping). Answering `rep-r1` correctly does not count for `rep-q2`, so the student comes back to `rep-q2` afterwards.

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
    "remediation_count": 0,
    "satisfied_question_ids": ["rep-q1"],
    "asked_retry_ids": []
  }
}
```

Member 3 saves `remediation_state` and sends it back with each attempt. The client keeps the state, and I make the decision.

### Rules

1. **Required questions.** The objective requires `rep-q1` and `rep-q2`. A correct answer on a retry question also counts for the required question it stands in for (`rep-r1`/`rep-r3` count for `rep-q1`, and `rep-r2`/`rep-r4` count for `rep-q2`).
2. **Correct answer:** add the question to `satisfied_question_ids`.
   - If any required question is still unsatisfied, return `continue_questions` with `next_question_id` set to the first unsatisfied one. A single correct answer must never skip the remaining required questions.
   - If all are satisfied, return `complete`.
3. **Wrong answer:**
   - If `remediation_count < 2`, return `review_again`, increment `remediation_count`, and include the mapped `misconception_id`, the `next_video_request` built from the packet variant, and `next_question_id` set to the first retry question for that misconception that is not yet in `asked_retry_ids` (direction: `rep-r1`, then `rep-r3`; primer: `rep-r2`, then `rep-r4`). Add it to `asked_retry_ids`, so every follow-up video is followed by a question the student hasn't seen.
   - If `remediation_count == 2`, return `needs_review` with the reviewed explanation. Send no video request and no next question.
4. **Limit:** at most two follow-up cycles **per objective in total** (team decision). A correct answer does not reset the count. Example: missing q1 (cycle 1), answering the retry correctly, then missing q2 is cycle 2, and the next wrong answer returns `needs_review`.
5. **Idempotency:** if an `attempt_id` has been seen before, return the stored result unchanged. Do not create a second attempt, count another cycle, or issue another video request.
6. **Errors:** reply `400` for unknown question or choice IDs, a question that doesn't belong to the objective, or a malformed body. The error must say which field is wrong.

### `POST /attempts` response

Every response returns the updated `remediation_state`, so Member 3 can save it.

```json
{
  "attempt_id": "attempt-001",
  "question_id": "rep-q2",
  "correct": false,
  "action": "review_again",
  "feedback": "DNA polymerase extends an existing complementary strand. Primase supplies the RNA primer that starts it.",
  "misconception_id": "primer_requirement",
  "next_video_request": {
    "topic_id": "dna_replication",
    "objective_id": "synthesis_direction_and_primer",
    "variant_id": "primer_followup",
    "teaching_goal": "Explain why DNA polymerase needs a primer",
    "source_refs": ["L19-p1", "L19-p2"]
  },
  "next_question_id": "rep-r2",
  "remediation_state": { "remediation_count": 1, "satisfied_question_ids": ["rep-q1"], "asked_retry_ids": ["rep-r2"] },
  "source_refs": ["L19-p1", "L19-p2"]
}
```

For `continue_questions`, `complete`, and `needs_review`, `misconception_id` and `next_video_request` are `null`. `next_question_id` is `null` for `complete` and `needs_review`.

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
| 9 | Send the same `attempt_id` twice | Identical response both times, count goes up only once |
| 10 | Unknown `question_id` or `choice_id` | `400` with a clear error |
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

## Open questions for the team

1. **Framework and language** for the service have not been chosen yet.
