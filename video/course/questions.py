"""Practice questions for an imported course (US-32): Gemini writes them, these checks keep them honest.

Each objective gets up to two multiple-choice questions written only from its verbatim source
excerpts. A question that fails the checks goes back to Gemini once with the exact errors; if it
still fails it is skipped. Every question is saved pending review, like the clips.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import gemini  # noqa: E402

LETTERS = 'ABCD'
PROMPT_MAX, CHOICE_MAX, FEEDBACK_MAX = 160, 80, 200

SYSTEM = """You write practice questions for ClipCademy. Students answer from memory after short video clips.
Use only the excerpts you are given: never add outside knowledge."""

TASK = """Objective: {label} ({objective_id}).
EXCERPTS (your only facts):
{excerpts}

Write {count} multiple-choice questions that check this objective.
- prompt: one clear question, under {prompt_max} characters.
- choices: 2–4 choices with choice_id "A", "B", "C", "D" in order, each under {choice_max} characters.
  Wrong choices should be mistakes a student could really make. Exactly one choice is correct, and it
  must not be the longest choice in every question.
- correct_choice_id: the right choice's id.
- feedback: one or two sentences for EVERY choice (keyed by choice_id) explaining why it is right or wrong,
  under {feedback_max} characters each. Start the correct one with "Correct."
- source_refs: the refs of the excerpts the question is based on.

Return JSON: {{"questions": [{{"prompt": "...", "choices": [{{"choice_id": "A", "text": "..."}}],
"correct_choice_id": "A", "feedback": {{"A": "..."}}, "source_refs": ["..."]}}]}}"""


def validate_question(q, refs):
    """Every problem with one question, as sentences Gemini can act on. [] means it's good."""
    errs = []
    if not isinstance(q, dict):
        return ['each question must be a JSON object']
    prompt = q.get('prompt')
    if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > PROMPT_MAX:
        errs.append(f'prompt: 1–{PROMPT_MAX} characters')
    choices = q.get('choices')
    if not isinstance(choices, list) or not 2 <= len(choices) <= 4:
        errs.append('choices: needs 2–4 choices')
        return errs
    ids = []
    for i, c in enumerate(choices):
        want = LETTERS[i]
        if not isinstance(c, dict) or c.get('choice_id') != want:
            errs.append(f'choices[{i}]: choice_id must be "{want}" (letters in order)')
            continue
        ids.append(want)
        text = c.get('text')
        if not isinstance(text, str) or not text.strip() or len(text) > CHOICE_MAX:
            errs.append(f'choices[{i}]: text must be 1–{CHOICE_MAX} characters')
    if q.get('correct_choice_id') not in ids:
        errs.append(f'correct_choice_id must be one of {", ".join(ids)}')
    feedback = q.get('feedback')
    if not isinstance(feedback, dict):
        errs.append('feedback: give one line for every choice')
    else:
        for cid in ids:
            text = feedback.get(cid)
            if not isinstance(text, str) or not text.strip() or len(text) > FEEDBACK_MAX:
                errs.append(f'feedback for {cid}: 1–{FEEDBACK_MAX} characters')
    source = q.get('source_refs')
    if not isinstance(source, list) or not source or not set(source) <= set(refs):
        errs.append(f'source_refs must list refs from this objective only ({", ".join(sorted(refs))})')
    return errs


def _clean(q):
    keep = ('prompt', 'choices', 'correct_choice_id', 'feedback', 'source_refs')
    return {k: q[k] for k in keep}


def _parts(obj, count, previous=None, problems=None):
    text = TASK.format(label=obj.get('label', obj['objective_id']), objective_id=obj['objective_id'],
                       excerpts='\n'.join(f'[{e["ref"]}] {e["text"]}' for e in obj['source_excerpts']),
                       count=count, prompt_max=PROMPT_MAX, choice_max=CHOICE_MAX, feedback_max=FEEDBACK_MAX)
    if problems:
        text += '\n\nYour previous answer had these problems. Fix exactly these and return all questions again:\n'
        text += '\n'.join(f'- {p}' for p in problems)
        text += '\nPrevious answer:\n' + json.dumps(previous, ensure_ascii=False)[:6000]
    return [gemini.text_part(text)]


def _check_all(reply, refs, count):
    items = reply.get('questions') if isinstance(reply, dict) else None
    if not isinstance(items, list):
        return [], ['return {"questions": [...]}']
    good, problems = [], []
    for i, q in enumerate(items[:count]):
        errs = validate_question(q, refs)
        if errs:
            problems += [f'question {i + 1}: {e}' for e in errs]
        else:
            good.append(_clean(q))
    return good, problems


def generate_questions(client, breakdown, course_id, per_objective=2):
    """{'questions': [...], 'skipped': [...]} for every objective in a breakdown."""
    questions, skipped = [], []
    for obj in breakdown.get('objectives') or []:
        if not obj.get('source_excerpts') or not obj.get('objective_id'):
            continue
        refs = {e['ref'] for e in obj['source_excerpts']}
        reply = client.generate_json(_parts(obj, per_objective), system=SYSTEM, temperature=0.3)
        good, problems = _check_all(reply, refs, per_objective)
        if problems:
            retry = client.generate_json(_parts(obj, per_objective, reply, problems), system=SYSTEM, temperature=0.2)
            fixed, problems = _check_all(retry, refs, per_objective)
            if len(fixed) >= len(good):
                good = fixed
        if problems:
            skipped.append({'objective_id': obj['objective_id'], 'reason': 'questions failed the checks twice',
                            'errors': problems})
        for n, q in enumerate(good, 1):
            questions.append({'question_id': f'{course_id}-{obj["objective_id"]}-q{n}', 'topic_id': obj.get('topic_id'),
                              'objective_id': obj['objective_id'], 'objective_label': obj.get('label', ''), **q})
    return {'questions': questions, 'skipped': skipped}
