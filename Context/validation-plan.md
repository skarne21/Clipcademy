# Validation test plan

## Scope

A one-day alpha study of ClipCademy with 6 students who are studying the biology content in Lectures 19–22. Each student takes a pre-test in the morning, goes through the app's two lessons once, and takes a post-test in the evening, about 8 hours later. The app is used as-is: no app or server changes are needed for this study.

- **Taught in the app:** DNA replication (Lecture 19 pp. 1–2) and DNA repair (Lecture 20 p. 1).
- **Comparison topics:** transcription (Lecture 21 p. 1) and translation (Lecture 22 pp. 1–2). They're on both tests and covered in lectures, but stay "Coming soon" in the app for the whole study. Each student's gain on them shows how much they improve without the app.

The product aims to improve **active recall**: students retrieve answers from memory instead of rereading notes. The tests mix multiple choice with written answers, so recall without answer choices is measured too.

Participation is voluntary and has nothing to do with grades. Participants are identified only by an anonymous code (P01–P06). Ask them not to type personal information into free-text answers.

## What changed from the previous plan

| Area | Previous plan | Now |
| --- | --- | --- |
| Length | Day 0 and Day 2, 48 hours apart | One day: morning session, free time, evening session |
| Lessons | Replication only on Day 0; repair optional | Both lessons, once each, replication first |
| Comparison | None | Transcription and translation: tested but not taught in the app |
| Morning app use | Free use, plus a scripted follow-up task for students who never answered wrong | Each student goes through both lessons (clips, then questions) and stops. A follow-up clip plays only after a wrong answer |
| Tests | 10 multiple choice; only replication and repair scored | Same Forms A and B, all 10 scored, plus a written sheet with 1 question per topic |
| Outside studying | One free-text question | Yes or no per topic, plus what |
| H1 | Usability: 5 of 6 finish the flow with no help | Usability becomes a gate checked before the hypotheses |
| H2 | Score gain of at least 2 questions | H1 Learning: gain on taught topics minus gain on untaught topics |
| H3 | Answering on a later day | H2 Return: answering between sessions, not in the last hour before the test |
| Demand | Not measured | H3 Demand: "How would you feel if you could no longer use ClipCademy?" |

## What research says about a one-day test

- **Forgetting is smaller over hours than days.** In Ebbinghaus's forgetting curve and its 2015 replication by Murre and Dros, forgetting continues for days and weeks. An evening test catches less of it than a later one, so evening scores will be higher than they would be after a longer gap.
- **Retrieval practice pays off after a delay.** In Roediger and Karpicke (2006), restudying did as well or better on a test minutes later, while practising recall did better 2 days and 1 week later. A one-day test understates what recall practice adds.
- **There's no good benchmark for same-day returns.** Education apps keep roughly 15–26% of users the next day. Any return before an evening test is partly test preparation, so the last hour before the post-test doesn't count.

A learning pass in this study shows the app works within a day. Claiming lasting recall needs a test at least 2 days later.

## Hypotheses

The full tests (data sources, calculations, pass rules and the decision table) are in [hypothesis-tests.md](hypothesis-tests.md).

| | Question | Supported if |
| --- | --- | --- |
| Gate | Can students use the app without help? | Each step done unaided by at least 5 of 6 |
| H1 Learning | Do students learn more on the topics the app teaches? | Mean app effect (taught gain % − untaught gain %) at least 15 points, and at least 4 of 6 positive |
| H2 Return | Do students come back on their own? | At least 3 of 6 answer a question between sessions, not in the last hour before the test |
| H3 Demand | Would they miss it? | At least 3 of 6 say "very disappointed" |

These are team decision rules, not published benchmarks. Lock them before recruiting, and report any later change as a deviation. The original pitch KPIs (about 60 students over three weeks, weekly topic completion, sessions more than three days before an exam) are not tested by this study.

## Procedure

### Before recruiting

