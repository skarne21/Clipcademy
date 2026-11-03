# Content review handoff

Prepared 2026-11-03. All six clips remain pending approval. Automated checks do not replace subject review.

## Review each clip

Watch the full clip with sound, check captions against narration, inspect strand labels and arrows, check that each animated action (enzyme movement, nucleotides joining, damage, removal, close-ups, summary cards) shows what the narration says at that moment, and compare every claim with the referenced lecture pages. Record errors before approving.

| Clip | Sources | Fingerprint for approved_version |
| --- | --- | --- |
| [dna_repair.initial.fcb13ad482f59a6a.mp4](media/dna_repair.initial.fcb13ad482f59a6a.mp4) | L20-p1 | `fcb13ad482f59a6a` |
| [dna_repair.timing_followup.5a118265db053f5c.mp4](media/dna_repair.timing_followup.5a118265db053f5c.mp4) | L20-p1 | `5a118265db053f5c` |
| [dna_repair.uv_followup.a9daddba3a8d81c3.mp4](media/dna_repair.uv_followup.a9daddba3a8d81c3.mp4) | L20-p1 | `a9daddba3a8d81c3` |
| [dna_replication.direction_followup.46a6be086f8c0984.mp4](media/dna_replication.direction_followup.46a6be086f8c0984.mp4) | L19-p1 | `46a6be086f8c0984` |
| [dna_replication.initial.598cb64186cab048.mp4](media/dna_replication.initial.598cb64186cab048.mp4) | L19-p1, L19-p2 | `598cb64186cab048` |
| [dna_replication.primer_followup.a083709236ac88c8.mp4](media/dna_replication.primer_followup.a083709236ac88c8.mp4) | L19-p1, L19-p2 | `a083709236ac88c8` |

The replication initial clip now has four scenes, including the separate direction-and-primer recap. Its transcript and captions were regenerated with the video.

## Record the human decision

1. The course-knowledgeable reviewer checks the clips, lesson packets, questions and feedback against Lectures 19 and 20. Leave the flagged ambiguous passages excluded.
2. Record reviewer identity, findings, review status and approved version in [content-audit.csv](../Context/content-audit.csv). Each clip approved_version must equal the fingerprint above. Do not approve an item with an unresolved correction.
3. Mark a lesson packet reviewed only after its human review is complete. DNA repair remains Coming soon until its release requirements are satisfied.
4. Run `python3 learning/check_content.py --freeze`. Resolve every reported missing approval before participant release.
5. Deploy only approved assets without the preview flag, then test the complete flow on an actual phone. Record device, browser, date and result.

## Phone and hosted checks still needed

- Playback with audible narration, seeking and caption timing on the deployed URL.
- Wrong answer → targeted explanation → fresh retry → completion.
- Refresh and resume; failed video retry without losing the answer.
- Events exported with the correct participant code and frozen build ID.

Local Chrome mobile emulation is useful evidence, but is not an actual-phone or hosted verification.
