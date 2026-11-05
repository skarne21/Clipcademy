# Moderator script and interview guide

Read the scripts word for word so every participant hears the same thing.

## Morning, after the pre-test

"This is ClipCademy, a review app for the DNA replication and DNA repair material from class. Enter your participant code. Open DNA replication, watch each clip, and answer its questions until you reach the summary. Then do the same for DNA repair. Nothing here affects your grade."

Record every step where you helped in `help_steps`: `open_lesson`, `clips`, `answer`, `return_home`, and `followup` if they needed help with a follow-up clip. Explain a button only if the participant can't continue. Record abandoned steps and technical failures.

Don't prompt a wrong answer. A follow-up clip plays only if the participant answers wrong on their own.

When both summaries are reached, say:

"That's it for this morning. The app stays open for you today. Later, you can tap Restart on a lesson, swipe past the clips, and see what you remember. Using it is up to you. We won't send reminders."

Record the session end time as `am_end`.

## Evening, before the post-test

Record the session start time as `pm_start`. For each topic (DNA replication, DNA repair, transcription, translation), ask:

"Since this morning, did you study [topic] outside the app? What did you use?"

Record yes or no in `ext_rep`, `ext_dr`, `ext_tx`, `ext_tl`, and the details in `ext_notes`.

## Evening, after the post-test

Ask the open questions first.

1. Walk me through the last time you opened the app today. What made you open it?
2. When you answered, did you remember it or work it out from the choices?
3. What did the follow-up clip change, if anything?
4. How does this compare with how you'd normally study?
5. What almost stopped you, or did stop you, from using it?
6. If it covered every lecture, when exactly would you use it?

Then ask:

"How would you feel if you could no longer use ClipCademy? Very disappointed, somewhat disappointed, or not disappointed?"

Record the answer in `disappointed` as `very`, `somewhat` or `not`.

Finally:

"We're opening ClipCademy for the rest of the semester with all four lectures. If you'd like access, you can add your name to this sheet."

Keep the sign-up sheet separate from everything that carries a participant code. Stated answers and sign-ups supplement the logged activity. They don't count as actual use.