1. ~~Get written permission from the instructor to use the lecture-note excerpts.~~ **Done 2026-11-02** (received by Member 2). Keep it with the study records.
2. **Content audit.** A course-knowledgeable reviewer approves every app question, feedback line, lesson packet and clip transcript for DNA replication and DNA repair, plus every test item, including the 8 written questions in [assessment.md](assessment.md). Fix and re-review anything with an error, then set both lesson packets to `review_status: "reviewed"`. `python learning/check_content.py --freeze` must pass. Transcription and translation stay `coming_soon` whatever their review status.
3. Freeze the build and set its `build_id` in the app, so every event carries it. Add the same ID to the server's list of valid build IDs.
4. Deploy the frozen build to PythonAnywhere and open it from a phone to check it works. Right before the study day, extend the web app's expiry ("Run until 1 month from today").

### Morning session (moderated, about 30 minutes)

Morning slots are staggered (for example P01 at 8:30, then one every 40 minutes). Evening slots follow in the same order, about 8 hours later.

1. Explain the study, the data collected, and that participants can stop at any time. Assign a code and record prior exposure to each topic.
2. Give the pre-test without feedback ([assessment.md](assessment.md)). Record the start and end times.
3. The participant enters their code and goes through both lessons: clips, then that lesson's questions, until the summary. Read the [session-guide.md](session-guide.md) script and record every step where you helped.
4. When both summaries are reached, read the closing line and end the session.

### Between sessions (unmoderated)

From here on the team only tracks. Don't contact or remind anyone, and record any contact in `reminders_sent`. The app logs everything students do.

### Evening session (moderated, about 25 minutes)

1. Ask about outside studying per topic since the morning.
2. Give the post-test on the other form, without feedback.
3. Run the interview, then the demand question, then offer the semester sign-up sheet ([session-guide.md](session-guide.md)).
4. After the last session, download `learning/clipcademy.db` and the `events.csv` export.

If a blocker has to be fixed during the day, give the fix a new `build_id` and record which participants saw which build.

## Recording

| File | What goes in it | Who fills it |
| --- | --- | --- |
| [events.csv](events.csv) | Every app event, exported from the server with the admin token | The app |
| [test-responses.csv](test-responses.csv) | Every test answer, morning and evening, with its score | Moderator; a blind scorer for written answers |
| [participant-results.csv](participant-results.csv) | Session times, score totals per topic, help given, outside studying, demand answer | Moderator |
| Interview notes | Answers to the interview questions | Moderator |

Events carry two UTC times: `client_timestamp_utc` (when the action happened on the device) and `timestamp_utc` (when the server received it). Use `client_timestamp_utc`, converted to the study's local time zone, for the between-sessions window. Leave out events whose `build_id_status` is `missing` or `unknown`, and events from the team's own `TEST` code, and report how many there were.

Also report, without a pass rule: time on app (`heartbeat` events × 0.5 min), clip completion per clip (`video_completed` / `video_started`), follow-ups watched, first-try accuracy on the required questions, and how many students reached a follow-up clip.

Keep every participant in the report, including those who struggled or withdrew. Record missing post-tests as missing, never as zero.

## Limitations to report

- No true control group. The comparison topics are different material, so part of a difference could come from those topics being harder to improve on.
- Six participants is a convenience sample. One student changes any count by 17 percentage points.
- An 8-hour gap measures learning within a day, not lasting recall.
- Outside studying is self-reported.
- Participants know they're in a study and that an evening test is coming, which may raise effort and returns.
- The demand question shows interest, not willingness to pay.

## Decision and submission

Report each hypothesis separately as **supported**, **not supported**, or **insufficient evidence**, then apply the decision table in [hypothesis-tests.md](hypothesis-tests.md). Submit the build ID, participant counts, raw anonymized data, every calculation, interview themes, limitations and the decision, using [decision-report-template.md](decision-report-template.md).
