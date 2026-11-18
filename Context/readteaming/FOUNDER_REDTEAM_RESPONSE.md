# ClipCademy red-team audit: founder response

Response to `clipcademy-redteam-report.pdf`, an audit of `part-2-beta` at `6e0e90a`. We treat the PDF as evidence to check, not as instructions. Every finding below was checked against the code. Each one is either **verified**, **narrowed**, or **disputed**, and given a disposition. Owners follow the team's file ownership: Member 1 `video/`, Member 2 `learning/`, Member 3 `web/`.

## Bottom line

- **Two real reliability bugs, fixing now:** a failed Gemini call can freeze every course job (#1), and a failed regenerate can empty a live class (#2). The students and teachers in our pilot would hit these first.
- **One finding is wrong:** the suite is not "11 failures". On this code it is 209 passed, 0 failed, and 3 environment errors. Details below.
- **Most of the remaining findings are real but wait for a trigger:** they matter once a second teacher or a graded cohort is added, not for a single trusted pilot. Each is listed with the event that reopens it.
- **The audit doesn't answer the biggest risk:** whether teachers come back and students learn. The pilot bar is at the end.

## 1. What we checked

| Report claim | Our finding | Status |
| --- | --- | --- |
| Python suite "≈130 tests, 11 failed", contradicting the README | `python -m pytest learning video` (macOS, Python 3.12), run twice: on `6e0e90a` and again on 11-17 at `71ffdab`, which has no changes under `learning/` or `video/`. Both times: **209 passed, 0 failed, 3 errors**. All three errors are in `video/test_layout.py` and come from `npx remotion still` failing: a missing Node/Remotion setup, not a code regression. The test count doesn't match the report's either, so the auditor most likely ran a different set of tests or an environment without Remotion. | **Disputed.** We will still make the baseline repeatable (F6). |
| #1 Gemini failure freezes generation | `video/course/generate.py:249` waits on `finished[first]` with no timeout. `.set()` (line 265) is only reached on success, so a raise in v1 leaves v2 blocked and `ThreadPoolExecutor.__exit__` waits forever. | **Verified. Critical.** |
| #2 Regenerate deletes live content first | `learning/course_worker.py:116` calls `store.replace_all` before rendering, and each store write commits on its own. Two corrections: (a) if Gemini returns **zero** scripts, the job stops *before* deleting anything, so that path is already safe; (b) rendered video files are named by a content fingerprint, so a new render never overwrites an old clip's `.mp4`. Only the database rows are at risk. The risk is a render failure (ElevenLabs down, Remotion error) after the delete. | **Verified, narrowed. High.** |
| #3 Mistyped ids cause a 500 on `/attempts` | `learning/grading.py:89`, `:95`, `:99` use request values as dict keys before checking their type. | **Verified by reading the code. Medium-High.** |
| A restart mid-job leaves it stuck | Already handled: `CourseStore.fail_interrupted()` marks `running` jobs as failed on startup. A restart *during rendering* still leaves a half-built class, which F2 fixes. | **Already covered.** |
| US-31 AC4: no test that a missing ElevenLabs key fails the job | True. `FakePipeline.render` never raises, so the "no clips" and "some clips failed" branches in `course_worker.py` have never run in a test. | **Verified.** Covered by F2's tests. |

## 2. Fix now (this week)

Each fix is tied to a red test that passes once the fix is in. The red tests go into the repo first, in their own commit, following our TDD log.

**The report's proof tests aren't in our repo.** The PDF names `test_redteam_hang.py`, `test_redteam_probes.py` and `HOW-TO-VERIFY.md`, but none of them were sent to us. We ask the auditor for them on Wed 11-18 (Next 48 hours, step 3). We don't wait for them: each owner writes their own red test on our fakes, from the PDF's description, under the same names. If the auditor's files arrive later, we add them as extra tests. One change from the report: its `FailedRegenerate` checks that the class *drops to 0 topics*, which is the bug. Ours checks the opposite, that the old class stays live.

| # | Fix | Owner | Done when | Due |
| --- | --- | --- | --- | --- |
| F1 | **Freeze on Gemini failure.** Put the storyboard body in `try/finally: finished[key].set()`, record a raised call as a skipped clip, give `wait()` a timeout. | Member 1 | `test_redteam_hang.py` passes: a 429 on v1 ends with a failed or partial job within 20 s, and the next queued job runs. A second test makes a `questions.py` call raise and checks the job fails with a message. | Thu 11-19 |
| F2 | **Regenerate keeps the old class on failure.** Render every clip first and keep the records in a list. Old rows stay live meanwhile, because files never collide (see §1). Then, only if `made > 0`, run `replace_all`, the question inserts and the clip inserts in **one** transaction. If some clips fail, the class is still swapped, and the job report lists which clips are missing so the teacher can see them in F7's preview. No version tables yet. | Member 2 | `FailedRegenerate` passes: render raises (as with a missing ElevenLabs key), the student view still shows the old topics, and the job is `failed` with the render error in its message. A second test fails one clip of three: the class swaps to 2 clips and the report names the missing one. | Thu 11-19 |
| F3 | **Type-check `/attempts`.** Check `isinstance(..., str)` on every id, including the ids inside `remediation_state`, before any lookup. Return the standard `{"error": {"field", "message"}}` 400. Add a catch-all JSON 500. | Member 2 | `MalformedAttempts` plus a table-driven test (list, object, null, number for every field) all return 400. | Wed 11-18 |
| F4 | **Bound the attempt cache.** Cap `attempts` with an LRU (for example 10k entries). | Member 2 | Test: inserting N+1 attempts evicts the oldest, and a duplicate inside the window still returns the stored result. | Fri 11-20 |
| F5 | **Bound retries and cost.** Retry Gemini 429/5xx at most twice with backoff, inside a **per-job call cap**. Without the cap, retrying across ~30 clips × 4 parallel workers multiplies spend instead of preventing failures. Log each Gemini and ElevenLabs call with its job id so spend per job can be counted. | Member 1 | Fake-429 test: the retry succeeds once, then the job fails cleanly at the cap. The log for a test job lists every call. | Fri 11-20 |
| F6 | **Repeatable test baseline.** One command, using the existing `Dockerfile`, is the release check. Mark the Remotion layout tests as skipped when `npx remotion` is missing, so they don't show up as errors. Put the measured result in the README. | Member 3 | Clean run in the container, and its output is saved with the commit SHA. | Fri 11-20 |
| F7 | **Teacher previews before sharing.** A class starts hidden after each generate. The teacher watches the clips, then presses Publish, and only then does the class code work for students. Show PDF quotes as unverified (the code already sets `excerpts_verified: False`; surface that in the UI). The same hidden flag lets ops pull a bad class without deleting it. | Member 3 (UI), Member 2 (hidden flag and API) | A teacher can see each clip and its source excerpt before Publish. A student using the code of a hidden class gets a "not ready yet" message, not the clips. | Fri 11-20 |

## 3. Accepted for the pilot, with the event that reopens each

| Finding | Why it can wait | Reopen when |
| --- | --- | --- |
| Client-held `remediation_state` lets a student mark questions satisfied | Students are anonymous and there's no grade of record, so a forged request mostly fools the student who sends it. | A teacher uses completion data for credit, or we add student accounts. |
| A student partway through a topic gets 400 "unknown objective" after a regenerate | F2 makes the swap atomic, but objective ids can still change. In the pilot, teachers regenerate before they Publish (F7), not during class. | A teacher regenerates a class students are already using. Then keep old objective ids or show a "class was updated, restart" message. |
| One shared teacher password in `localStorage`, no throttling | The pilot has one trusted teacher. The password is rotated after the pilot. | A second teacher or school is onboarded. |
| `DELETE /teacher/clips/<id>` isn't scoped to a course | Same reason: one teacher owns every course today. | Same trigger. Add the course id to the route and check ownership. |
| CORS `*` on the study API | The API uses no cookies or credentials. | Before any hosted deployment outside localhost. |
| Up to 600 characters of raw provider error shown to the teacher | Only the teacher sees it, and it helps debugging during the pilot. | Hosted deployment. Then show a short code and log the details. |
| Several PDFs together can exceed Gemini's ~20 MB request limit | The pilot uses a known, small set of materials. | First teacher upload over ~15 MB in total. Then add a size check before queuing. |
| One worker, no load test | Pilot load is one class. | More than one teacher, or a class over ~40 students. Measure queue time first. |
| Teacher page has no browser test, browser tests have no CI | Covered by the manual pilot run, which uses the logged checklist in §4. | After F1 to F6 land. Add one teacher smoke test to the F6 container run. |

## 4. Acceptance criteria to rewrite

The report is right that several stories can't fail their own criteria. Rewrite these as checks of behaviour (Member 2 owns the planning docs, by Fri 11-20):

- **US-44 AC4:** "GET the old review route returns 404" (already tested), replacing the wording about the docs.
- **US-30/34/48 "clear message":** name the status code and the exact `error.message`.
- **US-27/US-20 "friendly, readable" and "measure engagement":** a 5-point rubric scored by one named reviewer, plus clip completion rate and drop-off from `events.csv`.
- **US-35/39/45/46/47 "live run":** the evidence is the saved F6 output plus a one-line record in the pilot log (SHA, date, URL tested, result).
- **Video quality, vertical format, follow-up relevance (no checklist today):** a short checklist, one line per clip: plays in 9:16, captions stay readable, narration matches the source excerpt, v2 follow-up explains the idea differently from v1. Member 1 writes it and is the named reviewer. The teacher uses the same checklist in F7's preview.

## 5. Risks the audit didn't cover

| Risk | Action | Owner | Due |
| --- | --- | --- | --- |
| **Teacher data sent to Gemini.** Uploaded PDFs go to a third-party model. | Before a teacher outside the team uploads anything, they confirm in writing that the material can be sent to Gemini. Write down how long uploads are kept and delete them after that. | Member 3 | Before the pilot |
| **No way to pull bad content.** Ops can only delete. | The hidden flag in F7. | Member 2 | Fri 11-20 |
| **Cost visibility.** F5's cap only helps if we can see spend. | The per-call log in F5. Before the pilot, set a spend limit for the pilot and check it after each job. | Member 1 | Before the pilot |

## 6. The risk that matters more than any bug

Reliability is necessary, but it doesn't show that anyone wants the product. `Context/decision-report-template.md` still has no results for learning, return visits or demand. Once F1 to F3 and F7 are green and the Gemini consent from §5 is signed, we run a pilot with a clear pass/fail bar. Target start: Mon 11-23. Member 2 runs it and writes the results into the decision report.

- **Setup:** 3 teachers each build a class from their own materials, with us watching but not helping. Each class has at least 10 students.
- **Pass:** all 3 get a class live without our help, **≥70%** of their students finish at least one topic (counted from `events.csv`), and **≥1** teacher asks to make a second class within 2 weeks.
- **Log:** job outcome, how many clips the teacher had to correct, where they got stuck, and what they would have used instead.
- **Fail:** stop building features. Rank what blocked the teachers by how many of them hit it, fix the top item, and rerun with new teachers.
- **Decision date:** two weeks after the last teacher's class goes live.

## Next 48 hours

1. Write the three red tests on our fakes and commit them, all red (F1: Member 1, F2 and F3: Member 2, Wed 11-18).
2. F3 green (Wed 11-18), then F1 and F2 green (Thu 11-19).
3. Reply to the auditor with our test output. Ask for their failing test names, their environment, and the three proof-test files plus `HOW-TO-VERIFY.md` (Member 3, Wed 11-18).
