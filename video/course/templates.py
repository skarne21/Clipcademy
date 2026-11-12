"""General-purpose stick-figure scenes for imported courses (US-27) and the checks every generated clip
must pass before it is voiced (US-28).

The biology clips name one of five hand-built diagrams (video/beats.py). Imported courses can be about
anything, so their clips pick one of these templates instead and fill in its props. Gemini chooses a
template and writes text; it never invents visuals. This module only reads beats.py (shared helpers
and the guide's poses); it never changes it, so the existing clips' fingerprints stay the same.
"""
import importlib.util
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent


def _load_beats():
    spec = importlib.util.spec_from_file_location('clipcademy_beats', HERE.parent / 'beats.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


beats = _load_beats()

POSES = sorted(beats.POSES)
MIN_WORDS, MAX_WORDS = 45, 70
CARD_MAX, STEP_LABEL_MAX, TITLE_MAX = 30, 14, 40
ENDINGS = {'intro': 'Swipe.', 'last_intro': "Let's see what you remember.", 'followup': 'Now try the question again.'}
ID = re.compile(r'^[a-z][a-z0-9_]{0,23}$')
COURSE_ID = re.compile(r'^[a-z][a-z0-9_]{1,39}$')
SYMBOLS = set('′″→←↑↓⇒≈≠≥≤×÷^~*_|<>{}[]#@\\=+')

# Each template: what Gemini fills in (props), what can happen (actions) and the sound each action makes.
# Action argument kinds: 'target' = an ID from this scene's targets, 'side' = left|right,
# 'edge' = <from>-<to> of a defined edge, None = no argument.
TEMPLATES = {
    'steps': {
        'use': 'an ordered process, procedure, algorithm or set of phases',
        'props': 'steps: 2–5 items of {id, text (≤22 chars)}',
        'actions': {'reveal': 'target', 'highlight': 'target', 'check': 'target', 'shake': 'target'},
        'help': 'reveal:<id> shows a step (steps you never reveal are shown from the start); highlight:<id> '
                'colours it; check:<id> ticks it off; shake:<id> wobbles it (for a wrong idea).',
    },
    'compare': {
        'use': 'two things side by side (A vs B, before vs after, myth-free contrasts)',
        'props': 'left and right: {title (≤14 chars), points: 1–3 items of {id, text (≤18 chars)}}',
        'actions': {'reveal': 'target', 'highlight': 'target', 'winner': 'side'},
        'help': 'reveal:left / reveal:right / reveal:<point id> show a column or one point; highlight:<id> '
                'colours it; winner:left|right marks the side that answers the hook.',
    },
    'flow': {
        'use': 'cause and effect, a pathway or a chain of events',
        'props': 'nodes: 2–4 items of {id, text (≤16 chars)}; edges: 1–4 items of {from, to} using node ids',
        'actions': {'reveal': 'target', 'highlight': 'target', 'pulse_edge': 'edge', 'block': 'target'},
        'help': 'reveal:<node id> shows a node and the arrows into it; highlight:<node id> colours it; '
                'pulse_edge:<from>-<to> sends a dot along an arrow; block:<node id> crosses a node out.',
    },
    'term': {
        'use': 'defining one new word with a plain meaning and an example',
        'props': 'term (≤18 chars), plain (≤40 chars), example (≤40 chars)',
        'actions': {'reveal_plain': None, 'reveal_example': None, 'highlight': 'target'},
        'help': 'reveal_plain and reveal_example show those lines (shown from the start if never revealed); '
                'highlight:term|plain|example colours one.',
    },
    'myth_fact': {
        'use': 'correcting a common wrong idea (best for follow-ups)',
        'props': 'myth (≤36 chars), fact (≤36 chars)',
        'actions': {'show_myth': None, 'cross_out': None, 'show_fact': None},
        'help': 'show_myth shows the wrong idea, cross_out strikes it through, show_fact shows the right one.',
    },
}
COMMON = {'pose': 'pose', 'point': 'target', 'pulse': 'target', 'zoom': 'target', 'zoom_out': None,
          'card': 'card', 'step': 'label'}
SOUNDS = {**{k: v for k, v in beats.SOUNDS.items() if k in COMMON},
          'reveal': 'pop', 'highlight': 'pop', 'check': 'pop', 'shake': 'boing', 'winner': 'pop',
          'pulse_edge': 'whoosh', 'block': 'boing', 'reveal_plain': 'pop', 'reveal_example': 'pop',
          'show_myth': 'pop', 'cross_out': 'boing', 'show_fact': 'pop'}

SAMPLE_PROPS = {
    'steps': {'steps': [{'id': 'one', 'text': 'Collect the evidence'}, {'id': 'two', 'text': 'Form a hypothesis now'},
                        {'id': 'three', 'text': 'Test it with a trial'}, {'id': 'four', 'text': 'Compare the results'},
                        {'id': 'five', 'text': 'Share what you found'}]},
    'compare': {'left': {'title': 'Weather', 'points': [{'id': 'w1', 'text': 'Today, this week'},
                                                         {'id': 'w2', 'text': 'Shifts by the hour'}]},
                'right': {'title': 'Climate', 'points': [{'id': 'c1', 'text': 'A 30-year average'},
                                                          {'id': 'c2', 'text': 'Changes by decades'}]}},
    'flow': {'nodes': [{'id': 'demand', 'text': 'Demand goes up'}, {'id': 'short', 'text': 'Shortage appears'},
                       {'id': 'price', 'text': 'Prices rise fast'}, {'id': 'supply', 'text': 'More gets made'}],
             'edges': [{'from': 'demand', 'to': 'short'}, {'from': 'short', 'to': 'price'},
                       {'from': 'price', 'to': 'supply'}]},
    'term': {'term': 'Opportunity cost', 'plain': 'What you give up when you choose',
             'example': 'Studying means missing the movie tonight'},
    'myth_fact': {'myth': 'Heavier things always fall faster', 'fact': 'Without air, all things fall equally'},
}
LIMITS = {'steps': 22, 'compare_title': 14, 'compare_point': 18, 'flow': 16, 'term': 18, 'plain': 40, 'example': 40,
          'myth': 36, 'fact': 36}


def _text(value, limit, where, errs):
    if not isinstance(value, str) or not value.strip():
        errs.append(f'{where}: missing text')
    elif len(value) > limit:
        errs.append(f'{where}: text too long ({len(value)} > {limit} characters): {value!r}')


def _items(items, lo, hi, limit, where, errs, ids):
    if not isinstance(items, list) or not lo <= len(items) <= hi:
        errs.append(f'{where}: needs {lo}–{hi} items')
        return
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            errs.append(f'{where}[{i}]: must be an object')
            continue
        if not ID.match(str(item.get('id', ''))):
            errs.append(f'{where}[{i}]: id must be lowercase letters, digits or _ (got {item.get("id")!r})')
        elif item['id'] in ids:
            errs.append(f'{where}[{i}]: duplicate id {item["id"]!r}')
        else:
            ids.add(item['id'])
        _text(item.get('text'), limit, f'{where}[{i}]', errs)


def validate_props(name, props):
    errs = []
    if not isinstance(props, dict):
        return ['props: must be an object']
    ids = set()
    if name == 'steps':
        _items(props.get('steps'), 2, 5, LIMITS['steps'], 'props.steps', errs, ids)
    elif name == 'compare':
        for side in ('left', 'right'):
            col = props.get(side)
            if not isinstance(col, dict):
                errs.append(f'props.{side}: missing')
                continue
            _text(col.get('title'), LIMITS['compare_title'], f'props.{side}.title', errs)
            _items(col.get('points'), 1, 3, LIMITS['compare_point'], f'props.{side}.points', errs, ids)
        if ids & {'left', 'right'}:
            errs.append('props: point ids cannot be "left" or "right"')
    elif name == 'flow':
        _items(props.get('nodes'), 2, 4, LIMITS['flow'], 'props.nodes', errs, ids)
        edges = props.get('edges')
        if not isinstance(edges, list) or not 1 <= len(edges) <= 4:
            errs.append('props.edges: needs 1–4 items')
        else:
            for i, e in enumerate(edges):
                if not isinstance(e, dict) or e.get('from') not in ids or e.get('to') not in ids or e.get('from') == e.get('to'):
                    errs.append(f'props.edges[{i}]: from/to must be two different node ids')
    elif name == 'term':
        for key in ('term', 'plain', 'example'):
            _text(props.get(key), LIMITS[key], f'props.{key}', errs)
    elif name == 'myth_fact':
        for key in ('myth', 'fact'):
            _text(props.get(key), LIMITS[key], f'props.{key}', errs)
    else:
        errs.append(f'unknown template {name!r}')
    return errs


def targets(name, props):
    if name == 'steps':
        return {s['id'] for s in props.get('steps', [])}
    if name == 'compare':
        return {'left', 'right'} | {p['id'] for side in ('left', 'right') for p in props.get(side, {}).get('points', [])}
    if name == 'flow':
        return {n['id'] for n in props.get('nodes', [])}
    if name == 'term':
        return {'term', 'plain', 'example'}
    if name == 'myth_fact':
        return {'myth', 'fact'}
    return set()


def reveal_all(name, props):
    """(action, arg) pairs that show everything a template can show: used by the layout test."""
    if name in ('steps', 'flow'):
        return [('reveal', i) for i in sorted(targets(name, props))]
    if name == 'compare':
        return [('reveal', i) for i in sorted(targets(name, props))]
    if name == 'term':
        return [('reveal_plain', ''), ('reveal_example', '')]
    return [('show_myth', ''), ('show_fact', '')]


def _check_action(action, name, props, errs):
    verb, _, arg = action.partition(':')
    kinds = {**COMMON, **TEMPLATES[name]['actions']}
    if verb not in kinds:
        errs.append(f'unknown action {action!r} for template {name!r}')
        return
    kind = kinds[verb]
    if kind is None and arg:
        errs.append(f'{verb} takes no argument (got {action!r})')
    elif kind == 'pose' and arg not in beats.POSES:
        errs.append(f'unknown pose {arg!r}; use one of {", ".join(POSES)}')
    elif kind == 'target' and arg not in targets(name, props):
        errs.append(f'{verb}: target {arg!r} is not defined in this scene (targets: {", ".join(sorted(targets(name, props)))})')
    elif kind == 'side' and arg not in ('left', 'right'):
        errs.append(f'{verb} takes left or right (got {arg!r})')
    elif kind == 'edge':
        pairs = {f"{e['from']}-{e['to']}" for e in props.get('edges', []) if isinstance(e, dict)}
        if arg not in pairs:
            errs.append(f'{verb}: {arg!r} is not a defined edge (edges: {", ".join(sorted(pairs))})')
    elif kind == 'card' and not 0 < len(arg) <= CARD_MAX:
        errs.append(f'card text must be 1–{CARD_MAX} characters (got {len(arg)}): {arg!r}')
    elif kind == 'label' and not 0 < len(arg) <= STEP_LABEL_MAX:
        errs.append(f'step label must be 1–{STEP_LABEL_MAX} characters: {arg!r}')


def _tokens(text):
    return [beats.norm(w) for w in text.split()]


def _check_beats(scene, errs):
    beat_list = scene.get('beats')
    if not isinstance(beat_list, list) or not beat_list:
        errs.append('beats: needs at least one beat')
        return
    if beat_list[0].get('on') != '^':
        errs.append('beats: the first beat must be {"on": "^"} (the first frame)')
    tokens, cursor = _tokens(scene.get('narration', '')), 0
    for n, beat in enumerate(beat_list):
        cue = beat.get('on')
        if not isinstance(cue, str) or not cue:
            errs.append(f'beats[{n}]: missing "on"')
            continue
        if cue != '^':
            phrase = [beats.norm(x) for x in cue.split()]
            hit = next((i for i in range(cursor, len(tokens) - len(phrase) + 1) if tokens[i:i + len(phrase)] == phrase), None)
            if hit is None:
                where = 'appears earlier (cues must be in narration order)' if phrase and any(
                    tokens[i:i + len(phrase)] == phrase for i in range(len(tokens))) else 'is not in the narration'
                errs.append(f'beats[{n}]: cue {cue!r} not found after word {cursor}: it {where}')
            else:
                cursor = hit
        actions = beat.get('do')
        if not isinstance(actions, list) or not actions:
            errs.append(f'beats[{n}]: "do" needs at least one action')
            continue
        for action in actions:
            if not isinstance(action, str):
                errs.append(f'beats[{n}]: actions are strings')
            elif scene.get('template') in TEMPLATES:
                _check_action(action, scene['template'], scene.get('props') or {}, errs)


def validate(clip):
    """Every problem with a generated clip, as plain sentences Gemini can act on. [] means it's good."""
    errs = []
    if not isinstance(clip, dict):
        return ['the clip must be a JSON object']
    if not COURSE_ID.match(str(clip.get('course_id', ''))):
        errs.append('course_id must be lowercase letters, digits or _')
    for key in ('topic_id', 'objective_id', 'variant_id'):
        if not ID.match(str(clip.get(key, ''))):
            errs.append(f'{key} must be lowercase letters, digits or _ (max 24 characters)')
    kind = clip.get('kind')
    if kind not in ENDINGS:
        errs.append(f'kind must be one of {", ".join(ENDINGS)}')
    if clip.get('format') != 'vertical':
        errs.append('format must be "vertical"')
    if not isinstance(clip.get('teaching_goal'), str) or not clip.get('teaching_goal', '').strip():
        errs.append('teaching_goal: missing')
    refs = clip.get('source_refs')
    if not isinstance(refs, list) or not refs or not all(isinstance(r, str) and r for r in refs):
        errs.append('source_refs: list the refs of the excerpts this clip uses')
    scenes = clip.get('scenes')
    if not isinstance(scenes, list) or len(scenes) != 1 or not isinstance(scenes[0], dict):
        errs.append('scenes: exactly one scene')
        return errs
    scene = scenes[0]
    name = scene.get('template')
    if name not in TEMPLATES:
        errs.append(f'unknown template {name!r}; use one of {", ".join(TEMPLATES)}')
    else:
        errs += validate_props(name, scene.get('props'))
    title = scene.get('title')
    if not isinstance(title, str) or not 0 < len(title) <= TITLE_MAX:
        errs.append(f'title: 1–{TITLE_MAX} characters')
    narration = scene.get('narration')
    if not isinstance(narration, str):
        errs.append('narration: missing')
        return errs
    words = len(narration.split())
    if not MIN_WORDS <= words <= MAX_WORDS:
        errs.append(f'narration has {words} words; it must have {MIN_WORDS}–{MAX_WORDS} words')
    bad = sorted({ch for ch in narration if ch in SYMBOLS})
    if bad:
        errs.append(f'narration contains symbols the voice misreads ({" ".join(bad)}); write them as words')
    if kind in ENDINGS and not narration.strip().replace('’', "'").endswith(ENDINGS[kind]):
        errs.append(f'a {kind} clip must end with the line "{ENDINGS[kind]}"')
    _check_beats(scene, errs)
    return errs


def resolve(scene, words):
    """[(t, action, arg)]: each cue matched, in order, to the time its word is spoken (as beats.resolve)."""
    tokens = [beats.norm(w[0]) for w in words]
    events, cursor = [], 0
    for beat in scene['beats']:
        if beat['on'] == '^':
            at = 0.0
        else:
            phrase = [beats.norm(x) for x in beat['on'].split()]
            hit = next((i for i in range(cursor, len(tokens) - len(phrase) + 1) if tokens[i:i + len(phrase)] == phrase), None)
            if hit is None:
                raise ValueError(f"Beat cue {beat['on']!r} not found in the narration after word {cursor}")
            cursor, at = hit, words[hit][1]
        at += beat.get('after', 0)
        for action in beat['do']:
            name, _, arg = action.partition(':')
            events.append((round(at, 3), name, arg))
    return sorted(events, key=lambda e: e[0])


def plan(scene, words, duration):
    result = {'stage': {}, 'pieces': [],
              'events': [{'t': t, 'action': n, 'arg': a} for t, n, a in resolve(scene, words)]}
    beats.fill_stills(result, words, duration)
    return result


def longest_still(p, duration):
    return beats.longest_still(p, duration)


def sound_cues(p):
    cues = [(0.0, 'sting')] + [(e['t'], SOUNDS[e['action']]) for e in p['events'] if e['action'] in SOUNDS]
    out, last = [], {}
    for t, kind in sorted(cues):
        if t - last.get(kind, -9) >= 0.12:
            out.append((t, kind))
            last[kind] = t
    return out


def catalog_text():
    """The scene catalog as Gemini reads it in the storyboard prompt."""
    lines = ['Templates (pick ONE per clip):']
    for name, spec in TEMPLATES.items():
        acts = ', '.join(f'{a}:<{k}>' if k else a for a, k in spec['actions'].items())
        lines += [f'- {name}: for {spec["use"]}.', f'  props: {spec["props"]}', f'  actions: {acts}',
                  f'  {spec["help"]}']
    lines += ['Actions for every template:',
              f'- pose:<{"|".join(POSES)}> the guide reacts',
              '- point:<target> the guide points; pulse:<target> a glow ring; zoom:<target> camera zooms in; zoom_out',
              f'- card:<text> a pop-up fact card (≤{CARD_MAX} chars); step:<word> a small numbered label (≤{STEP_LABEL_MAX} chars)',
              'Targets are the ids you define in props (compare also has left and right; term has term, plain, '
              'example; myth_fact has myth and fact).']
    return '\n'.join(lines)
