# Alpha Activity 3: AI-assisted test-driven development

**Commit-date exercise.** The TDD red, green and deferral commits are assigned October 29, 2026, at 09:00, 09:10 and 09:20 Eastern. In this simulated timeline they precede the GitHub-issue planning at 10:00 and the MVP hypothesis and validation work. The original recorded dates were November 4, 2026; the earlier MVP development and GitHub activity dates are not changed.

**Original timeline.** The Alpha features in the Activity 2 issues (#9–#31) were built during the MVP phase, with their tests
written alongside the code (see each issue's *Evidence / tests*). From commit `296f7af` (2026-11-04) on, work follows
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

### Red: commit `296f7af`

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
| #21 (pace) | **Open.** Needs per-clip voice speed and re-voicing the remaining clips (about 6,000 ElevenLabs credits) | `test_pace` still red: 16 clips (the new `intro_2` line moved one into range) |

After the green commit: 39 video tests run, and the only failures are the 16 `test_pace` cases. All 35 clips were
re-rendered (the caption fix changes every frame) and pass `check_assets.py`; the learning tests and
`check_content.py` pass. Re-rendering spent credits only on `intro_2`'s new line; the rest of the narration was cached.

Green commit: see the commit after `296f7af` in `git log`.

## Still red, on purpose

`test_pace.py` stays failing until the team decides to spend the credits, or changes the criterion. Some slow clips
can't reach 150 wpm because ElevenLabs caps `speed` at 1.2, so the narration of those scripts would also need
trimming. The issue #21 acceptance criterion "Narration runs at 150–170 words a minute" was wrongly ticked as done
in Activity 2 and is corrected there.
