"""Turn a vertical clip's beats (spoken cue -> actions) into a timed plan for the Remotion renderer.

The plan is the single source of truth for what happens when: the Remotion
components only draw it, and the same plan drives the sound effects and the
pacing checks (notes.md: something changes on screen every 2-3 s).
"""
COMMON = {'point', 'pose', 'pulse', 'zoom', 'zoom_out', 'card', 'step', 'stop'}
DIAGRAMS = {
    'strand': {'actions': {'label', 'extend', 'bounce', 'arrow', 'ghost', 'polymerase', 'fail', 'primase'},
               'targets': {'template', 'new_5', 'new_3', 'strand', 'primer', 'ghost', 'arrow', 'polymerase', 'primase'},
               'stage': {'strand': 3, 'primer': 0, 'slots': 10}},
    'repair': {'actions': {'extend', 'misadd', 'excise', 'fix', 'scan', 'found', 'cut', 'remove', 'replace', 'reseal',
                           'uv', 'bond', 'bulge', 'polymerase'},
               'targets': {'top', 'bottom', 'damage', 'section', 'gap', 'backbone', 'protein', 'polymerase', 'three_end'},
               'stage': {'bottom': 9, 'slots': 9}},
    'transcription': {'actions': {'polymerase', 'try', 'fail', 'open', 'extend', 'arrow'},
                      'targets': {'coding', 'template', 'promoter', 'rna', 'rna_end', 'polymerase', 'middle', 'arrow'},
                      'stage': {'rna': 0, 'start_slot': 2, 'slots': 10}},
    'translation': {'actions': {'enter', 'pair', 'reject', 'bond', 'shift', 'exit'},
                    'targets': {'a_site', 'p_site', 'e_site', 'codon', 'anticodon', 'start', 'mrna', 'chain', 'peptide', 'trna'},
                    'stage': {}},
    'timeline': {'actions': {'timeline', 'mark'}, 'targets': {'during', 'after', 'line'}, 'stage': {}},
}
POSES = {'talk', 'present', 'shrug', 'think', 'thumbs', 'celebrate', 'wag', 'surprised'}
STEP = 0.42          # seconds between pieces joining while a strand grows
MAX_STILL = 3.0      # longest allowed stretch with no on-screen change
BLOCKING = {'stop', 'ghost', 'misadd', 'fix', 'primase', 'fail', 'extend'}
SOUNDS = {'pulse': 'pop', 'label': 'pop', 'card': 'pop', 'step': 'pop', 'mark': 'pop', 'found': 'pop', 'pair': 'pop',
          'bond': 'pop', 'reseal': 'pop', 'ghost': 'pop', 'arrow': 'whoosh', 'zoom': 'whoosh', 'zoom_out': 'whoosh',
          'polymerase': 'whoosh', 'primase': 'whoosh', 'scan': 'whoosh', 'enter': 'whoosh', 'shift': 'whoosh',
          'exit': 'whoosh', 'remove': 'whoosh', 'uv': 'whoosh', 'open': 'whoosh', 'timeline': 'whoosh', 'try': 'whoosh',
          'cut': 'click', 'bounce': 'boing', 'fail': 'boing', 'reject': 'boing', 'misadd': 'boing', 'bulge': 'boing'}


def norm(word):
    return ''.join(ch for ch in word.lower() if ch.isalnum())


def resolve(scene, words):
    """[(t, action, arg)] with each cue matched, in order, to the time its word is spoken."""
    spec = DIAGRAMS[scene['diagram']]
    tokens = [norm(w[0]) for w in words]
    events, cursor = [], 0
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
            if name not in COMMON | spec['actions']:
                raise ValueError(f'Unknown action {action!r} for {scene["diagram"]}')
            if name == 'pose' and arg not in POSES:
                raise ValueError(f'Unknown pose {arg!r}')
            if name in ('point', 'pulse', 'zoom') and arg not in spec['targets']:
                raise ValueError(f'Unknown target {arg!r} for {scene["diagram"]}')
            if name == 'label' and arg not in ('5', '3'):
                raise ValueError('label takes 5 or 3')
            if name == 'mark' and arg not in ('during', 'after'):
                raise ValueError('mark takes during or after')
            events.append((round(at, 3), name, arg))
    return sorted(events, key=lambda e: e[0])


