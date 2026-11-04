import React from 'react';
import {clamp, easeOut, lerp, pop, since, smooth} from './anim';
import {BOARD, C, FONT} from './theme';
import {Beat, ClipProps, Point, Target} from './types';

// Board-local layout (566 x 294). Template on top, new strand below, base pairs between.
const SLOT0 = 58, STEP = 46, BW = 40, BH = 30;
const TY = 82, NY = 182;
const slotX = (i: number) => SLOT0 + STEP * i;
const CENTER: Point = [283, 147];
const ZOOM = 0.8;

const first = (events: Beat[], action: string, arg?: string) =>
  events.find((e) => e.action === action && (arg === undefined || e.arg === arg))?.t;

export class StrandScene {
  constructor(private p: ClipProps) {}

  count(t: number) {
    return this.p.stage.strand + this.p.attach.filter((a) => a <= t).length;
  }

  /** Right edge of the new strand, sliding smoothly as each piece clicks on. */
  end(t: number) {
    const n = this.count(t);
    const last = this.p.attach.filter((a) => a <= t).pop();
    const e = slotX(n - 1) + BW;
    return last === undefined ? e : lerp(e - STEP, e, smooth((t - last) / 0.22));
  }

  targets(t: number): Record<string, Target> {
    const e = this.end(t);
    return {
      template: {x: 284, y: TY + BH / 2, rx: 250, ry: 26},
      new_5: {x: 30, y: NY + BH / 2, rx: 24, ry: 24},
      new_3: {x: e + 22, y: NY + BH / 2, rx: 26, ry: 26},
      strand: {x: (SLOT0 + e) / 2, y: NY + BH / 2, rx: (e - SLOT0) / 2 + 18, ry: 26},
      ghost: {x: slotX(0) + 2 * STEP - 3, y: NY + BH / 2, rx: 2 * STEP + 8, ry: 26},
      arrow: {x: 300, y: 262, rx: 150, ry: 22},
    };
  }

  /** Close-up: k = 0 (whole board) .. 1 (magnified around the focus target). */
  camera(t: number) {
    const zooms = this.p.events.filter((e) => e.action === 'zoom' || e.action === 'zoom_out');
    let level = 0, from = 0, to = 0, start = -1, focus: string | undefined;
    for (const z of zooms) {
      if (z.t > t) break;
      level = start < 0 ? 0 : lerp(from, to, smooth((z.t - start) / 0.6));
      from = level;
      to = z.action === 'zoom' ? 1 : 0;
      start = z.t;
      if (z.arg) focus = z.arg;
    }
    const k = start < 0 ? 0 : lerp(from, to, smooth((t - start) / 0.6));
    const f = focus ? this.targets(t)[focus] : undefined;
    if (!f || k < 0.001) return {k: 0, s: 1, f: CENTER, c: CENTER};
    const fp: Point = [f.x, f.y];
    return {k, s: 1 + ZOOM * k, f: fp, c: [lerp(fp[0], CENTER[0], k), lerp(fp[1], CENTER[1], k)] as Point};
  }

  /** Screen position of a board-local point, after the close-up transform. */
  toScreen(t: number, [x, y]: Point): Point {
    const {s, f, c} = this.camera(t);
    return [BOARD.x + c[0] + (x - f[0]) * s, BOARD.y + c[1] + (y - f[1]) * s];
  }

