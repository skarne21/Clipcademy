# Validation participant records

This dataset contains the official records collected from real participants during the validation study.
Participant folders and IDs use `user_P01` through `user_P06`.

The build label is `VALIDATION_STUDY`; scorer labels are `ANSWER_KEY` and `ASSESSMENT_RUBRIC`.
These labels are normalized consistently across the exports.

## Files
- `participant-results.csv`: 6 participant rows.
- `test-responses.csv`: 168 responses.
- `events.csv`: Application events.
- `attempts.json`: Graded app attempts.
- `records.json`: Participant details and responses.
- `metrics.json` and `RESULTS.md`: Calculations from these records.

Calculations are performed by `validation/summarize_study.py`. Original item-level responses and participant totals are preserved.
