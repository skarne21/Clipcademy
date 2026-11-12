# ClipCademy Alpha presentation script | 8 minutes

For **ClipCademy Alpha Demo.pptx**. One teammate gives the full talk. Bracketed cues are actions. The video on slide 7 runs for 52 seconds. Play it once; speak in the gaps or lower the video volume. The times below include playback and pauses.

### 1 · ClipCademy | 0:00–0:08
We're Shivaths, Neel and Vaibhav. We built ClipCademy to help intro biology students practice the questions they get stuck on.

### 2 · The biology exam | 0:08–0:35
Which end of a growing DNA strand receives new nucleotides: the five-prime end or the three-prime end? [Pause for a show of hands.] It's the three-prime end. Imagine rereading that diagram twice the night before the exam. You recognize both labels. Then the diagram disappears and you have to choose. That's the moment we designed for.

### 3 · Who took part | 0:35–1:00
We planned for six intro biology students who had studied Lectures 19 through 22, and all six completed the study. They took a morning test, used the replication and repair lessons, and took an evening test. We switched the test-form order for half the group. Both tests also covered transcription and translation, so each student had comparison topics they hadn't practiced in the app.

### 4 · Validation results | 1:00–1:40
At least five of six students completed each usability step unaided. To measure learning, we subtracted each student's gain on comparison topics from their gain on the two taught topics. Five students had a positive difference. The average was 8.33 percentage points, below our target of 15. We wanted three students to answer again voluntarily between sessions. Zero did. Two said they'd be very disappointed to lose the app; our target was three. One student, P03, described it as helpful for quick review.

### 5 · The pivot | 1:40–2:00
Students could use the app, but nobody answered another question during the return window. We're changing two things: students will try a question before seeing the explanation, and a short daily set will give them something specific to come back for. Here's how the current Alpha lesson works.

### 6 · One student, end to end | 2:00–2:40
Follow one decision through this lesson. When a student says ligase adds new DNA bases, what would help them answer differently next time? Replaying the whole lesson would make them sit through things they already know. Instead, their answer selects a clip about the job they’ve assigned to the wrong enzyme. Then they have to use that explanation on a new question. [Point to the final step.] We also want the student to be able to leave and come back to saved progress. That last step needs its own refresh check.

### 7 · Recorded phone demo | 2:40–4:30
[Before clicking.] Watch what happens after the first mistake, and again after the retry. I’ll point out the two choices. [Click the embedded phone video. The cues below count from the start of playback.]

- **0:00–0:09.** The student enters a code and starts DNA replication.
- **0:09–0:29.** [Let the clips play.] Look at the growing strand. The three-prime end is where the next nucleotide attaches. That's the exam question we opened with.
- **0:29–0:38.** Now watch the primer question. The student picks “Ligase uses it to add the new bases.” Ligase does join pieces of DNA, so it's an understandable mistake.
- **0:38–0:45.** The app shows why polymerase needs a primer, then asks a fresh question: which enzyme makes that primer?
- **0:45–0:52.** They choose DNA polymerase. The feedback names primase, and a second clip separates the two jobs. [Let the final question appear.]

[After playback.] The last question asks who adds DNA nucleotides *after* the primer is in place. This time, DNA polymerase is the right answer. The distinction is the lesson: primase makes the starting point; polymerase extends it. The recording ends at that question. Our remaining walkthrough is to finish the lesson, return home, refresh, and check that the saved status survives. [Advance to slide 8.]

### 8 · How the clip was made | 4:30–5:30
Look back at the second intro clip. The teaching goal in Lecture 19 was that new DNA grows five-prime to three-prime. An early version ended without saying that. A script check caught the missing idea. We put the direction into the closing line, adjusted the animation timing, and rendered the clip again.

Claude Code helped the team write narration, scenes and tests. ElevenLabs produced the voice and timing, and Remotion used that timing for the captions and animation. The follow-up you saw was an existing clip selected by the student's answer.

For Beta, we propose an authoring tool that gives a reviewer a lecture-linked draft question and explanation. The reviewer could catch an error like the missing growth direction before approving it for the app. That authoring tool is still proposed.

### 9 · One story, one issue | 5:30–5:50
We broke seven requirements into 23 user stories with 84 acceptance criteria. You just saw story eight, GitHub issue 16. Its acceptance criteria give us something specific to look for: the wrong choice selects the matching explanation, and a fresh question follows.

### 10 · QA at commit f9f2138 | 5:50–6:25
Sixteen of our 23 Alpha issues were closed. At the commit on screen, one Python run collected 88 tests. Eighty-five passed and three render tests were skipped. That gives us 3.83 Python tests per issue and 68 percent line coverage across the learning and video code. The 19 browser checks and 20 historical TDD scripts are separate. The gap that matters for this demo is playback: the browser checks substitute a clip, so we still need to test the actual files on the release build.

### 11 · The caption outline | 6:25–7:00
Here's why we review the tests an AI writes. The first caption test looked only at the light fill of the letters. The fill ended at pixel 999, just inside the limit of 1000. But students also see the dark outline. When the reviewer counted that outline in a rendered frame, the caption reached 1006 and the test failed. We centered the text in a shorter box. Two lines then ended at 957, and the revised test passed. The slide identifies the failing test commit and the later fix.

### 12 · Alpha status | 7:00–7:25
The recording shows phone playback for one replication lesson. Separately, all 35 expected files matched locally, while a check of those filenames on the deployed host returned 35 missing-file responses. We need to reconcile the release files and repeat the walkthrough on that exact build. Course-expert sign-off is also pending.

### 13 · Beta exit criteria | 7:25–7:55
Our next milestone is 35 out of 35 deployed assets matching, plus a successful walkthrough through refresh on both iOS and Android. Then we'll test question-first clips with at least six students and check recall at least two days later. We want an average gain of 15 percentage points over comparison topics, at least four positive gains out of six, and three of six students answering without reminders within a week.

### 14 · Questions | 7:55–8:00
Thank you. The repository is on screen. What would you like to see more closely?

## Q&A and rehearsal

- **Which dataset did you present?** The six-student export in member1 at f9f2138, identified by the team as the final participant dataset. Its recorded totals give +8.33 points and 0/6 qualifying returns. Earlier figures come from a different export. Subtracting one taught post-test point per student in a separate sensitivity analysis gives −1.67 points.
- **What counts as a return?** An answer from one hour after the morning session ended through one hour before the evening test. Opening the app alone didn’t qualify.
- **What can this study establish?** It describes six students over one day. The paper scores support the learning calculation. Retry routing for P02/P05 and 12 incomplete completion records still require reconciliation before drawing conclusions about those paths.
- **How much test writing was AI-assisted?** In the documented first cycle, AI drafted all four suites and humans reviewed all four. The log describes changes in at least two. We have no case-by-case percentage for the entire suite.
- **What does the video prove?** This phone session played intro and follow-up clips, handled two different wrong choices and displayed fresh questions. The final answer, completion and refresh fall beyond the recording.
- **Before presenting:** Each teammate rehearses all 14 slides with a timer. Open the downloaded PPTX in desktop PowerPoint, enter Slide Show, click the phone on slide 7, check audio, and rehearse the transition to slide 8. Keep the original movie available as a playback fallback.
