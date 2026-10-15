# Readme-startup5.md: Generative AI at the core of the Doomersion expansion

## What YC verifies

[Y Combinator describes Doomersion](https://www.ycombinator.com/companies/doomersion) as a language learning app built around short videos matched to a learner's level, with difficulty increasing as they scroll. The multi-topic learning feed and the generation system below are a **proposed expansion**, not features attributed to Doomersion.

## Proposed idea: The model builds each lesson around the learner

This document expands on one part of the multi-topic feed plan: making generative AI the core of the product. A learner watches a short, approved video lesson. The model then writes the rest of that lesson for this specific learner: an explanation pitched at their level, a task that asks them to apply the idea, a hint if they get stuck, and a choice of what they should see next. Each of these is based on the learner's earlier answers and mistakes.

The model is not a chat window beside the feed. If it were removed, there would be no explanations, no practice tasks, and no adaptive path, only a list of videos.

## What the model generates

For every approved lesson, the model produces four artifacts.

| Artifact | What it is |
| --- | --- |
| Explanation | A short written breakdown of the video's main idea at the learner's level |
| Application task | One small exercise that requires using the idea, not repeating it |
| Hint | A nudge toward the answer that does not give it away |
| Follow-up lesson | The next lesson to show, with a one-line reason for the choice |

**Explanation.** The same video on Python loops would get a different explanation for a beginner ("a loop repeats the same steps for each item in a list") than for someone who already knows the basics ("this is the same pattern as `map`, but with side effects"). If the learner's history shows a specific misunderstanding, the explanation addresses it directly.

**Application task.** The task asks the learner to use the concept in a new situation. For coding, this could be a short function to write. For business, it could be a two-sentence decision on a small scenario. Each task comes with an answer key or rubric that the system uses to grade it.

**Hint.** Hints are written for the mistake the learner actually made. A learner whose loop runs one time too many gets a hint about the range limit, not a generic "review the video."

**Follow-up lesson.** The model picks the next lesson from the approved catalog. A learner who struggled gets a different explanation of the same idea or a simpler prerequisite. A learner who succeeded moves to a harder or related lesson. The model can only choose lessons that already exist in the catalog; it cannot invent new videos.

## What the model is given

Each generation request includes:

- **The approved source lesson:** its transcript, topic tags, difficulty level, and the learning goal written by whoever approved it.
- **The learner's level** for that topic, estimated from their past results.
- **The learner's recent history:** their last few answers, which ones were wrong, and the type of mistake (for example, "off-by-one error" or "confused revenue with profit").
- **The subject's rules:** the required output format, tone, length limits, and how tasks in that subject are graded.

The model never receives open-ended instructions such as "teach the user anything." It always works from one approved lesson toward one stated learning goal.

## How a lesson plays out

1. The learner watches an approved video.
2. The system sends the lesson and the learner's history to the model, which returns an explanation and an application task.
3. Both are validated on the server (see below). Only material that passes is shown.
4. The learner submits an answer, which is graded against the task's answer key, rubric, or tests.
5. If the answer is wrong, the model writes a hint based on that specific mistake, and the learner can try again.
6. The result is saved to the learner's history, and the model picks the follow-up lesson.
7. The next lesson uses this updated history, so the feed reflects what the learner can do, not just what they watched.

## How the model is built into the product

The model sits inside a generation service, not in the user interface. The service works in four steps.

**Structured output.** The model returns a fixed format instead of free text, so every part can be checked. A response for one lesson looks like this:

```json
{
  "lesson_id": "py-loops-03",
  "learner_level": "beginner",
  "explanation": "A for loop runs the same steps once for each item...",
  "task": {
    "prompt": "Write a function that returns the sum of the even numbers in a list.",
    "type": "code",
    "tests": ["assert sum_evens([1, 2, 3, 4]) == 6", "assert sum_evens([]) == 0"]
  },
  "hint_targets": ["off_by_one", "missing_return"],
  "follow_up": { "lesson_id": "py-loops-04", "reason": "Learner passed; next lesson adds nested loops." }
}
```

**Validation.** Nothing generated reaches the learner before server-side checks. All subjects get the same basic checks: the output matches the required format, stays on the lesson's topic, fits the length limits, and does not contradict the source transcript. Each subject then adds its own checks. Generated code must run and pass its own tests in an isolated sandbox. Business scenarios must pass a defined factual and rubric review. Follow-up lessons must exist in the catalog and match the learner's level. If a subject has no reliable validator, the model's material for that subject is not published.

**Correction.** When a check fails, the validator sends the specific error back to the model, for example "test 2 fails on an empty list" or "explanation mentions a function not covered in the lesson." The model revises and resubmits. There is a retry limit. If the material still fails, the system shows pre-approved material for that lesson or skips the item. Failed output is never shown.

**Evaluation before launch.** Each subject gets a set of sample learners with known histories and mistakes. Prompts and model versions are tested against this set before release, and are measured on how often validation passes on the first try, how relevant the hints are to the mistake, and whether learners who receive follow-up lessons improve on later tasks.

## Why this is not a sidebar chatbot

A sidebar chatbot waits for the learner to ask a question, and the learner has to know what to ask. In this product, the model acts on its own after every lesson. It decides how to explain the idea, what to practice, how to help after a mistake, and what comes next. The learner never types a prompt. Every output is tied to one approved lesson, graded against a known answer, and checked before it is shown.

## Open questions

- **Cost and speed.** Generating material for every learner after every video may be expensive or slow. Explanations and tasks could be generated ahead of time for each level, with only hints and follow-up choices generated live.
- **Validator coverage.** Code is straightforward to test automatically. Subjects such as writing or strategy need rubrics that are reliable enough to trust without a human reviewing each item.
- **Learner trust.** Interviews and small trials would test whether learners find generated tasks and hints useful, and whether practice keeps them in the feed or pushes them away. **Direct customer access has not been established.**

This describes how generative AI would work inside the proposed expansion. It is not a claim that the product, its results, or its customer demand have already been established.
