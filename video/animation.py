"""Deterministic frame drawing for the shared guide and the molecular diagrams.

A frame is a pure function of the fixed script, the scene's measured word
timings, the narration loudness and the time within the scene. Scripts choose
*when* things happen through ``beats`` (a spoken word triggers named actions);
this module decides *how* they look, so every lesson shares one character and
one set of visual rules.
"""
import math
import os
from functools import lru_cache
from pathlib import Path

SS = 2                         # draw at 2x, then downsample: smooth edges
W, H = 960, 540
DIAGRAM_BOX = (196, 100, 960, 406)
DIAGRAM_CENTER = (578, 250)
HOME_X = 92
GROUND = 346
ZOOM = 0.75                    # close-ups magnify the diagram by 1 + ZOOM


# ---------------------------------------------------------------- utilities
def clamp(v, lo=0.0, hi=1.0):
    return lo if v < lo else hi if v > hi else v


def smooth(v):
    v = clamp(v)
    return v * v * (3 - 2 * v)


def ease_out(v):
    v = clamp(v)
    return 1 - (1 - v) ** 3


def pop(v):
    """Ease-out with a small overshoot, for things that appear."""
    v = clamp(v)
    c = 1.70158
    return 1 + (c + 1) * (v - 1) ** 3 + c * (v - 1) ** 2


def lerp(a, b, k):
    return a + (b - a) * k


def since(t, start, duration):
    return 0.0 if start is None else clamp((t - start) / duration)


def rgb(c):
    c = c.lstrip('#')
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, k):
    k = clamp(k)
    return '#%02X%02X%02X' % tuple(round(lerp(x, y, k)) for x, y in zip(rgb(a), rgb(b)))


def angle_lerp(a, b, k):
    d = (b - a + 180) % 360 - 180
    return a + d * k


def direction(deg):
    r = math.radians(deg)
    return math.cos(r), math.sin(r)


def norm(word):
    return ''.join(ch for ch in word.lower() if ch.isalnum())


@lru_cache(maxsize=512)
def font(name, size):
    from PIL import ImageFont
    folder = os.environ.get('CLIPCADEMY_FONT_DIR')
    for candidate in ([str(Path(folder) / name)] if folder else []) + [name]:
        try:
            return ImageFont.truetype(candidate, size, layout_engine=ImageFont.Layout.BASIC)
        except OSError:
            continue
    raise RuntimeError(f'Font {name} not found: install DejaVu Sans or set CLIPCADEMY_FONT_DIR')


