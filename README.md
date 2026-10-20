# Clipcademy MVP

Short-video Python learning feed with server-side lesson generation (Phase 2).

## Prerequisites

- Node.js 20+
- Docker (Postgres; Python sandbox in Phase 3+)

## Setup

1. **Environment**

   ```bash
   cp .env.example .env
   ```

   Set `DATABASE_URL`, and for generation either `OPENAI_API_KEY` or `LLM_PROVIDER=mock`.

2. **Postgres**

   ```bash
   docker compose up -d postgres
   ```

3. **Install and database**

   ```bash
   npm install
   npm run db:push
   npm run db:seed
   ```

4. **Run the app**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). After a video ends or you tap **I watched it**, the app calls `POST /api/generate` and shows a loading state, then explanation + practice task.

## Phase 2: generation

| Piece | Location |
|--------|-----------|
| LLM providers | `src/lib/llm/` (`openai`, `mock`) |
| Zod schema | `src/lib/schemas/lesson-output.ts` |
| Prompts | `src/lib/prompts/v1/` |
| Context builder | `src/lib/generation/build-context.ts` (4 inputs only) |
| API | `POST /api/generate` `{ "lessonId": "..." }` |

**`DEV_SKIP_VALIDATION`**

- `false` (default): Normal mode — generate, **validate** (sandbox + judge), up to `GENERATION_MAX_RETRIES` revisions, then approved fallback. Successful rows log `outcome=validated`.
- `true`: **Dev only** — skips the validator and logs `outcome=unvalidated`. The app **refuses to start** when `NODE_ENV=production` and this flag is `true`.

The client never receives hidden tests or a reference solution.

**Mock provider (tests / no API cost)**

```bash
LLM_PROVIDER=mock DEV_SKIP_VALIDATION=true npm run dev
```

**OpenAI**

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_GENERATION_MODEL=gpt-4o-mini
OPENAI_JUDGE_MODEL=gpt-4o-mini   # Phase 3+ judge/classifier
OPENAI_GENERATION_MAX_TOKENS=2048
LLM_TIMEOUT_MS=60000
DEV_SKIP_VALIDATION=true
```

Structured outputs use OpenAI strict JSON schema derived from the Zod schema via `zodResponseFormat`.

## Tests

```bash
npm test
```

Vitest covers the Zod schema and prompt builder; structured generation uses the mock provider.

## Phase 2 verification

Automated checks (no leaks, `GenerationLog` fields, invalid-key fallback, fallback mode, `unvalidated` outcomes):

**Terminal 1 — dev server** (must match the provider you are verifying):

```bash
# Mock (no API cost)
LLM_PROVIDER=mock DEV_SKIP_VALIDATION=true npm run dev
```

**Terminal 2 — verifier** (same `DATABASE_URL` as the app; optional `VERIFY_BASE_URL` default `http://localhost:3000`):

```bash
LLM_PROVIDER=mock npm run verify:phase2
```

**OpenAI** (uses real API calls for HTTP checks; invalid-key test calls OpenAI once with a bogus key):

```bash
# Terminal 1
LLM_PROVIDER=openai DEV_SKIP_VALIDATION=true npm run dev

# Terminal 2
LLM_PROVIDER=openai npm run verify:phase2
```

Exit code `0` means all checks passed. Direct-service checks (fallback mode, invalid API key) run inside the script; HTTP checks use the running dev server.

## YouTube Data API (catalog maintenance)

1. Enable **YouTube Data API v3** in Google Cloud Console and create an API key.
2. Set `YOUTUBE_API_KEY` in `.env` (server-side only).

```bash
npm run find-videos          # fix embeddable IDs in data/lessons.seed.json
npm run generate-lesson-notes
npm run check-videos
npm run db:seed
```

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run test` | Vitest unit tests |
| `npm run db:push` | Apply Prisma schema |
| `npm run db:seed` | Load `data/lessons.seed.json` |
| `npm run find-videos` | Refresh embeddable YouTube IDs in seed |
| `npm run check-videos` | Verify seed/DB video IDs |
| `npm run generate-lesson-notes` | LLM lesson notes for seed file |
| `npm run verify:phase2` | HTTP/DB checks for Phase 2 |
| `npm run verify:phase3` | Validator + sandbox checks |
| `npm run report:generations` | Summarize `GenerationLog` (optional `--since <minutes>`, `--lesson <id>`) |

## Python sandbox (Phase 3)

Build the image (no network, 256MB RAM, 0.5 CPU — used by `lib/sandbox.ts` via `docker run`):

```bash
docker compose --profile sandbox build python-sandbox
```

Optional env: `SANDBOX_DOCKER_IMAGE`, `SANDBOX_TIMEOUT_SECONDS` (default 5).

## Phase 3 verification

Requires the sandbox image built and Docker running:

```bash
LLM_PROVIDER=mock npm run verify:phase3
```

Unit tests (validator, correction loop, sandbox parsing):

```bash
npm test
```

With validation enabled, run the app with `DEV_SKIP_VALIDATION=false` (default) and `LLM_PROVIDER=mock` or OpenAI.

## Catalog data

Lessons live in `data/lessons.seed.json` with `lessonNotes`, fallback explanation/task (`visible_tests` / `hidden_tests`), and optional `videoAlternates`. Public API/UI never expose lesson notes, hidden tests, or fallback payloads in full.