def plan(scene, words, duration):
    events = resolve(scene, words)
    diagram = scene['diagram']
    stage = {**DIAGRAMS[diagram]['stage'], **scene.get('stage', {})}
    pieces = []
    if diagram == 'strand':
        kinds = ['rna'] * stage['primer'] + ['dna'] * stage['strand']
    elif diagram == 'repair':
        kinds = ['mismatch' if i == stage.get('wrong') else 'dna' for i in range(stage['bottom'])]
    elif diagram == 'transcription':
        kinds = ['rna'] * stage['rna']
    else:
        kinds = []
    first_slot = stage.get('start_slot', 0)
    for i, kind in enumerate(kinds):
        pieces.append({'slot': first_slot + i, 'kind': kind, 't': -1})
    slot = first_slot + len(kinds)
    last = 0.0
    for n, (t, name, arg) in enumerate(events):
        if name == 'extend':
            limit = min([u for u, m, _ in events[n + 1:] if m in BLOCKING and u > t] + [duration - 0.4])
            count = int(arg) if arg else 99
            at = max(t + 0.35, last + STEP)
            while slot < stage['slots'] and count > 0 and at < limit:
                kind = 'rna' if diagram == 'transcription' else 'mismatch' if slot == stage.get('wrong') else 'dna'
                pieces.append({'slot': slot, 'kind': kind, 't': round(at, 3)})
                last, slot, count, at = at, slot + 1, count - 1, at + STEP
        elif name == 'primase':
            for k in range(int(stage.get('primer_build', 3))):
                at = t + 0.7 + 0.38 * k
                pieces.append({'slot': slot, 'kind': 'rna', 't': round(at, 3)})
                last, slot = at, slot + 1
        elif name == 'misadd':
            last = t + 0.3
            pieces.append({'slot': slot, 'kind': 'wrong', 't': round(last, 3)})
            slot += 1
        elif name == 'excise':
            wrong = [q for q in pieces if q['kind'] == 'wrong' and 'until' not in q]
            if wrong:
                wrong[-1]['until'] = round(t + 0.6, 3)
                slot = wrong[-1]['slot']
        elif name == 'fix':
            last = max(t + 0.35, last + 0.7)
            pieces.append({'slot': slot, 'kind': 'dna', 't': round(last, 3)})
            slot += 1
    result = {'stage': stage, 'pieces': pieces,
              'events': [{'t': t, 'action': n, 'arg': a} for t, n, a in events]}
    fill_stills(result, words, duration)
    return result


FILL_AFTER = 2.6     # a gap longer than this gets a guide gesture on the nearest spoken word


def fill_stills(p, words, duration):
    """Keep something moving (notes.md rule 5): the guide gestures in long gaps, never a new highlight."""
    for _ in range(40):
        marks = [0.0] + [t for t in change_times(p) if 0 <= t <= duration] + [duration]
        gaps = [(a, b) for a, b in zip(marks, marks[1:]) if b - a > FILL_AFTER]
        if not gaps:
            return
        a, b = gaps[0]
        inside = [w for w in words if a + 0.6 < w[1] < b - 0.4]
        if not inside:
            return  # silence (e.g. the tail): nothing to cue on
        word = min(inside, key=lambda w: abs(w[1] - (a + min(2.0, (b - a) / 2))))
        poses = [e for e in p['events'] if e['action'] in ('pose', 'point') and e['t'] <= word[1]]
        last = poses[-1]['arg'] if poses and poses[-1]['action'] == 'pose' else None
        p['events'].append({'t': round(word[1], 3), 'action': 'pose', 'arg': 'talk' if last == 'present' else 'present', 'auto': True})
        p['events'].sort(key=lambda e: e['t'])


def change_times(p):
    times = [e['t'] for e in p['events'] if e['action'] != 'stop']
    times += [q['t'] for q in p['pieces'] if q['t'] > 0] + [q['until'] for q in p['pieces'] if 'until' in q]
    return sorted(times)


def longest_still(p, duration):
    marks = [0.0] + [t for t in change_times(p) if 0 <= t <= duration] + [duration]
    return max(b - a for a, b in zip(marks, marks[1:]))


def sound_cues(p):
    cues = [(0.0, 'sting')]
    cues += [(e['t'], SOUNDS[e['action']]) for e in p['events'] if e['action'] in SOUNDS]
    cues += [(q['t'], 'click') for q in p['pieces'] if q['t'] > 0]
    out, last = [], {}
    for t, kind in sorted(cues):
        if t - last.get(kind, -9) >= 0.12:  # don't stack identical sounds
            out.append((t, kind))
            last[kind] = t
    return out
