import React from 'react';
import {easeOut, lerp, pop, since, smooth} from '../anim';
import {C} from '../theme';
import {ClipProps, Point, Target} from '../types';
import {Cross, Enzyme, Scene, TEXT, Tile, first, visible} from './common';

// Transcription: coding strand on top, template strand below. The promoter is slots 0-1.
export const CODING = 'CGAGCACGAC'; // template has no A, so the RNA needs no U (not in the sources)
const PAIR: Record<string, string> = {A: 'T', T: 'A', G: 'C', C: 'G'};
export const TEMPLATE = CODING.split('').map((b) => PAIR[b]).join('');
const RNA_PAIR: Record<string, string> = {A: 'U', T: 'A', G: 'C', C: 'G'};
const X0 = 36, STEP = 50, W = 38, H = 34;
const slotX = (i: number) => X0 + STEP * i;
const CLOSED_TOP = 72, CLOSED_BOT = 130, OPEN_TOP = 34, OPEN_BOT = 200, RNA_Y = 152;

export const transcriptionScene = (p: ClipProps): Scene => {
  const {events, pieces} = p;
  const f = (a: string) => first(events, a);
  const tOpen = f('open'), tPol = f('polymerase'), tTry = f('try'), tFail = f('fail');
  const openK = (t: number) => (p.stage.open ? 1 : smooth(since(t, tOpen, 0.6)));
  const shown = (t: number) => pieces.filter((q) => visible(q, t));
  const rnaEnd = (t: number) => {
    const s = shown(t);
    if (!s.length) return slotX(2);
    const last = s.reduce((a, b) => (b.slot > a.slot ? b : a));
    const e = slotX(last.slot) + W;
    return last.t > 0 ? lerp(e - STEP, e, smooth((t - last.t) / 0.22)) : e;
  };
  const promoterX = slotX(1) - 4;
  const middle: Point = [slotX(6.5), 30];
  const polPos = (t: number): Point | null => {
    if (tTry !== undefined && t >= tTry && (tPol === undefined || t < tPol)) {
      const shake = tFail !== undefined && t >= tFail && t < tFail + 0.6 ? 6 * Math.sin((t - tFail) * 40) : 0;
      return [lerp(660, middle[0], easeOut((t - tTry) / 0.7)) + shake, middle[1]];
    }
    if (tPol === undefined || t < tPol) return null;
    const start: Point = tTry !== undefined ? middle : [660, 40];
    const atPromoter: Point = [promoterX + 20, 30];
    const k = easeOut((t - tPol) / 0.8);
    const base: Point = [lerp(start[0], atPromoter[0], k), lerp(start[1], atPromoter[1], k)];
    const s = shown(t);
    if (!s.length || t < tPol + 0.8) return base;
    return [rnaEnd(t) - 30, lerp(atPromoter[1], 110, openK(t))];
  };
  const yTop = (i: number, t: number) => (i >= 2 ? lerp(CLOSED_TOP, OPEN_TOP, openK(t)) : CLOSED_TOP);
  const yBot = (i: number, t: number) => (i >= 2 ? lerp(CLOSED_BOT, OPEN_BOT, openK(t)) : CLOSED_BOT);
  const targets = (t: number): Record<string, Target> => {
    const pol = polPos(t) ?? [promoterX, 120];
    const e = rnaEnd(t);
    return {
      coding: {x: 283, y: yTop(5, t) + H / 2, rx: 256, ry: 26}, template: {x: 283, y: yBot(5, t) + H / 2, rx: 256, ry: 26},
      promoter: {x: (slotX(0) + slotX(1) + W) / 2, y: (CLOSED_TOP + CLOSED_BOT + H) / 2, rx: 62, ry: 70},
      rna: {x: (slotX(2) + e) / 2, y: RNA_Y + H / 2, rx: Math.max(30, (e - slotX(2)) / 2 + 12), ry: 26},
      rna_end: {x: e + 10, y: RNA_Y + H / 2, rx: 24, ry: 24},
      polymerase: {x: pol[0], y: pol[1], rx: 84, ry: 32}, middle: {x: middle[0], y: (CLOSED_TOP + CLOSED_BOT + H) / 2, rx: 60, ry: 60},
      arrow: {x: 330, y: 262, rx: 130, ry: 20},
    };
  };
  const content = (t: number) => {
    const s = shown(t);
    const e = rnaEnd(t);
    const ok = openK(t);
    const pol = polPos(t);
    const failK = tFail !== undefined && t >= tFail && t < tFail + 2.0 ? pop((t - tFail - 0.2) / 0.3) : 0;
    const ak = smooth(since(t, f('arrow'), 0.7));
    const topPts = CODING.split('').map((_, i) => `${slotX(i) + W / 2},${yTop(i, t) - 8}`).join(' ');
    const botPts = TEMPLATE.split('').map((_, i) => `${slotX(i) + W / 2},${yBot(i, t) + H + 8}`).join(' ');
    return (
      <g>
        <rect x={slotX(0) - 12} y={CLOSED_TOP - 22} width={2 * STEP + 12} height={CLOSED_BOT - CLOSED_TOP + H + 44} rx={18}
          fill={C.promoter} stroke={C.ink} strokeWidth={4} strokeDasharray="10 7" />
        <text x={(slotX(0) + slotX(1) + W) / 2} y={CLOSED_BOT + H + 50} fontSize={22} textAnchor="middle" fill={C.ink} style={TEXT}>Promoter</text>
        <text x={slotX(3.6)} y={lerp(CLOSED_TOP - 16, OPEN_TOP - 12, ok) + 2} fontSize={20} fill={C.ink} style={{...TEXT, fontWeight: 600}}>Coding strand</text>
        <text x={slotX(2.2)} y={lerp(CLOSED_BOT + H + 30, OPEN_BOT + H + 28, ok)} fontSize={20} fill={C.dnaDark} style={{...TEXT, fontWeight: 600}}>Template strand</text>
        <polyline points={topPts} fill="none" stroke={C.ink} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={botPts} fill="none" stroke={C.dnaDark} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        {CODING.split('').map((_, i) => ok < 0.5 || i < 2 ? (
          <line key={`r${i}`} x1={slotX(i) + W / 2} y1={yTop(i, t) + H} x2={slotX(i) + W / 2} y2={yBot(i, t)} stroke={C.rung} strokeWidth={4} />
        ) : null)}
        {pol && <Enzyme x={pol[0]} y={pol[1]} w={160} h={56} fill={C.rnaPol} label="RNA polymerase" t={t} mood={failK > 0 ? 'sad' : 'happy'} opacity={1} />}
        {CODING.split('').map((l, i) => <Tile key={`c${i}`} x={slotX(i)} y={yTop(i, t)} w={W} h={H} letter={l} fill={C.template} size={20} />)}
        {TEMPLATE.split('').map((l, i) => <Tile key={`m${i}`} x={slotX(i)} y={yBot(i, t)} w={W} h={H} letter={l} fill="#E7F5EC" color={C.dnaDark} size={20} />)}
        {s.map((q, j) => {
          const k = q.t > 0 ? easeOut((t - q.t + 0.35) / 0.35) : 1;
          return (
            <g key={j}>
              {k > 0.9 && <line x1={slotX(q.slot) + W / 2} y1={RNA_Y + H + 2} x2={slotX(q.slot) + W / 2} y2={OPEN_BOT - 2} stroke={C.rung} strokeWidth={4} />}
              <Tile x={slotX(q.slot) + 50 * (1 - k)} y={RNA_Y - 60 * (1 - k)} w={W} h={H} letter={RNA_PAIR[TEMPLATE[q.slot]]} fill={C.rna} color="#FFFFFF" size={20} opacity={k} />
            </g>
          );
        })}
        {s.length > 0 && <text x={slotX(2) - 6} y={RNA_Y + 25} fontSize={22} textAnchor="end" fill={C.rna} style={TEXT}>RNA</text>}
        {s.length > 0 && <text x={e + 22} y={RNA_Y + 26} fontSize={26} textAnchor="middle" fill={C.rna} style={TEXT}>3′</text>}
        {pol && <Cross x={Math.min(pol[0], 478) + 84} y={pol[1] + 4} k={failK} />}
        {ak > 0 && (
          <g>
            <line x1={210} y1={268} x2={lerp(212, 412, ak)} y2={268} stroke={C.ink} strokeWidth={6} strokeLinecap="round" />
            <polygon points={`${lerp(212, 412, ak) + 15},268 ${lerp(212, 412, ak) - 2},258 ${lerp(212, 412, ak) - 2},278`} fill={C.ink} />
            <text x={436} y={276} fontSize={22 * smooth((ak - 0.4) / 0.6)} fill={C.ink} style={TEXT}>read</text>
          </g>
        )}
      </g>
    );
  };
  return {targets, content};
};
