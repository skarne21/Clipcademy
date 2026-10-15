# Readme-startup3.md: Whip expansion

## What YC verifies

[Y Combinator describes Whip](https://www.ycombinator.com/companies/whip) as a mobile app where people create and discover interactive mini apps and games, called "whips," including trivia, quizzes, polls, and party games. Users can build a whip in the app, publish it to a social feed, and remix, like, or comment on others' work. The company has since launched Whip Web, a browser feed of interactive experiences. The quality-checked build pipeline below is a **proposed expansion**, not a feature attributed to Whip.

## Proposed idea: Only publish whips that actually work

Add a build step between "describe an idea" and "post to the feed." A creator types a prompt such as "a 10-question trivia game about 2000s pop music for my group chat." The model generates the whip, the system tests it, and the creator only sees a version that loads, responds to input, and finishes correctly. The focus is a narrow set of formats at first (trivia, quizzes, polls, and simple party games) before expanding to open-ended apps.

### 1. Solves one problem extremely well

The focused problem is that AI-generated mini apps often break: buttons do nothing, scores don't add up, or the game never ends. A feed full of broken posts loses players fast. The product would do one thing consistently: turn a prompt into a playable whip that has been checked before anyone sees it.

### 2. Knows or can reach target customers

The target customers are people who make quick games for friends, group chats, clubs, or classrooms, plus the players who scroll the feed. **Direct customer access has not been established.** Interviews and small trials with student groups and casual creators would test which formats they make most and how often generated versions fail today.

### 3. Uses manageable infrastructure

The platform needs an LLM service, a sandboxed runtime that loads each whip in isolation, a headless browser test runner, storage for whip code and versions, a feed, and moderation tools. Each format needs a defined test, such as "every trivia question has exactly one correct answer and the final score matches the answers given." The plan does not assume access to Whip's code or existing infrastructure.

### 4. Meaningfully reimagines the experience

Today, building with AI usually means generate, try it, find the bug, and prompt again by hand. Here the creator never does the debugging. They describe what they want, and the system handles testing and fixing in the background. Remixing works the same way: a remixed whip is retested before it goes live.

### 5. Makes generative AI core to the solution

The model writes the whip itself: the questions, game logic, layout, and scoring. It also writes the revised version after a failed test. Without generation there is no product, since the creator never writes code. This is not a chat window beside the feed; the model produces the thing people play.

### 6. Validates every generated user-facing artifact

No generated whip reaches the creator or the feed before server-side validation. Common checks confirm that the code loads in the sandbox without errors, every interactive element responds, and the content passes a safety review. Format-specific checks apply on top: trivia answers must be internally consistent, polls must record and display votes correctly, and party games must reach an end state. If a format lacks a reliable test, generated whips in that format cannot be published.

### 7. Automatically corrects validation failures

The validator returns specific errors, such as a console error, a button that triggered nothing, or a score that didn't match, to the model, which revises the whip and submits it again. The process has a retry limit. If the whip still fails, the creator sees a short message and a suggested simpler version of their prompt. A failed whip is never shown or posted.

### 8. Can be fully deployed

A deployable version would include accounts, a prompt-to-whip builder, generation and testing services, a sandboxed player, a feed, version history, monitoring, and content removal controls. New formats could be added as their tests become ready. This is a deployment plan for the proposed expansion, not a claim that the product or its customer demand has already been established.