  render(t: number) {
    const {events, attach} = this.p;
    const {s, f, c} = this.camera(t);
    const n = this.count(t);
    const e = this.end(t);
    const tGhost = first(events, 'ghost');
    const fade = 1 - since(t, tGhost, 0.5);
    const labelAt = (which: string) => {
      const at = first(events, 'label', which);
      return at === undefined ? 1 : pop((t - at) / 0.35);
    };
    const blocks: React.ReactNode[] = [];
    for (let i = 0; i < this.p.stage.slots; i++) {
      blocks.push(<rect key={`t${i}`} x={slotX(i)} y={TY} width={BW} height={BH} rx={8} fill={C.template} />);
      if (i < n) {
        const at = attach[i - this.p.stage.strand];
        const squash = at !== undefined ? 1 - 0.18 * Math.sin(Math.PI * clamp((t - at) / 0.2)) : 1;
        blocks.push(
          <g key={`n${i}`} opacity={fade}>
            <line x1={slotX(i) + BW / 2} y1={TY + BH + 2} x2={slotX(i) + BW / 2} y2={NY - 2} stroke={C.rung} strokeWidth={4} />
            <rect x={slotX(i)} y={NY + BH * (1 - squash)} width={BW} height={BH * squash} rx={8} fill={C.dna} />
          </g>,
        );
      }
    }
    // Pieces flying in to the 3' end, and a flash when each one clicks on.
    const flying = attach.map((at, j) => {
      const i = this.p.stage.strand + j;
      if (t >= at - 0.45 && t < at) {
        const k = easeOut((t - at + 0.45) / 0.45);
        const x = lerp(slotX(i) + 90, slotX(i), k);
        const y = lerp(NY + 120, NY, k) - 40 * Math.sin(Math.PI * k);
        return <rect key={`f${j}`} x={x} y={y} width={BW} height={BH} rx={8} fill={C.dna} transform={`rotate(${-25 * (1 - k)} ${x + BW / 2} ${y + BH / 2})`} />;
      }
      if (t >= at && t < at + 0.35) {
        const k = (t - at) / 0.35;
        return <circle key={`c${j}`} cx={slotX(i) + BW} cy={NY + BH / 2} r={8 + 22 * k} stroke={C.highlight} strokeWidth={5} opacity={1 - k} fill="none" />;
      }
      return null;
    });
    // A piece tries the 5' end and bounces off.
    const tBounce = first(events, 'bounce');
    let bounce: React.ReactNode = null;
    if (tBounce !== undefined && t >= tBounce && t < tBounce + 1.4) {
      const a = t - tBounce;
      const hit: Point = [slotX(-1) + 4, NY];
      let x: number, y: number, op = 1;
      if (a < 0.5) {
        const k = easeOut(a / 0.5);
        x = lerp(hit[0] + 20, hit[0], k);
        y = lerp(NY + 120, NY, k) - 30 * Math.sin(Math.PI * k);
      } else {
        const k = (a - 0.5) / 0.9;
        x = hit[0] - 60 * k;
        y = NY + 140 * k * k - 50 * k;
        op = 1 - k;
      }
      const xk = a >= 0.45 && a < 1.2 ? pop((a - 0.45) / 0.25) : 0;
      bounce = (
        <g>
          <rect x={x} y={y} width={BW} height={BH} rx={8} fill={C.dna} opacity={op} transform={`rotate(${a > 0.5 ? -40 * (a - 0.5) : 0} ${x + BW / 2} ${y + BH / 2})`} />
          {xk > 0 && (
            <g transform={`translate(${hit[0] + 2} ${NY - 28}) scale(${xk})`}>
              <circle r={17} fill="#FFFFFF" stroke={C.wrong} strokeWidth={5} />
              <path d="M -7 -7 L 7 7 M -7 7 L 7 -7" stroke={C.wrong} strokeWidth={5} strokeLinecap="round" />
            </g>
          )}
        </g>
      );
    }
    // Growth arrow.
    const tArrow = first(events, 'arrow');
    const ak = smooth(since(t, tArrow, 0.7));
    // Missing start for the teaser.
    const gk = tGhost === undefined ? 0 : pop((t - tGhost - 0.3) / 0.4);
    const label5 = labelAt('5') * fade, label3 = labelAt('3') * fade;
    const pulses = events.filter((ev) => ev.action === 'pulse' && t >= ev.t && t < ev.t + 1.6).map((ev, i) => {
      const tg = this.targets(t)[ev.arg];
      if (!tg) return null;
      const age = t - ev.t;
      const grow = pop(age / 0.3) * (1 + 0.1 * Math.sin(age * 9) * (1 - age / 1.6));
      return <ellipse key={`p${i}`} cx={tg.x} cy={tg.y} rx={(tg.rx + 8) * grow} ry={(tg.ry + 8) * grow} fill="none" stroke={C.highlight} strokeWidth={6} opacity={smooth((1.6 - age) / 0.45)} />;
    });
    const text = {fontFamily: FONT, fontWeight: 700} as const;
    return (
      <g transform={`translate(${BOARD.x} ${BOARD.y})`}>
        <defs>
          <clipPath id="board"><rect width={BOARD.w} height={BOARD.h} rx={28} /></clipPath>
        </defs>
        <rect x={7} y={9} width={BOARD.w} height={BOARD.h} rx={28} fill={C.boardShadow} />
        <rect width={BOARD.w} height={BOARD.h} rx={28} fill={C.board} />
        <g clipPath="url(#board)">
          <g transform={`translate(${c[0]} ${c[1]}) scale(${s}) translate(${-f[0]} ${-f[1]})`}>
            <text x={SLOT0} y={48} fontSize={22} fill={C.ink} style={{...text, fontWeight: 600}}>Template DNA</text>
            <text x={30} y={TY + 23} fontSize={26} fill={C.ink} textAnchor="middle" style={text}>3′</text>
            <text x={slotX(this.p.stage.slots) + 16} y={TY + 23} fontSize={24} fill={C.ink} textAnchor="middle" style={text}>5′</text>
            <line x1={SLOT0 - 12} y1={TY - 8} x2={slotX(this.p.stage.slots) + 2} y2={TY - 8} stroke={C.ink} strokeWidth={6} strokeLinecap="round" />
            <g stroke={C.ink} strokeWidth={4}>{blocks}</g>
            {n > 0 && fade > 0 && (
              <line x1={SLOT0 - 6} y1={NY + BH + 9} x2={e + 4} y2={NY + BH + 9} stroke={C.dnaDark} strokeWidth={6} strokeLinecap="round" opacity={fade} />
            )}
            <g stroke={C.ink} strokeWidth={4}>{flying}{bounce}</g>
            {label5 > 0 && <text x={30} y={NY + 26} fontSize={36 * label5} fill={C.dnaDark} textAnchor="middle" style={text}>5′</text>}
            {label3 > 0 && <text x={e + 25} y={NY + 26} fontSize={36 * label3} fill={C.dnaDark} textAnchor="middle" style={text}>3′</text>}
            {fade > 0 && <text x={SLOT0} y={NY + 70} fontSize={22} fill={C.dnaDark} opacity={fade} style={{...text, fontWeight: 600}}>New DNA</text>}
            {ak > 0 && (
              <g opacity={fade}>
                <line x1={170} y1={262} x2={lerp(172, 372, ak)} y2={262} stroke={C.dnaDark} strokeWidth={7} strokeLinecap="round" />
                <polygon points={`${lerp(172, 372, ak) + 16},262 ${lerp(172, 372, ak) - 2},251 ${lerp(172, 372, ak) - 2},273`} fill={C.dnaDark} />
                <text x={400} y={273} fontSize={30 * smooth((ak - 0.4) / 0.6)} fill={C.dnaDark} style={text}>5′ → 3′</text>
              </g>
            )}
            {gk > 0 && (
              <g>
                <rect x={slotX(0)} y={NY} width={4 * STEP - 6} height={BH} rx={8} fill="none" stroke={C.ink} strokeWidth={4} strokeDasharray="10 8" opacity={clamp(gk)} />
                <text x={slotX(0) + 2 * STEP - 3} y={NY + 25} fontSize={32 * gk} fill={C.ink} textAnchor="middle" style={text}>?</text>
              </g>
            )}
            {pulses}
          </g>
        </g>
        <rect width={BOARD.w} height={BOARD.h} rx={28} fill="none" stroke={C.ink} strokeWidth={6} />
      </g>
    );
  }
}
