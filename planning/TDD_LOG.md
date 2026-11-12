# Alpha Activity 3: AI-assisted test-driven development

**Commit metadata.** The TDD red, green and deferral commits on `member1` were re-dated from November 4, 2026, to October 29, 2026, at 09:00, 09:10 and 09:20 Eastern. The executable tests and production fixes are recorded in the commits below. Commit ancestry, earlier MVP development dates and GitHub activity timestamps are unchanged.

**Development sequence.** The Alpha features in the Activity 2 issues (#9–#31) were built during the MVP phase, with their tests
written alongside the code (see each issue's *Evidence / tests*). From commit `43e41bd` (original `296f7af`) on, work follows
strict test-first TDD: the test suite for an issue's open acceptance criteria is generated, reviewed, committed and
seen to fail **before** any production change, and the fix lands in a later commit. The git history shows that order.

**How the tests were made.** Claude (AI) generated each suite from the issue's acceptance criteria. A team member
then reviewed every generated test for correctness, completeness and edge cases before committing it. The review
notes below record what changed. Tests run with `python3 -m unittest discover -s video` (the layout test needs Node
and `npm ci` in `video/remotion`).

## Cycle 1: gaps found by auditing the acceptance criteria

The audit compared every acceptance criterion in #9–#31 with the existing tests and the rendered clips. Four
criteria were not met, even though the issues listed them as done:

| Issue | Criterion | Finding |
| --- | --- | --- |
| #24 US-16 | Intro clips end on the packet's teaching goal | The pilot `dna_replication.intro_2` never says "New DNA only grows from 5′ to 3′" |
| #21 US-13 | Narration runs at 150–170 words a minute | 18 of 35 clips are outside it (138–189 wpm) |
| #21 US-13 | API key read from `video/.env` | `export KEY=…` lines and inline `# comments` broke it |
| #14 US-06, #23 US-15 | Captions stay inside y 760–1000 | Two-line captions ran to y = 1006 |

### Red: member1 commit `43e41bd` (original `296f7af`)

| Test file | Issue | Result when committed |
| --- | --- | --- |
| `video/test_script_rules.py` | #24 | 1 failure: `intro_2` teaching goal missing from its last lines |
| `video/test_tts.py` | #21 | 2 failures: `export` prefix, inline comment kept in the key |
| `video/test_pace.py` | #21 | 18 failures: clips outside 150–170 wpm |
| `video/test_layout.py` | #14, #23 | 1 failure: caption reaches y = 1006 |

### Review of the AI-generated tests (inspect, refine, edge cases)

- **`test_layout.py` was wrong as generated.** It looked only for the caption's white/yellow fill, which ends at
  y = 999, so it **passed** a layout that breaks the band. Rendering a real frame and reading it showed that the
  12 px outline is part of the caption. The test now counts the outline and fails at y = 1006. Without this review
  the bug would have been certified as fixed.
- **`test_layout.py` checks pixels, not constants.** It renders real frames with Remotion, so it tests what a
  student sees. It covers a two-line chunk, a long single word near the side buttons, and the bottom-controls zone.
- **`test_tts.py` edge cases added in review:** quoted keys with spaces around `=`, Windows line endings, a
  commented-out old key above the real one, an empty value, no `.env` at all, and the environment variable taking
  priority over the file. Also checked: an HTTP 401 error message never contains the key, and changing text,
  voice *or* speed forces a new (billed) request while repeating one does not.
- **`test_script_rules.py` normalisation tested directly.** Written primes vs spoken "3-prime", curly apostrophes,
  and that 5′→3′ is not confused with 3′→5′ (a normaliser that dropped digits would pass the wrong direction).
- **`test_pace.py` checks the formula itself** (40 words in 15 s of speech is 160 wpm), so a mistake in the
  lead/tail subtraction can't make every clip pass.

### Green

| Issue | Fix | Tests |
| --- | --- | --- |
| #21 (key) | `tts.api_key()` skips comment lines, accepts `export`, takes quoted values whole and strips an unquoted inline `# comment` | `test_tts` passes (14) |
| #14, #23 | Captions sit in a flex box from y 772 to 988, centred, line height 1.0; two lines now span y 804–957 | `test_layout` passes (3) |
| #24 | `intro_2` now says "New DNA only grows from 5-prime to 3-prime." before the teaser; beats re-cued; clip re-rendered | `test_script_rules` passes (5) |
| #21 (pace) | **Deferred.** The pace test was removed after the green commit (see below) | none |

After the green commit: all video tests pass. All 35 clips were re-rendered (the caption fix changes every frame) and
pass `check_assets.py`; the learning tests and `check_content.py` pass. Re-rendering spent credits only on
`intro_2`'s new line; the rest of the narration was cached.

Green commit on this member1 branch: `c1bc62c` (original `e5e2b2f`).

## Deferred: narration pace (#21)

`video/test_pace.py` showed 18 of 35 clips (16 after the `intro_2` change) outside 150–170 words a minute, measured
138–189. The team chose to remove the test rather than change the audio now. notes.md asks for "about" 150–170 wpm,
and the fix (time-stretching the cached narration with FFmpeg `atempo`, or re-voicing for about 6,000 credits) is
deferred. Issue #21 keeps the criterion open and unticked, so the gap stays visible. The removal is its own commit.

---

# Beta: course platform and the wrong-answer loop

Every Beta story was built test-first. The failing tests were committed on their own (a "TDD red" commit), and the
code that makes them pass landed in a later commit ("TDD green"). Branches: `part-1-beta` (US-24 to US-35) and
`part-2-beta` (US-36 to US-49). Each issue's closing comment repeats its evidence.

**How each pair was checked.** For every row below, the story's tests were run in a clean git worktree at the red
commit (they must fail) and again at the green commit (they must pass). The numbers are from those runs, not from
the commit messages. Two tests are left out of the counts: `video/course/test_course_layout.py` renders frames
with Remotion and needs Node, and `test_isolation.py::…test_every_existing_clip_still_matches_its_rendered_file`
can't pass on a native Windows checkout (see US-38); it passes inside the Docker image.

## Red/green pairs

| Stories | Issues | Tests | Red commit | At red | Green commit | At green |
| --- | --- | --- | --- | --- | --- | --- |
| US-24–29 course import with Gemini | #64–#69 | `video/course/` | `6fedb5f` | 40 failed | `83f37b3` | 43 passed |
| US-30–35 course platform, one container | #70–#75 | `learning/test_courses.py`, `test_server.py` | `9b3ab83` | 32 failed | `34a6fb4` | 32 passed |
| US-36 Gemini default that still exists | #76 | `test_generate.py -k default_model` | `23677e6` | 1 failed | `d13a2ee` | 1 passed |
| US-37 quoted `.env` keys in Docker | #77 | `test_server.py -k Quotes` | `82b3a74` | 2 failed | `b55f132` | 2 passed |
| US-40 v1 and v2 follow-up clips | #80 | `test_generate.py -k FollowUps` | `cb6c861` | 4 failed | `03e9618` | 4 passed |
| US-41 misconceptions and retry questions | #81 | `test_questions.py -k Misconceptions` | `854f700` | 5 failed | `538306f` | 5 passed |
| US-45 objectives sharing a topic | #85 | `test_generate.py -k SharedTopic` | `50c1359` | 1 failed | `9c716c5` | 1 passed |
| US-44 no review step; teachers delete | #84 | `test_courses.py`, `test_templates.py`, `test_generate.py` | `a5ed34e` | 9 failed | `13af34e` | 11 passed |
| US-42 wrong answer → follow-up → retry | #82 | `learning/test_course_loop.py` | `6a41f39` | 10 failed | `ecf38ff` | 10 passed |
| US-42, US-43 class page loop and saved progress | #82, #83 | `web/e2e/class-loop.mjs` (browser) | `4c4ba8c` | failed (posted to the removed `/answers`) | `bfe2f95` | passed |
| US-46 parallel generation with progress | #86 | `test_generate.py`, `test_questions.py`, `test_courses.py` | `c0576d6` | 21 failed | `ea063ab` | all passed |
| US-47 topic breakdown for teachers | #87 | `test_generate.py`, `test_courses.py` | `b676516` | 3 failed | `8e0260d` | all passed |
| US-48 home page | #88 | `test_server.py`, `web/e2e/home.mjs` (browser) | `174d2d0` | both failed | `a09f4ac` | both passed |
| US-49 biology lessons as class BIO101 | #89 | `learning/test_biology_class.py` | `0a633de` | 4 failed (404) | `603d1c9` | 5 passed |

Stories checked another way:

- **US-38 (#78) LF line endings for fingerprinted files.** The red test already existed: `test_isolation.py`'s clip
  check failed for all 35 clips on a `core.autocrlf=true` checkout. The fix is `.gitattributes` (`4bc05d6`). Inside the
  Docker image built from that checkout all 35 clips match. On native Windows the check still fails because `sorted()`
  orders paths case-insensitively there; fixing that means editing `render.py`, which is itself fingerprinted.
- **US-39 (#79) running on localhost.** Verified by a live run, not a unit test: `docker run --env-file video/.env` on
  port 8080, teacher sign-in, a real course generated with Gemini, ElevenLabs and Remotion, and a student answering.

## What review of the tests changed

- **US-37 was redone.** The first green fix stripped quotes inside `video/tts.py`. That file is part of every biology
  clip's fingerprint, so the change would have marked all 35 reviewed clips as stale. Comparing fingerprints at each
  commit caught it. The red tests were rewritten (`82b3a74`) and the fix moved to a single `unquote_env()` in the
  server (`b55f132`); the first pair (`0dc0f14`, `446796f`) is superseded.
- **US-40 fixture caught a real limit.** The first follow-up fixture used `price_falls_with_demand_followup_2`, which
  the clip checks reject (variant IDs are at most 24 characters). Misconception IDs are now capped at 13 characters.
- **US-42's idempotency test was vacuous at first.** It compared two identical 404 responses, so it passed before
  the endpoint existed. It now also asserts a 200.
- **US-46's concurrency test was over-specified.** It required exactly 4 Gemini calls at once, but a v2 follow-up
  holds a worker while it waits for its v1, so 3 is also correct. It now asserts more than 1 and at most 4.
- **US-45 came from a live run.** The localhost run of osmosis notes put 7 clips under one objective and none under
  the other; the red test reproduced it with two objectives sharing a topic.

## Running the tests

```sh
python -m pytest learning video          # Python: learning service, course platform, video and course pipeline
cd web && npm run dev                    # then, in another terminal:
node e2e/class-loop.mjs                  # class page: wrong-answer loop and saved progress (API mocked)
node e2e/home.mjs                        # home page: class code and teacher sign-in (API mocked)
```

On native Windows, 5 tests that look up the 35 biology clips by fingerprint fail (`video/test_jobs.py` ×3,
`video/test_integration.py` ×1, `test_isolation.py` ×1) because of the path sort order described under US-38. They pass
in the Docker image.
