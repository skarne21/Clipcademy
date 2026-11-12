"""Practice questions for an imported course (US-32): Gemini writes them, these checks keep them honest.

Each objective gets up to two multiple-choice questions written only from its verbatim source
excerpts. A question that fails the checks goes back to Gemini once with the exact errors; if it
still fails it is skipped. Questions go to the class with its clips.
"""
import json
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import gemini  # noqa: E402
import generate  # noqa: E402

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

MISCONCEPTION_TASK = """
MISCONCEPTIONS (the two mistakes students make about this objective):
{misconceptions}

- In each question above, also give "misconceptions": for EVERY wrong choice, the misconception_id it reveals
  (keyed by choice_id).
- Also write "retries": exactly 2 NEW questions per misconception (4 in all), different from the questions above,
  each checking only that one idea. A student sees a retry after a short clip that corrects the mistake. Each retry
  has misconception_id plus prompt, choices, correct_choice_id, feedback and source_refs, with the same rules.

Return JSON: {{"questions": [{{"prompt": "...", "choices": [...], "correct_choice_id": "A", "feedback": {{...}},
"source_refs": [...], "misconceptions": {{"B": "..."}}}}], "retries": [{{"misconception_id": "...", "prompt": "...",
"choices": [...], "correct_choice_id": "A", "feedback": {{...}}, "source_refs": [...]}}]}}"""


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


def _misconceptions(obj):
    """{id: label} for an objective with 2 valid misconceptions (US-41), else {} (plain questions, no follow-ups)."""
    if generate.followup_plans(obj)[1]:
        return {}
    return {m['misconception_id']: m.get('label', '') for m in obj['misconceptions']}


def _parts(obj, count, previous=None, problems=None):
    text = TASK.format(label=obj.get('label', obj['objective_id']), objective_id=obj['objective_id'],
                       excerpts='\n'.join(f'[{e["ref"]}] {e["text"]}' for e in obj['source_excerpts']),
                       count=count, prompt_max=PROMPT_MAX, choice_max=CHOICE_MAX, feedback_max=FEEDBACK_MAX)
    ms = _misconceptions(obj)
    if ms:
        text += MISCONCEPTION_TASK.format(misconceptions='\n'.join(f'- {i}: {label}' for i, label in ms.items()))
    if problems:
        text += '\n\nYour previous answer had these problems. Fix exactly these and return all questions again:\n'
        text += '\n'.join(f'- {p}' for p in problems)
        text += '\nPrevious answer:\n' + json.dumps(previous, ensure_ascii=False)[:6000]
    return [gemini.text_part(text)]


def _wrong_choice_problems(q, ms):
    mapping = q.get('misconceptions')
    wrong = [c['choice_id'] for c in q['choices'] if c['choice_id'] != q['correct_choice_id']]
    if not isinstance(mapping, dict) or any(mapping.get(c) not in ms for c in wrong):
        return [f'misconceptions: map every wrong choice ({", ".join(wrong)}) to one of {", ".join(ms)}']
    return []


def _check_all(reply, refs, count, ms=None):
    """(questions, retries, problems). retries is {misconception_id: [up to 2 questions]} when ms is given."""
    items = reply.get('questions') if isinstance(reply, dict) else None
    if not isinstance(items, list):
        return [], {}, ['return {"questions": [...]}']
    good, problems = [], []
    for i, q in enumerate(items[:count]):
        errs = validate_question(q, refs)
        if not errs and ms:
            errs = _wrong_choice_problems(q, ms)
        if errs:
            problems += [f'question {i + 1}: {e}' for e in errs]
        else:
            good.append({**_clean(q), 'misconceptions': q.get('misconceptions') or {}})
    retries = {m: [] for m in ms or {}}
    for i, q in enumerate((reply.get('retries') or []) if ms else []):
        errs = validate_question(q, refs)
        if isinstance(q, dict) and q.get('misconception_id') not in retries:
            errs.append(f'misconception_id must be one of {", ".join(retries)}')
        if errs:
            problems += [f'retry {i + 1}: {e}' for e in errs]
        elif len(retries[q['misconception_id']]) < 2:
            retries[q['misconception_id']].append(_clean(q))
    problems += [f'{m}: needs 2 retries, got {len(rs)}' for m, rs in retries.items() if len(rs) < 2]
    return good, retries, problems


def _size(result):
    return len(result[0]) + sum(map(len, result[1].values()))


def _choice_map(q, wrong):
    """{choice_id: misconception_id}, None for the correct choice."""
    return {c['choice_id']: None if c['choice_id'] == q['correct_choice_id'] else wrong(c['choice_id']) for c in q['choices']}


def generate_questions(client, breakdown, course_id, per_objective=2, progress=None, workers=4):
    """{'questions': [...], 'skipped': [...]} for every objective in a breakdown.

    Up to `workers` objectives are written at once; progress(n, total) is called as each finishes (US-46)."""
    objectives = [o for o in breakdown.get('objectives') or [] if o.get('source_excerpts') and o.get('objective_id')]
    lock, count = threading.Lock(), [0]

    def one(obj):
        result = _objective_questions(client, obj, course_id, per_objective)
        with lock:
            count[0] += 1
            done = count[0]
        if progress:
            progress(done, len(objectives))
        return result

    questions, skipped = [], []
    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        for qs, sk in pool.map(one, objectives):  # map keeps topic order
            questions += qs
            skipped += sk
    return {'questions': questions, 'skipped': skipped}


def _objective_questions(client, obj, course_id, per_objective):
    """(questions, skipped) for one objective."""
    questions, skipped = [], []
    refs = {e['ref'] for e in obj['source_excerpts']}
    ms = _misconceptions(obj)
    reply = client.generate_json(_parts(obj, per_objective), system=SYSTEM, temperature=0.3)
    good, retries, problems = _check_all(reply, refs, per_objective, ms)
    if problems:
        again = client.generate_json(_parts(obj, per_objective, reply, problems), system=SYSTEM, temperature=0.2)
        fixed = _check_all(again, refs, per_objective, ms)
        if _size(fixed) >= _size((good, retries)):
            good, retries, problems = fixed
    if problems:
        skipped.append({'objective_id': obj['objective_id'], 'reason': 'questions failed the checks twice',
                        'errors': problems})
    base = {'topic_id': obj.get('topic_id'), 'objective_id': obj['objective_id'], 'objective_label': obj.get('label', '')}
    required = []
    for n, q in enumerate(good, 1):
        qid = f'{course_id}-{obj["objective_id"]}-q{n}'
        required.append({'question_id': qid, **base, **q, 'role': 'required', 'counts_for': qid,
                         'misconceptions': _choice_map(q, lambda c: q['misconceptions'].get(c))})
    questions += required
    for m, items in retries.items():
        # as in the MVP's answer key: a retry counts for the required question whose wrong choice leads to its idea
        leads = next((q['question_id'] for q in required if m in q['misconceptions'].values()), None)
        for n, q in enumerate(items, 1):
            qid = f'{course_id}-{obj["objective_id"]}-{m}-r{n}'
            questions.append({'question_id': qid, **base, **q, 'role': 'retry', 'misconception_id': m,
                              'counts_for': leads or qid, 'misconceptions': _choice_map(q, lambda c: m)})
    return questions, skipped
