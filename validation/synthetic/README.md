# Six synthetic validation participants

All records are deterministic invented fixtures for practice, not data from real users. Study date 2026-11-04 and every response, timestamp, help observation, survey answer and behavior are simulated.

Combined exports use the exact Context CSV headers: [participant-results.csv](participant-results.csv), [test-responses.csv](test-responses.csv), [events.csv](events.csv). There are 6 participant rows, 168 paper answers, 349 events and 39 graded app attempts.

[Results](RESULTS.md), [metrics](metrics.json), [combined isolated database](clipcademy.db), [records](records.json) and [attempts](attempts.json).

Individual folders: [SIM_P01](SIM_P01/README.md), [SIM_P02](SIM_P02/README.md), [SIM_P03](SIM_P03/README.md), [SIM_P04](SIM_P04/README.md), [SIM_P05](SIM_P05/README.md), [SIM_P06](SIM_P06/README.md). Each contains the same export types, a separate database and assigned interview notes.

Odd-numbered participants take A then B; even-numbered take B then A. Morning appointments are 40 minutes apart; evening appointments start 8 hours later. Scoring follows the current assessment key/rubric. Synthetic choices are deterministic, not sampled from observed student behavior or tuned to make all hypotheses pass.

Actual local grading/event handlers generate the attempts and events. No browser watched clips and no server was contacted. Video durations come from current media manifests. The synthetic build is valid only in the isolated fixture configuration, not a released study build. Each database has a synthetic_metadata table, and every exported record has a SIM_ participant ID. Databases are locally present but ignored by Git's existing *.db rule.

Keep these files separate from actual study data. The Context templates, production database, real participant codes and source application code were not modified. Nothing was pushed.

Reproduce JSON, database and event outputs with `python3 validation/generate_synthetic_cohort.py`; moderator CSVs are materialized from records.json using the matching headers.
