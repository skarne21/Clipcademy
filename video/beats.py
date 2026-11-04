"""Turn a vertical clip's beats (spoken cue -> actions) into a timed plan for the Remotion renderer.

The plan is the single source of truth for what happens when: the Remotion
components only draw it, and the same plan drives the sound effects and the
pacing checks (notes.md: something changes on screen every 2-3 s).
"""
ACTIONS = {'point', 'pose', 'pulse', 'zoom', 'zoom_out', 'card', 'label', 'extend', 'stop', 'bounce', 'arrow', 'ghost'}
POSES = {'talk', 'present', 'shrug', 'think', 'thumbs', 'celebrate', 'wag', 'surprised'}
TARGETS = {'strand': {'template', 'new_5', 'new_3', 'strand', 'ghost', 'arrow'}}
STEP = 0.42          # seconds between pieces clicking on while the strand grows
MAX_STILL = 3.0      # longest allowed stretch with no on-screen change
SOUNDS = {'pulse': 'pop', 'label': 'pop', 'card': 'pop', 'arrow': 'whoosh', 'ghost': 'pop',
          'zoom': 'whoosh', 'zoom_out': 'whoosh', 'bounce': 'boing'}


def norm(word):
    return ''.join(ch for ch in word.lower() if ch.isalnum())


def resolve(scene, words):
    """[(t, action, arg)] with each cue matched, in order, to the time its word is spoken."""
    tokens = [norm(w[0]) for w in words]
    events, cursor = [], 0
    targets = TARGETS[scene['diagram']]
    for beat in scene['beats']:
        cue = beat['on']
        if cue == '^':
            at = 0.0
        else:
            phrase = [norm(x) for x in cue.split()]
            for i in range(cursor, len(tokens) - len(phrase) + 1):
                if tokens[i:i + len(phrase)] == phrase:
                    break
            else:
                raise ValueError(f'Beat cue {cue!r} not found in the narration after word {cursor}')
            cursor, at = i, words[i][1]
        at += beat.get('after', 0)
        for action in beat['do']:
            name, _, arg = action.partition(':')
            if name not in ACTIONS:
                raise ValueError(f'Unknown action {action!r}')
            if name == 'pose' and arg not in POSES:
                raise ValueError(f'Unknown pose {arg!r}')
            if name in ('point', 'pulse', 'zoom') and arg not in targets:
                raise ValueError(f'Unknown target {arg!r} for {scene["diagram"]}')
            if name == 'label' and arg not in ('5', '3'):
                raise ValueError('label takes 5 or 3')
            events.append((round(at, 3), name, arg))
    return sorted(events, key=lambda e: e[0])


def plan(scene, words, duration):
    events = resolve(scene, words)
    stage = {'strand': 3, 'slots': 10, **scene.get('stage', {})}
    stops = sorted(t for t, n, _ in events if n in ('stop', 'ghost'))
    attach, count = [], stage['strand']
    for t, name, _ in events:
        if name != 'extend':
            continue
        at = max(t + 0.35, (attach[-1] + STEP) if attach else 0)
        limit = min([s for s in stops if s > t] + [duration - 0.4])
        while count < stage['slots'] and at < limit:
            attach.append(round(at, 3))
            count += 1
            at += STEP
    return {'stage': stage, 'attach': attach,
            'events': [{'t': t, 'action': n, 'arg': a} for t, n, a in events]}


def change_times(p):
    return sorted([e['t'] for e in p['events'] if e['action'] != 'stop'] + p['attach'])


def longest_still(p, duration):
    marks = [0.0] + [t for t in change_times(p) if 0 <= t <= duration] + [duration]
    return max(b - a for a, b in zip(marks, marks[1:]))


def sound_cues(p):
    cues = [(0.0, 'sting')]
    cues += [(e['t'], SOUNDS[e['action']]) for e in p['events'] if e['action'] in SOUNDS]
    cues += [(t, 'click') for t in p['attach']]
    out, last = [], {}
    for t, kind in sorted(cues):
        if t - last.get(kind, -9) >= 0.12:  # don't stack identical sounds
            out.append((t, kind))
            last[kind] = t
    return out
