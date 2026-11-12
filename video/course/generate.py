"""Import a class's material and have Gemini turn it into stick-figure clip scripts (US-24 to US-26, US-28).

    python3 video/course/generate.py --course econ101 --title "Intro Economics" --material lecture3.pdf notes.md

1. The material is copied to video/courses/<course>/material/.
2. Gemini breaks it into learning objectives with verbatim source excerpts and a plan of short clips
   (saved as breakdown.json). For text material, excerpts that aren't in the text drop their objective.
3. Gemini storyboards each planned clip with one general-purpose template (course/templates.py).
   Every clip is checked; a failing clip goes back to Gemini once with the exact errors, then is skipped.
4. Clips are saved to video/courses/<course>/scripts/ as review_status "pending". Render them with
   video/course/render_course.py. Nothing here touches the existing 35 clips or runs in a student session.
"""
import argparse
import copy
import json
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import gemini  # noqa: E402
import templates  # noqa: E402

COURSES = HERE.parent / 'courses'
SUPPORTED = {'.pdf', '.txt', '.md'}

BREAKDOWN_SYSTEM = """You are a curriculum analyst for ClipCademy, an app that teaches through 15–30 second vertical
stick-figure video clips. You only use what is in the attached course material: never add outside knowledge.
Every fact you return must be backed by a verbatim quote from the material."""

BREAKDOWN_TASK = """Course: {title} (course_id "{course}").

Break the attached material into at most {max_objectives} learning objectives that are worth short review clips
(concepts students often get wrong, processes with steps, comparisons; skip logistics like due dates).

For each objective return:
- topic_id and objective_id: lowercase snake_case, max 24 characters.
- label: a short human-readable name.
- source_excerpts: 1–4 quotes copied EXACTLY from the material (no paraphrase, no ellipses), each with a ref
  like "{course}-<file stem>-p<page>" (use p1 for text files).
- clips: 3–5 clips that build the idea in order. Each has variant_id ("intro_1", "intro_2", ...), kind
  ("intro" for all but the last, "last_intro" for the last), a teaching_goal (ONE plain sentence under
  12 words that the clip's last teaching line will say), and source_refs (refs of the excerpts it uses).
- misconceptions: exactly 2 mistakes a student is likely to make about this objective, each backed by the
  excerpts. Each has misconception_id (lowercase snake_case, max 13 characters), label (the wrong idea, short),
  followup_goal (ONE plain sentence under 12 words that corrects it), followup_2_goal (the same correction said a
  different way, for a student who missed it twice), and source_refs.

Return JSON: {{"course_id": "{course}", "title": "...", "objectives": [{{"topic_id": "...", "objective_id": "...",
"label": "...", "source_excerpts": [{{"ref": "...", "text": "..."}}], "clips": [{{"variant_id": "intro_1",
"kind": "intro", "teaching_goal": "...", "source_refs": ["..."]}}], "misconceptions": [{{"misconception_id": "...",
"label": "...", "followup_goal": "...", "followup_2_goal": "...", "source_refs": ["..."]}}]}}]}}"""

MISCONCEPTION_ID = re.compile(r'^[a-z][a-z0-9_]{1,12}$')  # + "_followup_2" stays within the 24-character variant_id

STORYBOARD_SYSTEM = """You storyboard ONE ClipCademy clip: a 15–30 second vertical (9:16) video with a friendly stick-figure
guide, one animated board, and big word-by-word captions. A renderer draws it from your JSON. You only use the
templates, props and actions in the catalog. You never invent facts: everything comes from the excerpts."""

