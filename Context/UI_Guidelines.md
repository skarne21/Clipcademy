# UI guidelines: a mobile UI that doesn't look generated

Owner: Member 3 · Applies to everything in `web/` · Companion to [Member3_SPEC.md](Member3_SPEC.md)

Study participants will mostly use Clipcademy on their phones, so these rules assume a phone first. Read the sources section for how strong each claim is. Most "AI slop" guidance is practitioner opinion, not research.

## What makes a UI look generated

Generated interfaces drift toward the statistical average of what models have seen. The result is recognizable at a glance. Avoid all of these:

| Tell | Instead |
| --- | --- |
| Purple-to-blue gradients, cyan on dark, neon glow | One accent colour chosen for this app, flat surfaces |
| Gradient text, glow halos behind content | Solid text. Emphasis comes from size and weight |
| Glassmorphism (blur cards) used as decoration | Plain surfaces. Layering only for a real overlay |
| Rows of identical cards: icon tile, heading, one line of text, a number | A list, grouped by meaning, with spacing doing the grouping |
| Cards inside cards, or a card with both a hairline border and a wide shadow | Flat layout with dividers. One edge treatment if any |
| Thick coloured stripe down one side of a card | Only where it actually signals a status |
| Huge corner radius on everything | A small radius, one per nesting level |
| Small label or pill badge above every heading | Just the heading |
| Equal spacing everywhere | Related items close, groups further apart |
| Pulsing dots, bouncy or elastic easing | Things stay still unless something real changed. Short, settled motion |
| Emoji as icons | One icon set, or text |
| Hype copy ("supercharge your learning"), em dashes in every sentence | Plain sentences that say what happens next |
| Placeholder names and invented numbers | Real content only. The app has no stats it didn't measure |
| Only the happy path designed | Loading, empty, error and full states for every screen that loads data |

The one-line test: **would this screen look the same in any other app?** If yes, it's a template. Each screen should be shaped by what Clipcademy actually does: a clip, a question, an answer, an explanation.

## Principles for this app

**1. Content leads, chrome stays quiet.** The video and the question are the product. No dashboard, no stat tiles, no hero banner. The home page is a short list of objectives with their status in words ("In progress, question 2 of 2"), not a grid of progress cards.

**2. One accent colour.** It marks the primary action and the current state, nothing else. Correct and incorrect use their own colours, always paired with words and an icon, never colour alone.

