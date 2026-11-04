# Pre-test and post-test

Both tests cover the replication objective only (Lecture 19 pp. 1–2). The DNA repair lesson is not tested, because it's in the app to give students new content to return to, not to measure learning. Have a course-knowledgeable reviewer check the questions and rubric before testing.

**No overlap with the app.** None of these items reuse or reword the app's practice questions (`rep-q1`, `rep-q2`, `rep-r1`–`rep-r4` in [Member2_SPEC.md](Member2_SPEC.md)). The app asks which end, which direction, and which enzyme as multiple choice. These tests ask students to apply the same ideas to new situations in their own words. There are no answer choices, so students have to recall the idea instead of recognizing it. If either file changes, recheck both and log the check in content-audit.csv.

Item *n* on Form A and item *n* on Form B test the same skill, so the forms are parallel. Their difficulty hasn't been checked for equality.

**Overlap check, 2026-11-03** (Member 2, against all 24 app questions in `learning/data/questions.json`, all four topics). No test item reuses or rewords an app question.

| Item | Closest app question | Why it isn't a reword |
| --- | --- | --- |
| A1, B1 | `rep-r3` (which direction does the new strand grow) | The app asks for the direction as a choice. The test gives a template's orientation and asks the student to draw and label the new strand, which also needs antiparallel pairing |
| A2, B2 | `rep-q1`, `rep-r1` (which end gets new nucleotides) | The test asks the student to write out a specific strand after an addition, with no ends named |
| A3, B3 | `rep-q2` (why is a primer needed) | The test gives a situation (missing primer, or broken primase) and asks what happens. The expected reason matches `rep-q2`'s answer because it's the same skill, but the student has to work out that it applies. B3 used to ask "why can't DNA polymerase go first?", which was close to `rep-q2` asked directly, so it was rewritten to match A3 |

The reviewer still fills in `overlaps_app_question` for each `test:` row in content-audit.csv.

## Form A (pre-test, Day 0)

1. A template strand is written 3′ → 5′ from left to right. Sketch the new strand under it, label its 5′ and 3′ ends, and draw an arrow showing which way it grows.
   *1 point:* 5′ on the left, 3′ on the right, arrow pointing left to right. (L19 pp. 1–2: antiparallel strands, 5′→3′ synthesis.)
2. A new strand currently reads 5′-AGT-3′. The next nucleotide added is C. Write the strand after the addition, with ends labeled.
   *1 point:* 5′-AGTC-3′. (L19 p. 1: bases are added to the 3′ end.)
3. A researcher mixes single-stranded template DNA, DNA nucleotides, and DNA polymerase, with no primase and no primer. Will new DNA be made? Explain.
   *1 point:* no, because DNA polymerase can only extend an existing strand and can't start one from scratch. Saying "no" without a reason scores 0. (L19 pp. 1–2.)

## Form B (post-test, Day 2)

1. A template strand is written 5′ → 3′ from left to right. Sketch the new strand under it, label its 5′ and 3′ ends, and draw an arrow showing which way it grows.
   *1 point:* 3′ on the left, 5′ on the right, arrow pointing right to left.
2. A new strand currently reads 5′-CTA-3′. The next nucleotide added is G. Write the strand after the addition, with ends labeled.
   *1 point:* 5′-CTAG-3′.
3. A mutant cell makes normal DNA polymerase, but its primase doesn't work. Can this cell copy its DNA? Explain.
   *1 point:* no, because without primase no primer is made, and DNA polymerase can only extend an existing strand and can't start one from scratch. Saying "no" without a reason scores 0. (L19 pp. 1–2.)

## Scoring

Score each item 0 or 1, for a total of 0–3. Two scorers should score independently where possible, then resolve disagreements by discussion. Record both scores in participant-results.csv. Don't give feedback on either test.