RULES = """WRITING RULES
1. Hook in the first 2 seconds: open on a question or a surprising claim. The "title" is that hook, under 8 words,
   on screen from the first frame. Any fact in the hook must be in the excerpts.
2. One idea. The last teaching sentence states the teaching goal plainly.
3. Short sentences (under 12 words), middle-school words. At most one new term, explained the first time.
4. Exactly one everyday analogy that doesn't teach anything false.
5. The narration must be 45–70 words. Write symbols and numbers as spoken words ("x squared", "five percent").
6. Last line: an "intro" clip ends with a one-line tease of the next idea and then "Swipe."; a "last_intro" clip
   ends with "Let's see what you remember."; a "followup" clip ends with "Now try the question again."
7. No hype words ("mind-blowing", "insane"). The fun comes from the guide's reactions.

ANIMATION RULES
- Pick the ONE template whose shape matches the idea (steps, compare, flow, term, myth_fact).
- beats: [{"on": "<word or short phrase from the narration>", "do": ["action", ...]}]. The first beat is
  {"on": "^", ...} (the first frame). Every other cue must appear in the narration, IN ORDER, as whole words.
- Put a beat every 4–6 words so the screen changes at least every 3 seconds.
- Every target you use must be an id you defined in props (or a fixed target the template lists)."""

EXAMPLE = {
    'course_id': 'econ101', 'topic_id': 'supply_and_demand', 'objective_id': 'price_changes', 'variant_id': 'intro_1',
    'kind': 'intro', 'format': 'vertical', 'teaching_goal': 'When demand beats supply, prices go up.',
    'source_refs': ['econ101-lecture3-p1'], 'review_status': 'pending',
    'review_notes': {'hook_claim': 'Prices rise when demand rises and supply stays the same: econ101-lecture3-p1.',
                     'analogy': 'An auction; check it does not imply every market is an auction.', 'new_term': 'none new'},
    'scenes': [{
        'template': 'steps', 'title': 'Why do prices go up?',
        'props': {'steps': [{'id': 'buyers', 'text': 'Lots of buyers'}, {'id': 'seats', 'text': 'Only a few seats'},
                            {'id': 'price', 'text': 'Price goes up'}]},
        'narration': ('Why do prices rise when everyone wants the same thing? Picture one concert with too few tickets. '
                      'First, lots of buyers show up. Second, there are only a few seats. Third, sellers raise the price '
                      'until fewer people want them. Think of it like an auction where the highest bidder wins. When '
                      'demand beats supply, prices go up. But what happens when supply grows? Swipe.'),
        'beats': [{'on': '^', 'do': ['pose:think']}, {'on': 'concert', 'do': ['pose:present']},
                  {'on': 'first', 'do': ['reveal:buyers', 'point:buyers']},
                  {'on': 'second', 'do': ['reveal:seats', 'point:seats']},
                  {'on': 'third', 'do': ['reveal:price', 'highlight:price']},
                  {'on': 'auction', 'do': ['card:Like an auction', 'pose:present']},
                  {'on': 'demand beats supply', 'do': ['check:price', 'pose:thumbs']},
                  {'on': 'supply grows', 'do': ['pose:think']}, {'on': 'swipe', 'do': ['pulse:price']}],
    }],
}

OUTPUT_SHAPE = """Return ONLY one JSON object with: course_id, topic_id, objective_id, variant_id, kind, format ("vertical"),
teaching_goal, source_refs, review_status ("pending"), review_notes {hook_claim, analogy, new_term} and
scenes: [ {template, title, props, narration, beats} ] (exactly one scene)."""


