# Validation participant records

Participant data confirmed by the project owner; restored in commit 967acb0165e98799493e80c7d0a096a9b2f0c83a.

This dataset was supplied and confirmed by the project owner. Responses, scores, timestamps and attempt results are preserved from the restoration in commit `967acb0`. No new participant observations have been added.

Participant folders and IDs use `user_P01` through `user_P06`. The build label is `VALIDATION_STUDY`; scorer labels are `ANSWER_KEY` and `ASSESSMENT_RUBRIC`. These labels are normalized consistently across the exports. Event, session and attempt UUIDs are unchanged. The labels do not certify a released app build or identify a human scorer. The import does not independently verify the collection method or the underlying observations.

## Files

- [Participant results](participant-results.csv): 6 participant rows.
- [Test responses](test-responses.csv): 168 responses.
- [Events](events.csv): 349 events.
- [Attempts](attempts.json): 39 graded app attempts.
- [Records](records.json): participant details, responses and session intervals.
- [Metrics](metrics.json) and [results](RESULTS.md): calculations from these records.

Recalculate the cohort and individual user reports with `python3 validation/summarize_study.py`. It reads the combined exports, checks response scores against participant totals, and writes only `metrics.json` and `RESULTS.md` reports. It preserves the recorded responses, timestamps and app attempts.

[score-adjustments.csv](score-adjustments.csv) documents the user-requested one-point reduction to each user's taught-topic post-test total. Reports label this as a score-adjusted analysis and show both recorded and adjusted totals. The original item-level responses and participant totals remain unchanged. The one-point adjustment is applied to the taught-topic total without assigning it to an individual answer or the written-response subtotal. Removing the adjustment rows restores the calculations from the original scores.

Participant folders: [user_P01](user_P01/README.md), [user_P02](user_P02/README.md), [user_P03](user_P03/README.md), [user_P04](user_P04/README.md), [user_P05](user_P05/README.md), [user_P06](user_P06/README.md).

The export columns match the templates in `Context/`. Odd-numbered participants use forms A then B; even-numbered participants use B then A. The study date recorded in the source is November 4, 2026.

Local database files are excluded from this export. No new events were sent to the app or its database.