class Pen:
    """Draws in logical 960x540 units through an optional camera (fx, fy, zoom, cx, cy)."""

    def __init__(self, draw, tpl, cam=(0, 0, 1, 0, 0)):
        self.d, self.tpl, self.cam = draw, tpl, cam

    def c(self, color):
        if color is None:
            return None
        return self.tpl['colors'].get(color, color)

    def screen(self, x, y):
        fx, fy, z, cx, cy = self.cam
        return cx + (x - fx) * z, cy + (y - fy) * z

    def p(self, x, y):
        sx, sy = self.screen(x, y)
        return sx * SS, sy * SS

    def s(self, v):
        return v * self.cam[2] * SS

    def line(self, pts, color='ink', w=5, caps=True):
        q = [self.p(*pt) for pt in pts]
        width = max(1, round(self.s(w)))
        col = self.c(color)
        self.d.line(q, fill=col, width=width, joint='curve')
        if caps and width > 2:
            r = width / 2
            for x, y in (q[0], q[-1]):
                self.d.ellipse((x - r, y - r, x + r, y + r), fill=col)

    def ellipse(self, x, y, rx, ry, fill=None, outline=None, w=3):
        (x0, y0), (x1, y1) = self.p(x - rx, y - ry), self.p(x + rx, y + ry)
        self.d.ellipse((x0, y0, x1, y1), fill=self.c(fill), outline=self.c(outline),
                       width=max(1, round(self.s(w))) if outline else 0)

    def arc(self, x, y, rx, ry, start, end, color='ink', w=2):
        (x0, y0), (x1, y1) = self.p(x - rx, y - ry), self.p(x + rx, y + ry)
        self.d.arc((x0, y0, x1, y1), start, end, fill=self.c(color), width=max(1, round(self.s(w))))

    def chord(self, x, y, rx, ry, start, end, fill='ink'):
        (x0, y0), (x1, y1) = self.p(x - rx, y - ry), self.p(x + rx, y + ry)
        self.d.chord((x0, y0, x1, y1), start, end, fill=self.c(fill))

    def rect(self, x0, y0, x1, y1, r=8, fill=None, outline=None, w=2):
        (a, b), (c, d) = self.p(x0, y0), self.p(x1, y1)
        radius = min(self.s(r), (c - a) / 2, (d - b) / 2)
        self.d.rounded_rectangle((a, b, c, d), radius=max(0, radius), fill=self.c(fill),
                                 outline=self.c(outline), width=max(1, round(self.s(w))) if outline else 0)

    def poly(self, pts, fill='ink'):
        self.d.polygon([self.p(*q) for q in pts], fill=self.c(fill))

    def text(self, x, y, s, size=20, color='ink', bold=False, anchor='la'):
        px = round(self.s(size))
        if px >= 4:
            self.d.text(self.p(x, y), s, fill=self.c(color), anchor=anchor,
                        font=font(self.tpl['font_bold' if bold else 'font'], px))

    def length(self, s, size=20, bold=False):
        return font(self.tpl['font_bold' if bold else 'font'], round(size * SS)).getlength(s) / SS

    def arrow(self, x1, y1, x2, y2, color='ink', w=5, head=13):
        a = math.atan2(y2 - y1, x2 - x1)
        bx, by = x2 - head * math.cos(a), y2 - head * math.sin(a)
        self.line([(x1, y1), (bx, by)], color, w)
        nx, ny = -math.sin(a) * head * 0.62, math.cos(a) * head * 0.62
        self.poly([(x2, y2), (bx + nx, by + ny), (bx - nx, by - ny)], color)

    def dashed(self, x0, y0, x1, y1, color='ink', w=2, dash=8, gap=6):
        length = math.hypot(x1 - x0, y1 - y0)
        steps = int(length // (dash + gap)) + 1
        for i in range(steps):
            a = i * (dash + gap) / length
            b = min(1, (i * (dash + gap) + dash) / length)
            if a < 1:
                self.line([(lerp(x0, x1, a), lerp(y0, y1, a)), (lerp(x0, x1, b), lerp(y0, y1, b))], color, w, caps=False)


# ---------------------------------------------------------------- timeline
ACTIONS = {
    # guide
    'point', 'pose', 'pulse', 'zoom', 'zoom_out', 'card', 'step',
    # replication
    'template_in', 'complement_in', 'arrows', 'arrow', 'extend', 'polymerase_try',
    'polymerase_enter', 'primase_build', 'ghost',
    # repair
    'misadd', 'excise', 'fix', 'scan', 'found', 'remove', 'replace', 'uv', 'bond',
    'distort', 'recognize', 'cut', 'reseal',
    # timing comparison
    'timeline', 'left', 'right',
}
POSES = {'talk', 'present', 'wave', 'shrug', 'think', 'thumbs', 'celebrate', 'wag', 'surprised'}


class Timeline:
    """Resolves each beat's spoken cue to the time that word is narrated."""

    def __init__(self, scene, words, duration):
        self.duration = duration
        self.events = []
        tokens = [norm(w[0]) for w in words]
        cursor = 0
        for beat in scene.get('beats', []):
            cue = beat['on']
            if cue == '^':
                at = 0.12
            else:
                phrase = [norm(x) for x in cue.split()]
                for i in range(cursor, len(tokens) - len(phrase) + 1):
                    if tokens[i:i + len(phrase)] == phrase:
                        break
                else:
                    raise ValueError(f'Beat cue {cue!r} not found in narration after word {cursor}')
                cursor = i
                at = words[i][1]
            at += beat.get('after', 0)
            for action in beat['do'] if isinstance(beat['do'], list) else [beat['do']]:
                name, _, arg = action.partition(':')
                if name not in ACTIONS:
                    raise ValueError(f'Unknown beat action {action!r}')
                if name == 'pose' and arg not in POSES:
                    raise ValueError(f'Unknown pose {arg!r}')
                self.events.append((at, name, arg))
        self.events.sort(key=lambda e: e[0])

    def first(self, name):
        return next((t for t, n, _ in self.events if n == name), None)

    def each(self, name):
        return [(t, arg) for t, n, arg in self.events if n == name]


def draw_pulses(pen, tl, targets, t):
    for start, name in tl.each('pulse'):
        age = t - start
        if 0 <= age <= 1.6 and name in targets:
            x, y, rx, ry = targets[name]
            grow = 1 + 0.12 * math.sin(age * 9) * (1 - age / 1.6)
            appear = pop(age / 0.3)
            fade = smooth((1.6 - age) / 0.45)
            color = mix('#FAF8F1', pen.c('highlight'), fade)
            pen.ellipse(x, y, (rx + 6) * grow * appear, (ry + 6) * grow * appear, outline=color, w=3.5)


# ---------------------------------------------------------------- replication
class Replication:
    """Template strand, primer/new strand, primase and DNA polymerase."""
    TY, NY = 170, 256
    LEFT, MAX = 280, 15
    POL_W, POL_H = 68, 62

    def __init__(self, tpl, scene, tl, duration):
        self.tpl, self.tl, self.duration = tpl, tl, duration
        cfg = scene.get('stage', {})
        self.primer_label = cfg.get('primer_label', True)
        self.t_template = tl.first('template_in') if cfg.get('template') == 'draw' else None
        self.nts = []  # (kind, attach time, flies in)
        hidden = cfg.get('complement') == 'hidden'
        t_c = tl.first('complement_in')
        initial = ['rna'] * cfg.get('primer', 0) + ['dna'] * cfg.get('dna', 0)
        for i, kind in enumerate(initial):
            at = (t_c + 0.9 * (i + 1) / len(initial)) if hidden else -1
            self.nts.append((kind, at, False))
        self.t_primase = tl.first('primase_build')
        self.primase_stay = cfg.get('primase_stay', False)
        if self.t_primase is not None:
            arrive = self.t_primase + 0.8
            for i in range(cfg.get('build', 5)):
                self.nts.append(('rna', arrive + 0.38 * (i + 1), False))
            self.primase_done = arrive + 0.38 * cfg.get('build', 5)
        self.t_try = tl.first('polymerase_try')
        self.t_enter = tl.first('polymerase_enter')
        self.pol_from_start = cfg.get('polymerase', False)
        t_ext = tl.first('extend')
        if t_ext is not None:
            start = t_ext + 0.3
            if self.t_enter is not None:
                start = max(start, self.t_enter + 1.1)
            start = max([start] + [at + 0.3 for _, at, _ in self.nts])
            remaining = self.MAX - len(self.nts)
            room = duration - 0.6 - start
            step = clamp(room / max(remaining, 1), 0.34, 0.66)
            for k in range(remaining):
                at = start + step * k
                if at > duration - 0.4:
                    break
                self.nts.append(('dna', at, True))

    def x(self, i):
        return self.LEFT + 36 * i

    def attached(self, t):
        return [n for n in self.nts if n[1] <= t]

    def end3(self, t):
        nts = self.attached(t)
        if not nts:
            return None
        e = self.x(len(nts))
        at = nts[-1][1]
        if at > 0:
            e = lerp(e - 36, e, smooth((t - at) / 0.28))
        return e

    def polymerase(self, t):
        """(x, visible) of the polymerase centre."""
        off = 1010
        end = self.end3(t)
        home = (end - 6) if end is not None else self.LEFT + 40
        if self.t_enter is not None and t >= self.t_enter:
            return lerp(off, home, smooth((t - self.t_enter) / 1.0)), True
        if self.t_try is not None and t >= self.t_try:
            a = t - self.t_try
            spot = self.LEFT + 46
            if a < 0.8:
                return lerp(off, spot, ease_out(a / 0.8)), True
            if a < 1.6:
                return spot + 4 * math.sin(a * 38) * (1 - (a - 0.8) / 0.8), True
            if a < 2.6:
                return lerp(spot, off, smooth((a - 2.2) / 0.4)), True
            return off, False
        if self.pol_from_start:
            return home, True
        return off, False

    def primase(self, t):
        if self.t_primase is None or t < self.t_primase:
            return 1010, False
        end = self.end3(t)
        arrive = self.t_primase + 0.8
        if t < arrive:
            return lerp(1010, self.LEFT + 30, ease_out((t - self.t_primase) / 0.8)), True
        x = (end - 14) if end is not None else self.LEFT + 30
        if not self.primase_stay and t > self.primase_done + 0.5:
            return lerp(x, 1040, smooth((t - self.primase_done - 0.5) / 0.9)), True
        return x, True

    def targets(self, t):
        mid = (self.TY + self.NY) / 2
        end = self.end3(t) or self.x(1)
        rna = sum(1 for k, _, _ in self.attached(t) if k == 'rna') or 5
        pol, _ = self.polymerase(t)
        pri, _ = self.primase(t)
        return {
            'template': (575, self.TY, 310, 22), 'template_3': (244, self.TY, 16, 16),
            'template_5': (900, self.TY, 16, 16),
            'complement': ((self.LEFT + end) / 2, self.NY, (end - self.LEFT) / 2 + 12, 20),
            'new_5': (244, self.NY, 16, 16), 'new_3': (end + 16, self.NY, 18, 18),
            'three_end': (end, self.NY, 22, 22),
            'primer': (self.LEFT + 18 * rna, self.NY, 18 * rna + 6, 16),
            'polymerase': (pol, mid, self.POL_W, self.POL_H), 'primase': (pri, mid, 52, 50),
            'ghost': (self.LEFT + 72, self.NY, 80, 18), 'ghost_3': (self.LEFT + 144, self.NY, 16, 16),
        }

    def blob(self, pen, x, label, fill, outline, w, h, t_wobble=0.0):
        mid = (self.TY + self.NY) / 2 + 1.5 * math.sin(t_wobble * 3)
        pen.rect(x - w, mid - h, x + w, mid + h, r=34, fill=fill, outline=outline, w=2.5)
        pen.text(x, mid, label, 14, outline, True, 'mm')

    def draw(self, pen, t):
        tpl, TY, NY = self.tpl, self.TY, self.NY
        reveal = 1.0 if self.t_template is None else smooth((t - self.t_template) / 0.9)
        # Enzymes sit behind the strands so the strands stay readable.
        px, shown = self.primase(t)
        if shown:
            self.blob(pen, px, 'Primase', '#F6E3D2', 'primer', 52, 50, t)
        x, shown = self.polymerase(t)
        if shown:
            self.blob(pen, x, 'DNA polymerase', '#D8EEE4', 'accent', self.POL_W, self.POL_H, t)
        # Template.
        right = lerp(266, 872, reveal)
        if reveal > 0:
            pen.line([(266, TY), (right, TY)], 'ink', 5)
            for i in range(self.MAX):
                cx = self.x(i) + 18
                if cx < right:
                    pen.line([(cx, TY), (cx, TY + 15)], 'ink', 3, caps=False)
            label = smooth((reveal - 0.7) / 0.3)
            if label > 0:
                col = mix('#FAF8F1', pen.c('ink'), label)
                pen.text(280, 126, tpl['labels']['template'], 20, col)
                pen.text(244, TY, '3′', 24, col, anchor='mm')
                pen.text(900, TY, '5′', 24, col, anchor='mm')
        # New strand, drawn as runs of primer RNA and DNA.
        nts = self.attached(t)
        if nts:
            runs, start = [], 0
            for i in range(1, len(nts) + 1):
                if i == len(nts) or nts[i][0] != nts[start][0]:
                    runs.append((nts[start][0], start, i))
                    start = i
            for kind, a, b in runs:
                color = 'primer' if kind == 'rna' else 'accent'
                end = self.x(b) if b < len(nts) else min(self.x(b), self.end3(t) + 0.01)
                pen.line([(self.x(a), NY), (end, NY)], color, 8, caps=False)
                for i in range(a, b):
                    kind_i, at, _ = nts[i]
                    grow = pop((t - at) / 0.3) if at > 0 else 1
                    cx = self.x(i) + 18
                    if cx < end + 1:
                        pen.line([(cx, NY), (cx, NY - 15 * grow)], color, 3, caps=False)
            end = self.end3(t)
            pen.text(244, NY, '5′', 24, anchor='mm')
            pen.text(end + 16, NY, '3′', 24, 'accent', True, 'mm')
            rna = sum(1 for k, _, _ in nts if k == 'rna')
            if self.primer_label and rna >= 3:
                pen.text(self.LEFT, NY + 30, tpl['labels']['primer'], 20, 'primer')
        # Nucleotides flying in to the 3′ end, and a flash when each joins.
        for i, (kind, at, flies) in enumerate(self.nts):
            if not flies:
                continue
            if at - 0.42 < t < at:
                k = ease_out((t - at + 0.42) / 0.42)
                tx = self.x(i)
                sx, sy = tx + 70, NY + 70
                fx = lerp(sx, tx, k)
                fy = lerp(sy, NY, k) - 26 * math.sin(math.pi * k)
                pen.line([(fx, fy), (fx + 30, fy)], 'accent', 7)
                pen.line([(fx + 15, fy), (fx + 15, fy - 14)], 'accent', 3, caps=False)
            elif at <= t < at + 0.35:
                k = (t - at) / 0.35
                pen.ellipse(self.x(i + 1), NY, 6 + 16 * k, 6 + 16 * k,
                            outline=mix(pen.c('highlight'), '#FAF8F1', k), w=3)
        # Opposite-direction arrows for the antiparallel scene.
        t_arrows = self.tl.first('arrows')
        if t_arrows is not None and t >= t_arrows:
            k = smooth((t - t_arrows) / 0.8)
            pen.arrow(830, TY - 26, lerp(830, 590, k), TY - 26, 'ink', 3, 11)
            pen.arrow(300, NY + 32, lerp(300, 520, k), NY + 32, 'accent', 3, 11)
        # Direction of growth.
        t_arrow = self.tl.first('arrow')
        if t_arrow is not None and t >= t_arrow:
            k = smooth((t - t_arrow) / 0.8)
            pen.arrow(470, 340, lerp(480, 840, k), 340, 'accent', 5)
            if k > 0.5 and pen.cam[2] < 1.02:
                pen.text(475, 356, 'New DNA grows 5′ → 3′', 23, mix('#FAF8F1', pen.c('ink'), (k - 0.5) * 2))
        # Missing start: a dashed outline where a primer would be.
        t_ghost = self.tl.first('ghost')
        if t_ghost is not None and t >= t_ghost:
            k = pop((t - t_ghost) / 0.4)
            pen.dashed(self.LEFT, NY - 14 * k, self.LEFT + 144, NY - 14 * k, 'primer', 2)
            pen.dashed(self.LEFT, NY + 10 * k, self.LEFT + 144, NY + 10 * k, 'primer', 2)
            pen.text(self.LEFT + 72, NY - 1, '?', 22 * k, 'primer', True, 'mm')
        # Polymerase finds no start to extend.
        if self.t_try is not None and self.t_try + 1.0 <= t < self.t_try + 2.9:
            a = t - self.t_try - 1.0
            k = pop(a / 0.3) * smooth((1.9 - a) / 0.3)
            cx, cy = self.LEFT + 46 + 58, TY - 4
            pen.ellipse(cx, cy, 15 * k, 15 * k, fill='#FAF8F1', outline='damage', w=3)
            r = 6 * k
            pen.line([(cx - r, cy - r), (cx + r, cy + r)], 'damage', 3.5)
            pen.line([(cx - r, cy + r), (cx + r, cy - r)], 'damage', 3.5)
        draw_pulses(pen, self.tl, self.targets(t), t)


# ---------------------------------------------------------------- repair
TOP_SEQ = 'GCTAGGATCGA'
PAIR = {'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G'}
BOT_SEQ = ''.join(PAIR[b] for b in TOP_SEQ)   # bottom[5]='C', bottom[6]='T'
SECTION = range(4, 8)


class Repair:
    """Double-stranded schematic for proofreading, mismatch repair and UV damage."""
    TOP, BOT = 180, 262

    def __init__(self, tpl, scene, tl, duration):
        self.tpl, self.tl, self.duration, self.kind = tpl, tl, duration, scene['diagram']
        cfg = scene.get('stage', {})
        f = tl.first
        self.t_misadd, self.t_excise, self.t_fix = f('misadd'), f('excise'), f('fix')
        self.t_scan, self.t_found, self.t_remove, self.t_replace = f('scan'), f('found'), f('remove'), f('replace')
        self.t_uv, self.t_bond, self.t_distort = f('uv'), f('bond'), f('distort')
        self.t_recognize, self.t_cut, self.t_reseal = f('recognize'), f('cut'), f('reseal')
        self.damaged = cfg.get('damaged', False)
        self.gap = cfg.get('gap', False)
        self.wrong = cfg.get('wrong')
        self.pol = cfg.get('polymerase', False)
        # Attach times for the growing bottom strand (proofreading only).
        self.attach = {i: -1 for i in range(cfg.get('bottom', 11))}
        t_ext = f('extend')
        if t_ext is not None:
            at = t_ext + 0.3
            for i in range(len(self.attach), 5):
                self.attach[i] = at
                at += 0.55
            if self.t_misadd is not None:
                self.t_wrong_in = max(self.t_misadd, at - 0.25)
            if self.t_fix is not None:
                at = max(self.t_fix + 0.35, (self.t_excise or 0) + 0.8)
                self.attach[5] = at
                for i in range(6, 11):
                    at += 0.55
                    if at < duration - 0.4:
                        self.attach[i] = at

    def x(self, i):
        return 300 + 54 * i

    def kink(self, t):
        if self.kind not in ('uv', 'cut'):
            return 0.0
        k = 1.0 if self.damaged else smooth((t - self.t_distort) / 0.6) if self.t_distort is not None else 0.0
        if self.t_remove is not None:
            k *= 1 - smooth((t - self.t_remove) / 0.5)
        return k

    def bottom_tiles(self, t):
        """[(slot, letter, color, dx, dy, alpha)] for the bottom strand."""
        tiles = []
        kink = self.kink(t)
        for i in range(11):
            letter, color = BOT_SEQ[i], 'accent'
            dy = -kink * (12 if i in (5, 6) else 5 if i in (4, 7) else 0)
            dx, alpha = 0.0, 1.0
            if self.kind == 'proof':
                if i not in self.attach and i != 5:
                    continue
                if i == 5:
                    wrong_in = getattr(self, 't_wrong_in', None)
                    fixed = self.attach.get(5)
                    if fixed is not None and fixed > 0 and t >= fixed - 0.35:
                        k = ease_out((t - fixed + 0.35) / 0.35)
                        tiles.append((i, letter, 'accent', 30 * (1 - k), 60 * (1 - k), k))
                    if wrong_in is not None and t >= wrong_in:
                        k = ease_out((t - wrong_in) / 0.35)
                        out = since(t, self.t_excise, 0.7)
                        if out < 1:
                            tiles.append((i, 'T', 'damage', 30 * (1 - k) + 40 * out, 60 * (1 - k) + 50 * out,
                                          k * (1 - out)))
                    continue
                at = self.attach[i]
                if at > 0:
                    if t < at - 0.35:
                        continue
                    k = ease_out((t - at + 0.35) / 0.35)
                    dx, dy, alpha = 30 * (1 - k), 60 * (1 - k), k
                tiles.append((i, letter, color, dx, dy, alpha))
                continue
            if i in SECTION and (self.gap or self.t_remove is not None):
                gone = 1.0 if self.gap else since(t, self.t_remove + 0.06 * (i - 4) if self.t_remove else None, 0.55)
                if self.t_replace is not None and t >= self.t_replace + 0.35 * (i - 4):
                    k = ease_out((t - self.t_replace - 0.35 * (i - 4)) / 0.35)
                    tiles.append((i, letter, 'accent', 0, 60 * (1 - k), k))
                    continue
                if gone >= 1:
                    continue
                if i == self.wrong:
                    letter = 'T'
                    color = 'damage' if self.t_found is not None and t >= self.t_found else 'accent'
                elif self.bonded(t) and i in (5, 6):
                    color = 'damage'
                tiles.append((i, letter, color, 30 * gone, dy + 50 * gone, 1 - gone))
                continue
            if i == self.wrong:
                letter = 'T'
                color = 'damage' if self.t_found is not None and t >= self.t_found else 'accent'
            if self.bonded(t) and i in (5, 6):
                color = 'damage'
            tiles.append((i, letter, color, dx, dy, alpha))
        return tiles

    def bonded(self, t):
        return self.damaged or (self.t_bond is not None and t >= self.t_bond)

    def end(self, t):
        """Visual 3′ end of the growing strand (proofreading)."""
        e = self.x(0) - 27
        wrong_in = getattr(self, 't_wrong_in', None)
        for i in range(11):
            at = self.attach.get(i)
            if i == 5 and wrong_in is not None and t >= wrong_in and (at is None or t < at):
                e = lerp(self.x(4) + 27, self.x(5) + 27, smooth((t - wrong_in) / 0.3))
                if self.t_excise is not None and t >= self.t_excise:
                    e = lerp(self.x(5) + 27, self.x(4) + 27, smooth((t - self.t_excise) / 0.5))
                return e
            if at is None or t < at:
                break
            e = lerp(self.x(i) - 27, self.x(i) + 27, smooth((t - at) / 0.3)) if at > 0 else self.x(i) + 27
        return e

    def protein_x(self, t):
        target = self.x(5.5 if self.kind in ('uv', 'cut') else 5)
        if self.t_scan is not None and t >= self.t_scan:
            arrive = self.t_found if self.t_found is not None else self.t_scan + 2.5
            return lerp(180, target, clamp((t - self.t_scan) / max(arrive - self.t_scan, 0.4))), True
        if self.t_recognize is not None and t >= self.t_recognize:
            return lerp(170, target, ease_out((t - self.t_recognize) / 1.0)), True
        return 0, False

    def targets(self, t):
        mid = (self.TOP + self.BOT) / 2
        dmg = self.x(5.5) if self.kind in ('uv', 'cut') else self.x(5)
        px, _ = self.protein_x(t)
        e = self.end(t)
        return {
            'damage': (dmg, self.BOT, 54 if self.kind in ('uv', 'cut') else 24, 22),
            'three_end': (e, self.BOT, 22, 22), 'polymerase': (e - 30, mid, 70, 66),
            'protein': (px, mid, 80, 66), 'gap': (self.x(5.5), self.BOT, 118, 26),
            'cuts': (self.x(5.5), self.BOT + 22, 124, 14), 'backbone': (self.x(5.5), self.BOT + 22, 130, 12),
        }

    def draw(self, pen, t):
        TOP, BOT = self.TOP, self.BOT
        mid = (TOP + BOT) / 2
        pen.text(262, 118, 'DNA strands · schematic', 20)
        # Proteins behind the strands.
        if self.pol:
            e = self.end(t)
            jig = 3 * math.sin(t * 40) * (1 - since(t, getattr(self, 't_wrong_in', None), 0.9)) \
                if getattr(self, 't_wrong_in', None) is not None and getattr(self, 't_wrong_in') <= t else 0
            pen.rect(e - 96 + jig, mid - 64, e + 36 + jig, mid + 64, r=34, fill='#D8EEE4', outline='accent', w=2.5)
            pen.text(e - 30 + jig, mid, 'DNA polymerase', 13, 'accent', True, 'mm')
        px, shown = self.protein_x(t)
        if shown:
            pen.rect(px - 80, mid - 62, px + 80, mid + 62, r=34, fill='#E6E1F2', outline='protein', w=2.5)
            pen.text(px, mid, 'Repair proteins', 13, 'protein', True, 'mm')
        # Top strand: always complete.
        pen.line([(274, TOP - 22), (866, TOP - 22)], 'ink', 4)
        for i, letter in enumerate(TOP_SEQ):
            x = self.x(i)
            pen.line([(x, TOP - 22), (x, TOP - 14)], 'ink', 3, caps=False)
            pen.rect(x - 15, TOP - 15, x + 15, TOP + 15, r=6, fill='#FFFFFF', outline='ink', w=2)
            pen.text(x, TOP, letter, 18, 'ink', True, 'mm')
        # Bottom strand backbone with cuts, gaps and reseal.
        kink = self.kink(t)
        tiles = self.bottom_tiles(t)
        present = {i for i, *_ in tiles}
        if self.kind == 'proof':
            if tiles:
                pen.line([(274, BOT + 22), (self.end(t), BOT + 22)], 'accent', 4)
        else:
            cut = self.gap or (self.t_cut is not None and t >= self.t_cut)
            sealed = self.t_reseal is not None and t >= self.t_reseal + 0.3
            g = 0 if (sealed or not cut) else 5
            a, b = self.x(3.5), self.x(7.5)
            def bump(x):
                return BOT + 22 - kink * 11 * math.exp(-((x - self.x(5.5)) / 70) ** 2)
            pen.line([(274, BOT + 22), (a - g, BOT + 22)], 'accent', 4)
            pen.line([(b + g, BOT + 22), (866, BOT + 22)], 'accent', 4)
            section = [i for i in SECTION if i in present]
            if section:
                if self.t_replace is not None and t >= self.t_replace:
                    reach = lerp(a, b, clamp((t - self.t_replace) / (0.35 * 4 + 0.35)))
                else:
                    reach = b
                pts = [(x, bump(x)) for x in [a + g + (reach - a - g) * j / 12 for j in range(13)]]
                if reach > a + g + 1:
                    pen.line(pts, 'accent', 4)
            if cut and not sealed:
                k = pop(since(t, self.t_cut, 0.3)) if not self.gap else 1
                for cx in (a, b):
                    pen.line([(cx - 7 * k, BOT + 10), (cx + 7 * k, BOT + 34)], 'damage', 3)
            if self.t_reseal is not None and self.t_reseal <= t < self.t_reseal + 1.0:
                k = (t - self.t_reseal) / 1.0
                for cx in (a, b):
                    for j in range(6):
                        d = direction(j * 60 + 20)
                        r0, r1 = 6 + 10 * k, 12 + 14 * k
                        pen.line([(cx + d[0] * r0, BOT + 22 + d[1] * r0), (cx + d[0] * r1, BOT + 22 + d[1] * r1)],
                                 mix(pen.c('highlight'), '#FAF8F1', k), 2.5, caps=False)
        for i, letter, color, dx, dy, alpha in tiles:
            x, y = self.x(i) + dx, BOT + dy
            ink = mix('#FAF8F1', pen.c(color), alpha)
            rung = mix('#FAF8F1', '#9DB0A8', alpha)
            if dx == 0 and dy > -14 and alpha > 0.6:
                pen.line([(x, TOP + 16), (x, y - 16)], rung, 2, caps=False)
            pen.line([(x, y + 14), (x, y + 22)], ink, 3, caps=False)
            pen.rect(x - 15, y - 15, x + 15, y + 15, r=6, fill=mix('#FAF8F1', '#FFFFFF', alpha), outline=ink, w=2)
            pen.text(x, y, letter, 18, ink, True, 'mm')
        # Covalent bond between the adjacent damaged bases.
        t5 = next((tile for tile in tiles if tile[0] == 5), None)
        if self.bonded(t) and 6 in present and t5 and t5[3] == 0 and t5[5] > 0.9:
            k = 1 if self.damaged else pop((t - self.t_bond) / 0.35)
            y = BOT + t5[4]
            pen.line([(self.x(5) + 15, y), (lerp(self.x(5) + 15, self.x(6) - 15, k), y)], 'damage', 5)
        # UV rays.
        if self.t_uv is not None and self.t_uv <= t < self.t_uv + 1.6:
            a = t - self.t_uv
            reach = ease_out(a / 0.6)
            fade = smooth((1.6 - a) / 0.5)
            col = mix('#FAF8F1', pen.c('uv'), fade)
            for ox in (-18, 18):
                x0, y0, x1, y1 = self.x(5.5) + ox * 3, 104, self.x(5.5) + ox, BOT - 22
                pts = []
                for j in range(9):
                    k = j / 8 * reach
                    pts.append((lerp(x0, x1, k) + (7 if j % 2 else -7), lerp(y0, y1, k)))
                pen.line(pts, col, 3)
            if a < 0.6:
                pen.text(self.x(5.5) + 70, 112, 'UV', 20, col, True)
        if self.kind == 'proof' and tiles:
            pen.text(256, BOT, '5′', 22, anchor='mm')
            pen.text(self.end(t) + 16, BOT, '3′', 22, 'accent', True, 'mm')
        draw_pulses(pen, self.tl, self.targets(t), t)


# ---------------------------------------------------------------- timing comparison
class Timing:
    def __init__(self, tpl, scene, tl, duration):
        self.tpl, self.tl = tpl, tl
        self.t_line, self.t_left, self.t_right = tl.first('timeline'), tl.first('left'), tl.first('right')

    def targets(self, t):
        return {'left_panel': (400, 272, 140, 62), 'right_panel': (740, 272, 140, 62),
                'left_time': (345, 136, 92, 18), 'right_time': (706, 136, 116, 18),
                'left_protein': (420, 304, 86, 14), 'right_protein': (760, 304, 86, 14)}

    def panel(self, pen, x, k, title, name, protein, fill, outline):
        if k <= 0:
            return
        s = pop(k)
        cam = Pen(pen.d, pen.tpl, (x + 140, 272, s, x + 140, 272))
        cam.rect(x, 210, x + 280, 334, r=16, fill='#FFFFFF', outline=outline, w=2.5)
        cam.rect(x + 18, 238, x + 72, 306, r=22, fill=fill, outline=outline, w=2.5)
        cam.text(x + 90, 248, name, 22, 'ink', True)
        cam.text(x + 90, 296, protein, 19, outline)

    def draw(self, pen, t):
        k = smooth(since(t, self.t_line, 0.9)) if self.t_line is not None else 1
        pen.arrow(260, 176, lerp(262, 880, k), 176, 'accent', 5)
        for x, at, label in ((262, self.t_left, 'During copying'), (600, self.t_right, 'After replication')):
            a = since(t, at, 0.4)
            if a > 0:
                pen.ellipse(x + 10 if x < 500 else x + 10, 176, 7 * pop(a), 7 * pop(a), fill='accent')
                pen.text(x, 124, label, 24, mix('#FAF8F1', pen.c('ink'), a), True)
        self.panel(pen, 260, since(t, self.t_left, 0.45), 'left', 'Proofreading', 'DNA polymerase', '#D8EEE4', 'accent')
        self.panel(pen, 600, since(t, self.t_right, 0.45), 'right', 'Mismatch repair', 'Repair proteins', '#E6E1F2', 'protein')
        draw_pulses(pen, self.tl, self.targets(t), t)


DIAGRAMS = {k: Replication for k in ('antiparallel', 'growth', 'primer', 'bare')}
DIAGRAMS.update({k: Repair for k in ('proof', 'mismatch', 'uv', 'cut', 'reseal')})
DIAGRAMS['timing'] = Timing


# ---------------------------------------------------------------- overlays
class Overlay:
    """Screen-space summary cards and step chips, triggered by beats."""

    def __init__(self, tl):
        self.cards = tl.each('card')
        self.steps = tl.each('step')

    def draw(self, pen, t):
        for i, (at, text) in enumerate(self.cards):
            if t < at:
                continue
            k = pop((t - at) / 0.4)
            y = 304 + 46 * i
            size = 18
            while pen.length(text, size, True) > 380 and size > 13:
                size -= 1
            w = pen.length(text, size, True) + 58
            x = 900 - w
            cam = Pen(pen.d, pen.tpl, (x, y + 19, k, x + 30 * (1 - k), y + 19))
            cam.rect(x, y, x + w, y + 38, r=19, fill='#FFFFFF', outline='accent', w=2)
            cam.ellipse(x + 20, y + 19, 10, 10, fill='accent')
            cam.line([(x + 15, y + 19), (x + 19, y + 23), (x + 26, y + 14)], '#FFFFFF', 2.5)
            cam.text(x + 38, y + 19, text, size, 'ink', True, 'lm')
        if self.steps and t >= self.steps[0][0]:
            x = 262
            for i, (at, text) in enumerate(self.steps):
                on = t >= at
                k = pop((t - at) / 0.35) if on else 0
                w = pen.length(text, 18, True) + 32
                cam = Pen(pen.d, pen.tpl, (x + w / 2, 340, 1 + 0.12 * math.sin(math.pi * clamp(k)), x + w / 2, 340))
                cam.rect(x, 321, x + w, 359, r=19, fill='accent' if on else '#FFFFFF', outline='accent', w=2)
                cam.text(x + w / 2, 340, text, 18, '#FFFFFF' if on else '#9DB0A8', True, 'mm')
                x += w
                if i < 3:
                    pen.arrow(x + 6, 340, x + 30, 340, 'accent' if on else '#C7D3CD', 3, 9)
                    x += 36


# ---------------------------------------------------------------- the guide
TALK = {'r': (74, 96), 'l': (106, 92), 'hand': 'open', 'face': 'smile'}
POSE_TABLE = {
    'talk': TALK,
    'present': {'r': (16, -14), 'l': (106, 92), 'hand': 'open', 'face': 'smile'},
    'wave': {'r': (-42, -100), 'l': (106, 92), 'hand': 'open', 'face': 'big'},
    'shrug': {'r': (40, -38), 'l': (140, -142), 'hand': 'open', 'face': 'flat', 'tilt': 9, 'bubble': '?'},
    'think': {'r': (64, -114), 'l': (100, 14), 'hand': 'open', 'face': 'think', 'tilt': -7, 'bubble': '?'},
    'thumbs': {'r': (-24, -82), 'l': (106, 92), 'hand': 'thumb', 'face': 'big'},
    'celebrate': {'r': (-48, -72), 'l': (-132, -108), 'hand': 'open', 'face': 'big'},
    'wag': {'r': (-8, -86), 'l': (126, 40), 'hand': 'point', 'face': 'flat'},
    'surprised': {'r': (40, -58), 'l': (140, -122), 'hand': 'open', 'face': 'o', 'bubble': '!'},
}
TRANSIENT = {'wave', 'shrug', 'think', 'thumbs', 'celebrate', 'wag', 'surprised'}


class GuideTrack:
    """Turns pose/point beats into a smoothly blended pose for any time."""

    def __init__(self, tl, first, last, duration):
        ev = [(0.9, 'wave', '')] if first else []
        for t, name, arg in tl.events:
            if name == 'point':
                ev.append((t, 'point', arg))
            elif name == 'pose':
                ev.append((t, arg, ''))
        if last and not any(p == 'thumbs' for _, p, _ in ev):
            ev.append((max(duration - 2.4, 0.5), 'thumbs', ''))
        ev.sort(key=lambda e: e[0])
        out = []
        for i, (t, pose, arg) in enumerate(ev):
            out.append((t, pose, arg))
            nxt = ev[i + 1][0] if i + 1 < len(ev) else duration + 10
            if pose in TRANSIENT and nxt - t > 2.2 and not (last and i == len(ev) - 1):
                out.append((t + 2.0, 'talk', ''))
        if not last and out and out[-1][1] != 'talk':
            out.append((max(duration - 0.6, out[-1][0] + 0.4), 'talk', ''))
        self.events = sorted(out, key=lambda e: e[0])
        self.first, self.duration = first, duration

    def resolve(self, pose, arg, t, shoulder, target_at, energy):
        if pose == 'point':
            tx, ty = target_at(arg)
            a = clamp(math.degrees(math.atan2(ty - shoulder[1], tx - shoulder[0])), -55, 62)
            return {'r': (a - 12, a), 'l': (126, 40), 'hand': 'point', 'face': 'smile', 'look': (tx, ty)}
        p = dict(POSE_TABLE[pose])
        r1, r2 = p['r']
        if pose == 'wave':
            r2 += 26 * math.sin(t * 9)
        elif pose == 'wag':
            r2 += 15 * math.sin(t * 11)
        elif pose == 'talk':
            beat = energy * (0.55 + 0.45 * math.sin(t * 3.1))
            r1, r2 = r1 - 10 * beat, r2 - 52 * beat
        p['r'] = (r1, r2)
        return p

    def state(self, t, target_at, energy):
        x = HOME_X
        walking = False
        if self.first and t < 1.15:
            x = lerp(-60, HOME_X, smooth(t / 1.15))
            walking = True
        hip_y = GROUND - 57 + 1.3 * math.sin(t * 2.4)
        shoulder = (x + 3, hip_y - 60)
        idx = -1
        for i, (at, _, _) in enumerate(self.events):
            if at <= t:
                idx = i
        cur = self.events[idx] if idx >= 0 else (0, 'talk', '')
        prev = self.events[idx - 1] if idx >= 1 else (0, 'talk', '')
        a = self.resolve(prev[1], prev[2], t, shoulder, target_at, energy)
        b = self.resolve(cur[1], cur[2], t, shoulder, target_at, energy)
        k = smooth((t - cur[0]) / 0.32) if idx >= 0 else 1
        pose = {
            'r': tuple(angle_lerp(u, v, k) for u, v in zip(a['r'], b['r'])),
            'l': tuple(angle_lerp(u, v, k) for u, v in zip(a['l'], b['l'])),
            'hand': b['hand'] if k > 0.5 else a['hand'],
            'face': b['face'] if k > 0.4 else a['face'],
            'tilt': lerp(a.get('tilt', 0), b.get('tilt', 0), k),
            'lean': lerp(5 if prev[1] == 'point' else 0, 5 if cur[1] == 'point' else 0, k),
            'look': b.get('look') if k > 0.3 else a.get('look'),
            'bubble': b.get('bubble'), 'bubble_k': since(t, cur[0], 0.35) if b.get('bubble') else 0,
        }
        if walking:
            phase = t * 10
            pose['legs'] = ((90 + 26 * math.sin(phase), 98 + 22 * math.sin(phase) + 10),
                            (90 - 26 * math.sin(phase), 98 - 22 * math.sin(phase) + 10))
        else:
            pose['legs'] = ((104, 100), (76, 80))
        pose.update(x=x, hip_y=hip_y, energy=energy,
                    blink=(t + 0.7 * (x % 3)) % 3.4 < 0.12, t=t)
        return pose


def draw_guide(pen, g):
    x, hip_y = g['x'], g['hip_y']
    hip = (x, hip_y)
    lean = math.radians(-90 + g['lean'])
    neck = (x + 76 * math.cos(lean), hip_y + 76 * math.sin(lean))
    shoulder = (lerp(hip[0], neck[0], 0.78), lerp(hip[1], neck[1], 0.78))
    head = (neck[0] + 27 * math.cos(lean), neck[1] + 27 * math.sin(lean))
    for thigh, shin in g['legs']:
        knee = (hip[0] + 29 * direction(thigh)[0], hip[1] + 29 * direction(thigh)[1])
        foot = (knee[0] + 29 * direction(shin)[0], knee[1] + 29 * direction(shin)[1])
        pen.line([hip, knee, foot, (foot[0] + 9, foot[1])], 'ink', 5)
    pen.line([hip, neck], 'ink', 5)
    hands = []
    for side in ('l', 'r'):
        a1, a2 = g[side]
        elbow = (shoulder[0] + 33 * direction(a1)[0], shoulder[1] + 33 * direction(a1)[1])
        hand = (elbow[0] + 31 * direction(a2)[0], elbow[1] + 31 * direction(a2)[1])
        pen.line([shoulder, elbow, hand], 'ink', 5)
        hands.append((side, hand, a2))
    for side, hand, a2 in hands:
        style = g['hand'] if side == 'r' else 'open'
        if style == 'point':
            d = direction(a2)
            pen.line([hand, (hand[0] + 11 * d[0], hand[1] + 11 * d[1])], 'ink', 3.5)
            pen.ellipse(*hand, 5, 5, fill='ink')
        elif style == 'thumb':
            pen.ellipse(*hand, 6.5, 6.5, fill='ink')
            pen.line([(hand[0], hand[1] - 2), (hand[0] + 1, hand[1] - 13)], 'ink', 4)
        else:
            pen.ellipse(*hand, 5, 5, fill='ink')
    # Bow tie: the guide's one accent-colored detail, the same in every clip.
    bx, by = neck[0], neck[1] + 4
    pen.poly([(bx, by), (bx - 10, by - 6), (bx - 10, by + 6)], 'accent')
    pen.poly([(bx, by), (bx + 10, by - 6), (bx + 10, by + 6)], 'accent')
    # Head and face, rotated together by the tilt.
    hx, hy = head
    tilt = math.radians(g['tilt'])
    def at(dx, dy):
        return (hx + dx * math.cos(tilt) - dy * math.sin(tilt), hy + dx * math.sin(tilt) + dy * math.cos(tilt))
    pen.ellipse(hx, hy, 25, 25, fill='#FAF8F1', outline='ink', w=4)
    lx, ly = 1.5, 0.0
    if g['look']:
        tx, ty = g['look']
        d = math.hypot(tx - hx, ty - hy) or 1
        lx, ly = 2.6 * (tx - hx) / d, 2.6 * (ty - hy) / d
    for side in (-1, 1):
        ex, ey = at(side * 9 + lx, -4 + ly)
        if g['blink']:
            pen.line([(ex - 3.5, ey), (ex + 3.5, ey)], 'ink', 2.2)
        else:
            pen.ellipse(ex, ey, 2.9, 2.9, fill='ink')
    face = g['face']
    brow = {'o': -4, 'big': -2, 'flat': -1}.get(face, 0)
    for side in (-1, 1):
        inner = 3 if face == 'flat' else (-2 if (face == 'think' and side == 1) else 0)
        outer = 3 if (face == 'think' and side == -1) else 0
        pen.line([at(side * 13, -13 + brow + outer), at(side * 5, -14 + brow - inner)], 'ink', 2.2)
    mx, my = at(lx * 0.4, 10)
    open_ = clamp(g['energy'] * 1.5)
    if open_ > 0.12 and face != 'o':
        pen.ellipse(mx, my + 1, 5.2 - 1.5 * open_ + (2 if face == 'big' else 0), 1.6 + 5 * open_, fill='ink')
    elif face == 'big':
        pen.chord(mx, my - 2, 8, 7, 0, 180, 'ink')
    elif face == 'smile':
        pen.arc(mx, my - 4, 8, 6, 25, 155, 'ink', 2.2)
    elif face == 'o':
        pen.ellipse(mx, my + 1, 3.5 + 1.5 * open_, 4 + 2 * open_, outline='ink', w=2)
    elif face == 'think':
        pen.line([at(-4 + lx * 0.4, 11), at(5 + lx * 0.4, 9)], 'ink', 2.2)
    else:
        pen.line([at(-6 + lx * 0.4, 10), at(6 + lx * 0.4, 10)], 'ink', 2.2)
    if g['bubble'] and g['bubble_k'] > 0:
        k = pop(g['bubble_k'])
        cx, cy = hx + 30, hy - 34
        pen.ellipse(cx, cy, 14 * k, 14 * k, fill='#FFFFFF', outline='ink', w=2)
        pen.text(cx, cy + 1, g['bubble'], 19 * k, 'damage' if g['bubble'] == '!' else 'ink', True, 'mm')


# ---------------------------------------------------------------- captions
def caption_chunks(words):
    """Group words (text, start, end) into short caption lines, breaking at sentence ends."""
    chunks, cur = [], []
    for i, w in enumerate(words):
        cur.append(w)
        if i + 1 < len(words) and norm(words[i + 1][0]) == 'prime':
            continue  # keep "five prime" / "three prime" on one line
        if len(cur) >= 10 or (w[0][-1] in '.:;?!' and len(cur) >= 3) or (w[0][-1] == ',' and len(cur) >= 7):
            chunks.append(cur)
            cur = []
    if cur:
        if chunks and len(cur) < 3:
            chunks[-1] += cur
        else:
            chunks.append(cur)
    return chunks


class SceneArt:
    def __init__(self, tpl, script, index, words, duration):
        scene = script['scenes'][index]
        self.tpl, self.script, self.index, self.scene = tpl, script, index, scene
        self.duration = duration
        self.tl = Timeline(scene, words, duration)
        self.diagram = DIAGRAMS[scene['diagram']](tpl, scene, self.tl, duration)
        self.guide = GuideTrack(self.tl, index == 0, index == len(script['scenes']) - 1, duration)
        self.overlay = Overlay(self.tl)
        self.chunks = caption_chunks(words)
        zooms = [(t, n, arg) for t, n, arg in self.tl.events if n in ('zoom', 'zoom_out')]
        if zooms and zooms[-1][1] == 'zoom':
            zooms.append((duration - 0.8, 'zoom_out', ''))
        self.zooms, level = [], 0.0
        for t, name, arg in zooms:
            if self.zooms:
                pt, pfrom, pto, _ = self.zooms[-1]
                level = lerp(pfrom, pto, smooth((t - pt) / 0.7))
            self.zooms.append((t, level, 1.0 if name == 'zoom' else 0.0, arg))

    def camera(self, t):
        seg = None
        focus = None
        for z in self.zooms:
            if z[0] <= t:
                seg = z
                if z[3]:
                    focus = z[3]
        if seg is None or focus is None:
            return (0, 0, 1, 0, 0)
        k = lerp(seg[1], seg[2], smooth((t - seg[0]) / 0.7))
        if k <= 0.001:
            return (0, 0, 1, 0, 0)
        fx, fy = self.diagram.targets(t)[focus][:2]
        return (fx, fy, 1 + ZOOM * k, lerp(fx, DIAGRAM_CENTER[0], k), lerp(fy, DIAGRAM_CENTER[1], k))

    def frame(self, t, energy, clip_progress):
        from PIL import Image, ImageDraw
        tpl = self.tpl
        bg = tpl['colors']['background']
        base = Image.new('RGB', (W * SS, H * SS), bg)
        layer = Image.new('RGB', (W * SS, H * SS), bg)
        cam = self.camera(t)
        dpen = Pen(ImageDraw.Draw(layer), tpl, cam)
        self.diagram.draw(dpen, t)
        box = tuple(v * SS for v in DIAGRAM_BOX)
        region = layer.crop(box)
        fade = smooth(t / 0.3)
        if fade < 1:
            region = Image.blend(Image.new('RGB', region.size, bg), region, fade)
        base.paste(region, box)
        pen = Pen(ImageDraw.Draw(base), tpl)
        topic = 'DNA replication' if self.script['topic_id'] == 'dna_replication' else 'DNA repair'
        pen.text(32, 20, 'Clipcademy · ' + topic, 20)
        k = smooth(t / 0.45)
        pen.text(32, 58 + 10 * (1 - k), self.scene['title'], 32, mix(bg, tpl['colors']['ink'], k), True)
        self.overlay.draw(pen, t)
        targets = self.diagram.targets(t)
        def target_at(name):
            x, y = targets[name][:2] if name in targets else DIAGRAM_CENTER
            return dpen.screen(x, y)
        draw_guide(pen, self.guide.state(t, target_at, energy))
        # Captions: the current short line, with the spoken word highlighted.
        pen.rect(0, 410, 960, 505, r=0, fill='#E9EEE8')
        chunk = self.chunks[0]
        for c in self.chunks:
            if c[0][1] <= t:
                chunk = c
        x, y = 32, 422
        for i, (word, start, _) in enumerate(chunk):
            w = pen.length(word + ' ', 23)
            if x + w > 928:
                x, y = 32, y + 30
            nxt = chunk[i + 1][1] if i + 1 < len(chunk) else chunk[-1][2]
            speaking = start <= t < nxt
            color = 'accent' if speaking else ('ink' if t >= start else '#7D8C86')
            pen.text(x, y, word, 23, color)
            if speaking:
                pen.line([(x, y + 28), (x + pen.length(word, 23), y + 28)], 'accent', 2.5, caps=False)
            x += w
        pen.rect(0, 503, 960 * clamp(clip_progress), 506, r=0, fill='accent')
        pen.text(32, 513, 'Sources: ' + ', '.join(self.script['source_refs']) + ' · Review copy', 16)
        pen.text(928, 513, f'{self.index + 1} / {len(self.script["scenes"])}', 16, anchor='ra')
        return base.reduce(SS)