**3. Type does the hierarchy.** Use the system font stack (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`). It's familiar, costs no download on the free host's limited bandwidth, and app screens are allowed a familiar face. Use a fixed scale of about 1.2, with clear size and weight steps between the prompt, choices, and helper text. Body text is at least 16px. Never use letter-spaced capitals for labels.

**4. Thumbs reach the bottom.** Most phone use is one-handed (Hoober's field study), and the bottom of the screen is easiest to reach. Put each screen's one primary action (Submit, Continue, Watch explanation) in a full-width bar fixed to the bottom, inside the safe area. Back stays at the top left, where it's expected.

**5. Every tap gets a response.** Any tap target is at least 44×44 px (48 px is better). Pressed buttons show it instantly, and a submitting button shows progress inside itself without changing width.

**6. Design the unhappy paths first.** Every screen that loads data has four states: a skeleton shaped like the content, empty (what belongs here and one action), error (what broke and what to do), and full.

## Screen by screen

### Participant code
- One field with a visible label above it ("Participant code"), never a placeholder as the label. The placeholder shows the format (`P01`).
- `autocapitalize="characters"`, `autocomplete="off"`, `spellcheck="false"`, and 16px text so iOS doesn't zoom in.
- The Continue button stays enabled. An empty submit shows an error under the field and focuses it.

### Exam topics
- A list of four rows, not four decorated cards. Each row is the topic label plus its state in words. "Coming soon" rows are visibly quieter and say so in text.
- Selecting is a native checkbox styled with `accent-color`, and the whole row is the tap target.
- Never imply the app knows the exam's coverage. The heading asks ("Which topics are on your exam?").

### Review home
- Objectives grouped under their topic, each with a one-line status and one action (Start, Resume, Restart).
- **Empty state** (nothing selected): one line saying what's missing, and a button back to the topic picker.
- The participant code sits small at the bottom for the moderator.

### Lesson (video)
- `<video controls playsinline>`, so iOS doesn't force full screen and the question button stays reachable. Width 100%, height set by the video's aspect ratio, so nothing jumps when it loads.
- Transcript below the video, readable at body size, not a scroll box inside a scroll box.
- **Preparing:** a still block the shape of the video with the words "Preparing your explanation…". No fake progress bar.
- **Failed:** what happened in one sentence ("The clip couldn't load.") and a Retry button. The student's answer is safe, so say so if it's the follow-up clip.
- The "Answer the question" button is in the bottom bar from the start. Watching the whole clip isn't required.

### Question
- Choices are full-width rows (at least 48 px tall), each with its letter and text. Tapping anywhere on the row selects it, and the selected row is marked with a border and a check, not colour alone.
- Nothing hints at the answer before Submit. This is the active-recall rule.
- Submit in the bottom bar: disabled until a choice is picked, then shows progress inside the button while the request is in flight.

### Feedback
- Lead with the result in words: "Correct" or "Not quite", with an icon and colour as support.
- Show the student's choice, labelled "Your answer", so they don't have to remember what they picked. Don't cover it with a sheet.
- Then the feedback text from the server, at body size. It explains why, which is the gap reviewers point out in apps that only show the right answer.
- Don't reveal the correct choice for a wrong answer. The server doesn't send it, and the retry question is where the student recalls it.
- One primary action in the bottom bar, named for what comes next: "Next question", "Watch explanation", or "See summary".

### Summary
- `complete`: the objective's name and "Complete", plus Return home. No confetti, no trophy.
- `needs_review`: the feedback, then the review points as a short list under "Go over these", plus Restart and Return home. Calm wording: this is a normal outcome, not a failure.

## Motion

- Animate only `transform` and `opacity`, 150 to 250 ms, ease-out. Never `transition: all`.
- Screen changes can fade or slide a short distance. Nothing bounces.
- Every animation has a `prefers-reduced-motion: reduce` fallback that removes it.
- Nothing moves on its own when nothing has changed.

## Layout mechanics

- `width: 100%`, never `100vw`, and `overflow-x: clip` on `html` and `body`.
- `100dvh` for full-height screens, never `100vh` (the browser bar on phones breaks it).
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, with side margins of `max(16px, env(safe-area-inset-left))`, and the bottom bar padded by `env(safe-area-inset-bottom)`.
- Breakpoints in `rem`, not `px`. The app is a single column up to about 40rem, then centres in a column of about 36rem on wider screens. No desktop layout is needed.
- Hover effects only inside `@media (hover: hover)`. Nothing depends on hover.
- All colours and fonts are CSS variables on `:root`, so a dark mode is one block of overrides if it's ever needed.

## Accessibility floor

These aren't style choices. Never ship without them:
- Text contrast at least 4.5:1 (3:1 for large text and for field and control edges).
- A visible `:focus-visible` ring on every interactive element.
- Correct and incorrect never shown by colour alone.
- A real `<label>` on every field, `type="button"` or `type="submit"` on every button, and `lang="en"` on the page.
- Errors tied to their field with `aria-describedby` and `aria-invalid`.
- Layout survives the phone's largest text size without clipping. Sizes are in `rem`, so they follow the user's setting.

## Before shipping a screen

- [ ] Does it look like it could only be Clipcademy (the one-line test)?
- [ ] Loading, empty, error and full states all designed?
- [ ] Primary action in the bottom bar, reachable with one thumb?
- [ ] Every tap target at least 44 px?
- [ ] No feedback visible before Submit?
- [ ] Works at 320 px wide with the largest text setting, and with reduced motion on?
- [ ] None of the tells in the first table?

## Sources

How much to trust each one:

- **Practitioner catalogs of AI-generated UI tells** (opinion, but consistent across sources): [Impeccable, "The visible tells of AI design"](https://impeccable.style/slop), [Hallmark](https://github.com/Nutlope/hallmark) (its responsive, interaction-and-states and app-screen references), [Superdesign: why AI design looks generic](https://www.superdesign.dev/blog/why-ai-design-looks-generic), [Laith0003 ux-skill wiki](https://github.com/Laith0003/ux-skill/wiki/How-to-detect-AI-slop-in-your-design), [Noqta: overused AI UI patterns](https://noqta.tn/blog/ai-design-slop-overused-ui-patterns-fix-2026).
- **Thumb reach** (field research, figures reported second-hand): [Smashing Magazine, "The Thumb Zone"](https://smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users) on Hoober's grip study. A [PolyU paper](https://ira.lib.polyu.edu.hk/bitstream/10397/116791/1/Lee_Perceived_User_Reachability.pdf) notes reach alone doesn't fully predict what users prefer.
- **Tap target size:** Apple's 44 pt and Material's 48 dp minimums, as reported by [Deque](https://dequeuniversity.com/rules/attest-ios/1.0/touch-target-size). Check against Apple's HIG before quoting exact wording.
- **Quiz feedback** (one peer-reviewed study plus product teardowns): [Effects of feedback types in mobile quiz apps (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8200521/), [Duolingo interaction teardown](https://bootcamp.uxdesign.cc/language-learning-with-duolingo-the-interaction-and-instruction-ed5ac0029332), [Duolingo's "Explain My Answer"](https://gamesbeat.com/?p=313445).
- **Empty and error states** (secondary write-ups citing NN/g): [Setproduct: empty state UI](https://www.setproduct.com/blog/empty-state-ui-design), [WFP: how to write UX copy](https://bridge.designsystem.wfp.org/how-tos/how-to-write-ux-copy).
- The examples named in the AI overview the team was given (Notion Calendar, Headspace, Airbnb) are useful to look at, but that overview gave no sources, so they aren't cited as evidence here.
