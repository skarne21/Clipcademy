# Fixtures (sample contract data)

These files are **sample responses** copied from the shared API contract. They are **not** real lesson content.

Question prompts, choices, and attempt feedback are owned by **Member 2** (`learning/`). They will be replaced when the real service is wired up.

## Open contract gaps

- **`key_points`** on `AttemptResult` when `action` is `needs_review` — pending Member 2 confirmation (needed for needs_review summary UI).
- **`ActivityEvent` / events.csv** — column list pending Member 2 confirmation.
- **Video job metadata** — whether clips are pre-rendered assets vs live-generated is not yet specified on `VideoJob`; confirm with Member 1 (`video/`).
