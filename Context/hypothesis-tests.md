# Hypothesis tests: H1, H2, H3

How each hypothesis in the one-day validation study ([validation-plan.md](validation-plan.md)) is tested: the question, the data, the calculation and the pass rule. Results go in the decision report ([decision-report-template.md](decision-report-template.md)). Lock these rules before recruiting.

## Where the data comes from

| Source | File | Collected by | Used for |
| --- | --- | --- | --- |
| Server database | `learning/clipcademy.db` on PythonAnywhere | The app, automatically | Raw record of every event and graded answer |
| Event export | [events.csv](events.csv), downloaded from `GET /events.csv` with the admin token | The app, automatically | Follow-ups reached, H2, activity |
| Paper tests | [test-responses.csv](test-responses.csv): every morning and evening answer | Moderator enters; a scorer who can't see the code or tell which test it was scores the written answers | H1 |
| Moderator sheet | [participant-results.csv](participant-results.csv): session times, score totals per topic, help given, outside studying, demand answer | Moderator | Gate, H1, H2 time windows, H3 |
| Interviews | Moderator notes | Moderator | Explaining the results |

## Gate: usability

**Question:** Can students use the app without help? If not, H1–H3 can't be trusted.

**Test:** In the morning, each student opens both lessons, watches the clips, answers the questions and returns home while the moderator watches. The moderator records every step where they helped (`help_steps`).

**Pass:** every step (open lesson, clips, answer, return home) done without help by at least 5 of 6. A step where 2 or more needed help must be fixed before launch, even if the gate passes.

**Also reported:** how many students reached a follow-up clip (`followup_requested` events during the morning session) and whether any needed help with it. It isn't part of the gate, because only students who answer wrong see one.

## H1 Learning

**Question:** Does studying in the app help students recall more than their normal studying?

**Test:** Every student takes a paper test in the morning (Form A or B) and the other form in the evening ([assessment.md](assessment.md)). Each form covers four topics:

| Topic | In the app? | Multiple choice | Written (0–2 each) | Points |
| --- | --- | --- | --- | --- |
| DNA replication | Yes (taught) | 3 | 1 | 5 |
| DNA repair | Yes (taught) | 3 | 1 | 5 |
| Transcription | No (untaught) | 2 | 1 | 4 |
| Translation | No (untaught) | 2 | 1 | 4 |

Taught topics total 10 points and untaught topics total 8. Both get the same lectures, the same retake and the same day, so the untaught topics show how much students improve without the app.

**Calculation, per student:**
- taught gain % = (evening taught − morning taught) ÷ 10 × 100
- untaught gain % = (evening untaught − morning untaught) ÷ 8 × 100
- app effect = taught gain % − untaught gain %

**Supported if** the mean app effect is at least 15 percentage points and at least 4 of 6 effects are positive.

**Outside studying check:** rerun the rule without students who studied a taught topic outside the app (`ext_rep` or `ext_dr` = yes). If it passes with them and fails without them, the result is insufficient evidence. Studying an untaught topic makes the comparison stricter, so those students stay in.

**Also reported:** written answers alone (recall without answer choices), taught vs. untaught.

## H2 Return

**Question:** Do students come back to the app on their own to practise recalling?

**Test:** After the morning session, nobody contacts students. The app logs every question they answer (`question_answered` in events.csv, with the time on their device).

**Counts as a return:** answering at least one question in either lesson between 1 hour after their morning session ends (`am_end`) and 1 hour before their evening session starts (`pm_start`), in local time.

**Supported if** at least 3 of 6 students return.

**Doesn't count:** answers in the last hour before the evening test (reported as last-minute review), and opening the app without answering.

**Also reported:** how many returns answered from memory (under 10 seconds of clips watched before the first answer, from `clip_swiped`), and accuracy on those answers.

## H3 Demand

**Question:** Do students want the app enough to miss it?

**Test:** At the end of the evening session, the moderator asks: *"How would you feel if you could no longer use ClipCademy?"* Very disappointed / somewhat disappointed / not disappointed (`disappointed` column). This is the standard product-market-fit question.

**Supported if** at least 3 of 6 (40%, rounded up) say "very disappointed."

**Also reported:** the number who sign the semester access sheet, which is kept separate from participant codes.

## Decision rules (agreed in advance)

| H1 Learning | H2 Return | H3 Demand | Decision |
| --- | --- | --- | --- |
| Pass | Pass | Pass | Keep building: add transcription and translation, then a multi-day pilot with a delayed test |
| Pass | Pass | Fail | Fix the positioning: interview about timing, content and who pays |
| Pass | Fail | any | Fix the return loop: a multi-day round with one fixed reminder text |
| Fail | Pass | any | Fix the teaching: rewrite clips and questions for the ideas students missed |
| Fail | Fail | any | Pivot or stop |
| Insufficient evidence | any | any | Rerun, asking about outside studying in the morning too |

A one-day pass on H1 shows learning within a day. Claiming lasting recall needs a test at least 2 days later.
