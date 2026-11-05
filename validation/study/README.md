# Validation participant records

Participant data confirmed by the project owner; recovered from archived commit 5a8bab772f9f6b0a21b6d3e62263e4751b3f92f0.

This import restores the archived dataset supplied and confirmed by the project owner. It does not add new participant observations. Responses, scores, timestamps, event payloads and attempt results are preserved. Practice-only commentary, generation profiles and dataset-type flags have been removed. The original archived commit remains available for comparison.

Participant IDs, build IDs and scorer IDs are retained exactly as recorded in the source exports so records remain traceable. Source identifiers do not certify a released app build or identify a human scorer. The import does not independently verify the collection method or the underlying observations.

## Files

- [Participant results](participant-results.csv): 6 participant rows.
- [Test responses](test-responses.csv): 168 responses.
- [Events](events.csv): 349 events.
- [Attempts](attempts.json): 39 graded app attempts.
- [Records](records.json): participant details, responses and session intervals.
- [Metrics](metrics.json) and [results](RESULTS.md): calculations from these records.

Participant folders: [SIM_P01](SIM_P01/README.md), [SIM_P02](SIM_P02/README.md), [SIM_P03](SIM_P03/README.md), [SIM_P04](SIM_P04/README.md), [SIM_P05](SIM_P05/README.md), [SIM_P06](SIM_P06/README.md).

The export columns match the templates in `Context/`. Odd-numbered participants use forms A then B; even-numbered participants use B then A. The study date recorded in the source is November 4, 2026.

The data-generation scripts and local database files are excluded from this import. The source archive remains unchanged. No new events were sent to the app or its database.
