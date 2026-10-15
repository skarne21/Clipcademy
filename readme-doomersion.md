# readme-startup1.md — Doomersion expansion

## What YC verifies

[Y Combinator describes Doomersion](https://www.ycombinator.com/companies/doomersion) as a language learning app built around short videos matched to a learner’s level, with difficulty increasing as they scroll. The broader learning platform below is a **proposed expansion**, not a feature attributed to Doomersion.

## Proposed idea: A multi-topic feed that verifies learning

Expand the level-matched video feed to cover a growing catalog of subjects, including business, computer science, coding, and other topics. A learner chooses an interest, watches a short lesson, completes a brief task that applies it, and receives the next lesson based on the result. The catalog is intentionally open-ended; no fixed list of subjects is assumed.

### 1. Solves one problem extremely well

The focused problem is that watching educational short videos does not reliably show whether someone learned the material. Across every subject, the product would do one thing consistently: turn a short lesson into a small, checked demonstration of understanding.

### 2. Knows or can reach target customers

The target customers are people who already use short videos to learn practical subjects. **Direct customer access has not been established.** Interviews and small trials with learners across several topic areas would test which subjects fit this format and whether people value the practice step.

### 3. Uses manageable infrastructure

The common platform needs a permitted video catalog, topic and difficulty tags, learner progress records, an LLM service, validation services, and a web or mobile interface. Each subject also needs an appropriate way to check learner work—for example, isolated tests for code or a rubric for a business scenario. The plan does not assume access to Doomersion’s code or existing infrastructure.

### 4. Meaningfully reimagines the experience

The feed would adapt to what a learner can **do**, rather than what they watched. Someone who misses a concept would receive a different explanation and another practice task; someone who demonstrates understanding could progress. The same learning loop can operate across subjects while using checks suited to each one.

### 5. Makes generative AI core to the solution

The model would turn each approved lesson into a level-appropriate explanation, application task, hint, and follow-up lesson. It would tailor these to the learner’s prior answers and mistakes. Generative AI creates the adaptive lesson experience itself, rather than appearing as a generic chat window beside the feed.

### 6. Validates every generated user-facing artifact

No generated explanation, task, hint, feedback message, or lesson recommendation reaches a learner before server-side validation. Common checks cover structure, topic relevance, clarity, and consistency with the approved source lesson. Subject-specific checks apply where needed: generated code must parse and pass isolated tests; a business scenario must pass a defined factual and rubric review. If a topic lacks a reliable validator, its generated material cannot be published.

### 7. Automatically corrects validation failures

The validator returns specific errors to the model, which revises the artifact and submits it again. The process has a retry limit. If validation still fails, the system uses approved material or skips the item. Failed generated content is never shown to the learner.

### 8. Can be fully deployed

A deployable version would include accounts, a permitted multi-topic lesson catalog, generation and validation services, learner progress, monitoring, and content removal controls. Topics could be added as their lessons and validators become ready. This is a deployment plan for the proposed expansion, not a claim that the product or its customer demand has already been established.
