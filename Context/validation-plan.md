# Validation test plan

## Scope

This is an alpha study of Clipcademy with **6 students** who are studying the biology content in Lectures 19–22. The app has two lessons for the study:

- **DNA replication** (Lecture 19 pp. 1–2): synthesis direction and the primer requirement. This is the measured lesson. The pre-test and post-test cover only this one.
- **DNA repair** (Lecture 20 p. 1): proofreading, mismatch repair, and UV-damage repair. This lesson isn't tested. It's there so students have something new to come back to.

**Why two lessons.** One lesson takes about 10 minutes on Day 0. With nothing new left, a low return rate (H3) couldn't tell "didn't value the app" apart from "had nothing left to do." All four lectures would delay the study for more clips and review, and Lectures 21 and 22 have unclear or inconsistent passages that could put wrong content in front of students. DNA repair follows replication directly in the course and adds only three clips and one lesson's review.

The product aims to improve **active recall**: students retrieve answers from memory instead of rereading notes. The study therefore measures recall, not recognition. The pre-test and post-test are free response with no answer choices, and H3 checks whether students come back on a later day to practice retrieval again.

**Design:** every participant gets the same thing, with no control group.

1. **Day 0:** pre-test, then a first observed session in the app
2. **Days 0–2:** voluntary use of the app on their own, with no reminders
3. **Day 2** (about 48 hours after Day 0): post-test and short interview

Participation is voluntary and has nothing to do with grades. Participants are identified only by an anonymous code (P01–P06). Ask them not to type personal information into free-text answers.

## Base thresholds

These are the base thresholds for the study. They're team decision rules, not published benchmarks. Lock them before recruiting, and report any later change as a deviation.

| Hypothesis | Base threshold | Why this number |
| --- | --- | --- |
| H1 Usability | **≥ 5 of 6 (83%)** finish the core flow on Day 0 with no moderator help | Allows one participant to struggle, and matches the common ~80% task-completion bar for usability tests |
| H2 Recall gain | **Mean gain ≥ 1 point out of 3 (+33 percentage points)** and **≥ 4 of 6** improve | One more correct item is the smallest change a 3-item test can show. Requiring a majority to improve keeps one big gain from carrying the mean |
| H3 Voluntary use | **≥ 3 of 6 (50%)** answer a question on a later calendar day, with no reminder | Half the group returning on their own is a meaningful signal for a 2-day window |

If a participant scores 3/3 on the pre-test, they can't show a gain. Report them separately and judge H2 on the rest, stating the new denominator.

## Hypotheses

**H1 Usability.** Students can complete the core flow without help: select a topic, watch the clip, answer a question, watch a follow-up, and return home.
Supported if at least **5 of 6** complete it in the Day 0 session without moderator help.
Report H1 two ways:
- **H1 natural:** the participant reached the follow-up through their own wrong answer and finished with no help. Only this count is judged against the ≥ 5 of 6 rule.
- **H1 with script:** the participant needed the scripted follow-up task but did every other step alone. Report this count alongside the natural one, not as part of the rule.

The scripted task is an instruction, not help. Anything beyond the script (explaining a button, pointing at the screen) counts as help.

**H2 Recall gain.** Free-recall scores improve from pre-test to post-test.
Supported if the **mean gain is at least 1 point (out of 3)** and **at least 4 of 6** participants improve.
With no control group, a gain shows that learning happened during the study period. It does not prove the app caused it, because class, other studying, or the pre-test itself could contribute.

**H3 Voluntary use.** Students choose to use the app on their own.
Supported if at least **3 of 6** open the app and answer at least one question on a **later calendar day than Day 0**, with no individual reminder. A question from either lesson counts. Also report which lesson each returning participant worked on: returns to DNA repair suggest students came for new content, and returns to replication suggest they came to practice recall again.

The original pitch KPIs (about 60 students over three weeks, weekly topic completion, sessions more than three days before an exam) are not tested by this alpha study and stay marked untested.

## Procedure

### Before recruiting

1. Get written permission from the instructor to use the lecture-note excerpts.
2. **Content audit.** A course-knowledgeable reviewer checks every app question, feedback line, lesson packet, clip transcript, and test item against the lecture notes. Record one row per item in [content-audit.csv](content-audit.csv), including whether a test item overlaps an app question. Nothing reaches participants unless its `review_status` is approved. Fix and re-review anything with an error. Then set each approved lesson packet to `review_status: "reviewed"`. Any lesson that isn't fully approved goes back to `coming_soon` in the frozen build.
3. Freeze the build and set its `build_id` in the app, so every event carries it. Add the same ID to the server's list of valid build IDs.
4. Deploy the frozen build to the PythonAnywhere web app, and open it from a phone to check it works. Right before Day 0, extend the web app's expiry ("Run until 1 month from today"), so it can't lapse during the study. After Day 2, download the database and the `events.csv` export.