def _space(text):
    return ' '.join(text.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"').split())


def _check_inputs(course, materials):
    if not isinstance(course, str) or not templates.COURSE_ID.match(course):
        raise ValueError('course must be lowercase letters, digits or _ (2–40 characters), e.g. econ101')
    paths = [Path(m) for m in materials]
    if not paths:
        raise ValueError('give at least one --material file')
    for p in paths:
        if p.suffix.lower() not in SUPPORTED:
            raise ValueError(f'{p.name}: only PDF, .txt and .md files are supported (export slides as PDF)')
        if not p.is_file():
            raise ValueError(f'{p}: file not found')
    return paths


def _breakdown_ok(obj):
    if not isinstance(obj, dict) or not templates.ID.match(str(obj.get('topic_id', ''))) \
            or not templates.ID.match(str(obj.get('objective_id', ''))):
        return 'topic_id/objective_id missing or not snake_case'
    if not obj.get('source_excerpts') or not obj.get('clips'):
        return 'no source excerpts or no clips'
    for c in obj['clips']:
        if not templates.ID.match(str(c.get('variant_id', ''))) or c.get('kind') not in templates.ENDINGS \
                or not str(c.get('teaching_goal', '')).strip():
            return f'clip plan {c.get("variant_id")!r} is missing variant_id, kind or teaching_goal'
    return None


def followup_plans(obj):
    """US-40: (plans, problem). Each of exactly 2 misconceptions gets a v1 and a v2 follow-up clip plan."""
    ms = obj.get('misconceptions')
    if not isinstance(ms, list) or len(ms) != 2:
        return [], 'needs exactly 2 misconceptions for follow-up clips'
    ids = [m.get('misconception_id') if isinstance(m, dict) else None for m in ms]
    if len(set(ids)) != 2 or not all(isinstance(i, str) and MISCONCEPTION_ID.match(i) for i in ids):
        return [], 'misconception_id must be 2 different snake_case ids of at most 13 characters'
    plans = []
    for m in ms:
        for suffix, goal in (('_followup', 'followup_goal'), ('_followup_2', 'followup_2_goal')):
            if not str(m.get(goal, '')).strip():
                return [], f'misconception {m["misconception_id"]} is missing {goal}'
            plans.append({'variant_id': m['misconception_id'] + suffix, 'kind': 'followup', 'teaching_goal': m[goal],
                          'source_refs': m.get('source_refs') or [], 'misconception': m.get('label', '')})
    return plans, None


def _storyboard_parts(course, title, obj, plan, position, previous=None, errors=None):
    text = [f'Course: {title} ({course}). Objective: {obj["label"]} ({obj["topic_id"]} / {obj["objective_id"]}).',
            'EXCERPTS (your only facts):']
    text += [f'[{e["ref"]}] {e["text"]}' for e in obj['source_excerpts']]
    text += ['', 'THIS CLIP', f'- variant_id: {plan["variant_id"]}', f'- kind: {plan["kind"]}', f'- position: {position}',
             f'- teaching_goal: {plan["teaching_goal"]}', f'- source_refs: {", ".join(plan.get("source_refs") or [])}']
    if plan['kind'] == 'followup':
        text += [f'- the student just answered wrong because they think: {plan["misconception"]}. Correct that one idea.']
    if plan.get('first_narration'):
        text += ['- this is the SECOND follow-up: the student missed it again after this first explanation. Explain it '
                 'differently: use another template or analogy and different wording. First explanation:',
                 plan['first_narration']]
    text += ['', RULES, '', 'SCENE CATALOG', templates.catalog_text(), '',
             'EXAMPLE OF A FINISHED CLIP (match its style and shape):', json.dumps(EXAMPLE, ensure_ascii=False), '',
             OUTPUT_SHAPE]
    if errors:
        text += ['', 'Your previous answer had these problems. Fix exactly these and return the whole corrected JSON:']
        text += [f'- {e}' for e in errors]
        text += ['Previous answer:', json.dumps(previous, ensure_ascii=False)[:6000]]
    return [gemini.text_part('\n'.join(text))]


def _normalize(reply, course, obj, plan):
    """Gemini fills the content; the pipeline owns identity and review state."""
    clip = copy.deepcopy(reply) if isinstance(reply, dict) else {}
    clip.update(course_id=course, topic_id=obj['topic_id'], objective_id=obj['objective_id'],
                variant_id=plan['variant_id'], kind=plan['kind'], format='vertical', review_status='pending',
                teaching_goal=plan['teaching_goal'])
    if not clip.get('source_refs'):
        clip['source_refs'] = list(plan.get('source_refs') or [])
    return clip


def generate(course, materials, client=None, root=COURSES, title=None, max_objectives=4):
    paths = _check_inputs(course, materials)
    client = client or gemini.Gemini(gemini.load_key())
    title = title or course
    base = Path(root) / course
    (base / 'material').mkdir(parents=True, exist_ok=True)
    (base / 'scripts').mkdir(parents=True, exist_ok=True)
    for p in paths:
        shutil.copyfile(p, base / 'material' / p.name)

    parts = [gemini.text_part(BREAKDOWN_TASK.format(title=title, course=course, max_objectives=max_objectives))]
    for p in paths:
        parts += [gemini.text_part(f'--- FILE: {p.name} (refs use "{course}-{p.stem}-p<page>") ---'), gemini.file_part(p)]
    breakdown = client.generate_json(parts, system=BREAKDOWN_SYSTEM, temperature=0.2)
    breakdown = breakdown if isinstance(breakdown, dict) else {}
    breakdown.setdefault('title', title)
    breakdown['course_id'] = course

    text_sources = [_space(p.read_text(encoding='utf-8')) for p in paths if p.suffix.lower() != '.pdf']
    all_text = not any(p.suffix.lower() == '.pdf' for p in paths)
    written, skipped = [], []
    objectives = [o for o in (breakdown.get('objectives') or [])][:max_objectives]
    for obj in objectives:
        problem = _breakdown_ok(obj)
        if problem:
            skipped.append({'objective_id': str(obj.get('objective_id')), 'reason': problem})
            continue
        if all_text:
            missing = [e.get('text', '') for e in obj['source_excerpts']
                       if not any(_space(e.get('text', '')) in src for src in text_sources)]
            obj['excerpts_verified'] = not missing
            if missing:
                skipped.append({'objective_id': obj['objective_id'],
                                'reason': 'excerpts not found verbatim in the material: ' + '; '.join(missing)[:300]})
                continue
        else:
            obj['excerpts_verified'] = False  # PDFs: the reviewer checks each quote against the file
        followups, problem = followup_plans(obj)
        intros, narrations = len(obj['clips']), {}
        for n, plan in enumerate(obj['clips'] + followups, 1):
            position = f'clip {n} of {intros}' if n <= intros else 'follow-up after a wrong answer'
            if plan['variant_id'].endswith('_followup_2'):
                plan = {**plan, 'first_narration': narrations.get(plan['variant_id'][:-2], '')}
            reply = client.generate_json(_storyboard_parts(course, title, obj, plan, position), system=STORYBOARD_SYSTEM, temperature=0.6)
            clip = _normalize(reply, course, obj, plan)
            errors = templates.validate(clip)
            if errors:
                reply = client.generate_json(_storyboard_parts(course, title, obj, plan, position, clip, errors),
                                             system=STORYBOARD_SYSTEM, temperature=0.4)
                clip = _normalize(reply, course, obj, plan)
                errors = templates.validate(clip)
            if errors:
                skipped.append({'objective_id': obj['objective_id'], 'variant_id': plan['variant_id'],
                                'reason': 'failed the clip checks twice', 'errors': errors})
                continue
            path = base / 'scripts' / f'{clip["topic_id"]}.{clip["variant_id"]}.json'
            path.write_text(json.dumps(clip, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            written.append(str(path))
            narrations[clip['variant_id']] = clip['scenes'][0]['narration']
        if problem:
            skipped.append({'objective_id': obj['objective_id'], 'reason': f'no follow-up clips: {problem}'})

    (base / 'breakdown.json').write_text(json.dumps(breakdown, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    report = {'course_id': course, 'written': written, 'skipped': skipped}
    (base / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description='Turn class material into stick-figure clip scripts with Gemini.')
    parser.add_argument('--course', required=True, help='course id, e.g. econ101')
    parser.add_argument('--material', nargs='+', required=True, help='PDF, .txt or .md files')
    parser.add_argument('--title', help='course title shown to Gemini')
    parser.add_argument('--max-objectives', type=int, default=4)
    args = parser.parse_args(argv)
    try:
        report = generate(args.course, args.material, title=args.title, max_objectives=args.max_objectives)
    except (ValueError, gemini.MissingKey) as err:
        parser.exit(2, f'error: {err}\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f'\n{len(report["written"])} clip scripts written, {len(report["skipped"])} skipped. '
          f'Render with: python3 video/course/render_course.py --course {args.course} --all', file=sys.stderr)
    return 0 if report['written'] else 1


if __name__ == '__main__':
    sys.exit(main())