### Day 0 (moderated, about 20 minutes)

1. Explain the study, the data collected, and that participants can stop at any time. Assign a participant code and record prior exposure to the lecture content.
2. Give the **pre-test** (Form A in [assessment.md](assessment.md)) without feedback and record the score.
3. Open the app and have the participant enter their code. Read the session-guide script and observe a natural first use. Record any help given.
4. If the participant never answered a question wrong, run the scripted follow-up task from [session-guide.md](session-guide.md) so the follow-up flow is still tested for H1.
5. Tell them the app is available for the next two days, and that using it is entirely up to them.

### Days 0–2 (unmoderated)

Don't remind or prompt anyone individually. Record any contact in `reminders_sent`. The app logs activity automatically (see Measuring activity).

### Day 2 (moderated, about 15 minutes)

1. Ask what else they used to study these topics since Day 0.
2. Give the **post-test** (Form B) without feedback and record the score.
3. Ask the interview questions from the session guide.

If a blocker has to be fixed mid-study, give the fix a new `build_id` and record which participants saw which build.

## Measuring activity

The app sends an event for every action to `POST /events` (defined in [Team_Spec.md](Team_Spec.md), Activity events). Each event carries the participant code, session ID, and timestamp. Export it as [events.csv](events.csv). Local browser storage alone can't measure activity, because it never leaves the participant's device.

| Metric | Calculation (from events.csv unless noted) |
| --- | --- |
| Unassisted completion (H1 natural) | Participants who finished the core flow on Day 0 without help or the script / 6. From `day0_flow_completed`, `assistance_count`, and `scripted_followup_used` in participant-results.csv |
| Completion with script (H1 with script) | Participants who used only the scripted task and no other help / 6 |
| Score percent | Points / 3 × 100, from participant-results.csv |
| Individual gain (H2) | Post points − pre points |
| Mean gain (H2) | Mean of individual gains; also report every individual gain |
| Later-day use (H3) | Participants with a `question_answered` event on a calendar day after Day 0 / 6 |
| Later-day lesson split | For each returning participant, later-day `question_answered` events by `topic_id` (replication vs. repair) |
| Day 0 repair use | Participants who opened DNA repair on Day 0 despite the script. Reported as a deviation |
| Days active | Distinct calendar days with an `app_opened` event, per participant |
| Sessions | Distinct `session_id` values per participant |
| Active minutes | Sum over sessions of (last event time − first event time) |
| Questions answered / correct | Count of `question_answered` events, split by `correct` |
| Follow-ups watched | `video_completed` events for follow-up variants |
| Later-day recall accuracy | Share of `question_answered` events after Day 0 with `correct` true. Reported only, not a hypothesis |

Events carry two UTC times: `client_timestamp_utc` (when the action happened on the device) and `timestamp_utc` (when the server received it). Use `client_timestamp_utc`, converted to the study's local time zone, to decide which calendar day an event falls on. A send retried the next day must not count as a later-day return. Report any event whose two times are more than 10 minutes apart, since that points to a retried send or a wrong device clock. Leave out events whose `build_id_status` is `missing` or `unknown`, and report how many there were.

At n = 6, 5/6 = 83%, 4/6 = 67%, and 3/6 = 50%. These are threshold examples, not results.

Keep every participant in the report, including those who struggled, never returned, or withdrew. Record missing post-tests as missing, never as zero.

## Limitations to report

- No control group: gains can't be attributed to the app alone.
- Six participants is a convenience sample, not a power-based size.
- A 3-point test is short and not a standardized measure. Forms A and B are written to be parallel, but their difficulty hasn't been checked for equality.
- Only two lessons are available, so there's still limited new content to return to. A student who finishes both may have nothing left.
- The tests cover replication only. Use of the DNA repair lesson adds no learning evidence.
- Participants know they're in a study, which may increase their use.
- A 2-day gap is a short test of recall. Whether students still remember a week later is untested.

## Decision and submission

Report each hypothesis separately as **supported**, **not supported**, or **insufficient evidence** under the rules above. If the rubric uses Validated/Invalidated/Pivot, map these to "Validated for this alpha sample," "Invalidated under this test," and "insufficient evidence" disclosed as such.

What to do next depends on the findings:
- Usability failures → fix the interface.
- Use without score gains → revisit the lesson and question design.
- Little voluntary use → revisit when and why students would open it.
- Content errors → block release until the content is reviewed.

Submit the build ID, participant counts, raw anonymized results, metric calculations, interview themes, limitations, and the decision, using [decision-report-template.md](decision-report-template.md).
