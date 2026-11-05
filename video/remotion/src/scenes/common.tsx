import React from 'react';
import {clamp, lerp, pop, smooth} from '../anim';
import {BOARD, C, FONT} from '../theme';
import {Beat, Point, Target} from '../types';

export const TEXT = {fontFamily: FONT, fontWeight: 700} as const;
export const CENTER: Point = [BOARD.w / 2, BOARD.h / 2];
export const first = (events: Beat[], action: string, arg?: string) =>
  events.find((e) => e.action === action && (arg === undefined || e.arg === arg))?.t;
export const each = (events: Beat[], action: string) => events.filter((e) => e.action === action);

/** A diagram drawn in board-local units (566 x 294). */
export type Scene = {
  targets: (t: number) => Record<string, Target>;
  content: (t: number) => React.ReactNode;
};

/** Close-up camera: k = 0 (whole board) .. 1 (magnified around the focus target). */
export const camera = (events: Beat[], t: number, targets: (t: number) => Record<string, Target>, zoom = 0.8) => {
  let from = 0, to = 0, start = -1, focus: string | undefined;
  for (const z of events) {
    if (z.action !== 'zoom' && z.action !== 'zoom_out') continue;
    if (z.t > t) break;
    const level = start < 0 ? 0 : lerp(from, to, smooth((z.t - start) / 0.6));
    from = level;
    to = z.action === 'zoom' ? 1 : 0;
    start = z.t;
    if (z.arg) focus = z.arg;
  }
  const k = start < 0 ? 0 : lerp(from, to, smooth((t - start) / 0.6));
  const f = focus ? targets(t)[focus] : undefined;
  if (!f || k < 0.001) return {s: 1, f: CENTER, c: CENTER};
  const fp: Point = [f.x, f.y];
  return {s: 1 + zoom * k, f: fp, c: [lerp(fp[0], CENTER[0], k), lerp(fp[1], CENTER[1], k)] as Point};
};

/** Cartoon enzyme: a soft rounded body with eyes, so molecules feel like characters. */
export const Enzyme: React.FC<{x: number; y: number; w: number; h: number; fill: string; label: string; t: number;
  mood?: 'happy' | 'sad' | 'busy'; look?: number; opacity?: number; labelY?: number}> = ({x, y, w, h, fill, label, t, mood = 'happy', look = 0, opacity = 0.82, labelY}) => {
  const wob = 2 * Math.sin(t * 3.2);
  x = Math.max(w / 2 + 8, Math.min(566 - w / 2 - 8, x));
  const ey = y - h * 0.18 + wob;
  const mouth = mood === 'sad' ? `M ${x - 6} ${ey + 17} Q ${x} ${ey + 11} ${x + 6} ${ey + 17}`
    : mood === 'busy' ? `M ${x - 5} ${ey + 14} L ${x + 5} ${ey + 14}` : `M ${x - 7} ${ey + 11} Q ${x} ${ey + 17} ${x + 7} ${ey + 11}`;
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2 + wob} width={w} height={h} rx={Math.min(w, h) / 2.3} fill={fill} fillOpacity={opacity} stroke={C.ink} strokeWidth={5} />
      {[-1, 1].map((s) => (
        <g key={s}>
          <ellipse cx={x + s * 11} cy={ey} rx={6} ry={7.5} fill="#FFFFFF" stroke={C.ink} strokeWidth={3} />
          <circle cx={x + s * 11 + 2.5 * look} cy={ey + 1} r={3} fill={C.ink} />
        </g>
      ))}
      <path d={mouth} fill="none" stroke={C.ink} strokeWidth={3.5} strokeLinecap="round" />
      <text x={x} y={labelY ?? y + h * 0.36 + wob} fontSize={18} textAnchor="middle" fill={C.ink}
        style={{...TEXT, paintOrder: 'stroke fill'}} stroke="#FFFFFF" strokeWidth={6} strokeLinejoin="round">{label}</text>
    </g>
  );
};

export const Cross: React.FC<{x: number; y: number; k: number}> = ({x, y, k}) =>
  k <= 0 ? null : (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <circle r={18} fill="#FFFFFF" stroke={C.wrong} strokeWidth={5} />
      <path d="M -7 -7 L 7 7 M -7 7 L 7 -7" stroke={C.wrong} strokeWidth={5} strokeLinecap="round" />
    </g>
  );

export const Check: React.FC<{x: number; y: number; k: number}> = ({x, y, k}) =>
  k <= 0 ? null : (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <circle r={18} fill={C.dna} stroke={C.ink} strokeWidth={4} />
      <path d="M -8 0 l 5 6 l 10 -12" fill="none" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );

export const Sparkle: React.FC<{x: number; y: number; k: number}> = ({x, y, k}) =>
  k <= 0 || k >= 1 ? null : (
    <g stroke={C.highlight} strokeWidth={5} strokeLinecap="round" opacity={1 - k}>
      {[0, 60, 120, 180, 240, 300].map((a) => {
        const r = (a * Math.PI) / 180;
        return <line key={a} x1={x + Math.cos(r) * (8 + 14 * k)} y1={y + Math.sin(r) * (8 + 14 * k)} x2={x + Math.cos(r) * (16 + 22 * k)} y2={y + Math.sin(r) * (16 + 22 * k)} />;
      })}
    </g>
  );

export const Tile: React.FC<{x: number; y: number; w: number; h: number; letter?: string; fill: string; stroke?: string;
  color?: string; opacity?: number; rotate?: number; size?: number}> = ({x, y, w, h, letter, fill, stroke = C.ink, color = C.ink, opacity = 1, rotate = 0, size}) => (
  <g opacity={opacity} transform={rotate ? `rotate(${rotate} ${x + w / 2} ${y + h / 2})` : undefined}>
    <rect x={x} y={y} width={w} height={h} rx={8} fill={fill} stroke={stroke} strokeWidth={4} />
    {letter && <text x={x + w / 2} y={y + h / 2 + (size ?? 22) * 0.36} fontSize={size ?? 22} textAnchor="middle" fill={color} style={TEXT}>{letter}</text>}
  </g>
);

/** Highlight rings for every pulse beat whose target this scene knows. */
export const Pulses: React.FC<{events: Beat[]; t: number; targets: Record<string, Target>}> = ({events, t, targets}) => (
  <g>
    {events.filter((e) => e.action === 'pulse' && t >= e.t && t < e.t + 1.6).map((e, i) => {
      const tg = targets[e.arg];
      if (!tg) return null;
      const age = t - e.t;
      const grow = pop(age / 0.3) * (1 + 0.1 * Math.sin(age * 9) * (1 - age / 1.6));
      return <ellipse key={i} cx={tg.x} cy={tg.y} rx={(tg.rx + 8) * grow} ry={(tg.ry + 8) * grow} fill="none" stroke={C.highlight} strokeWidth={6} opacity={smooth((1.6 - age) / 0.45)} />;
    })}
  </g>
);

/** Piece visible at time t (joined, and not yet removed). */
export const visible = (p: {t: number; until?: number}, t: number) => p.t <= t && (p.until === undefined || t < p.until);
export const flyIn = (t: number, at: number, dur = 0.45) => (t >= at - dur && t < at ? clamp((t - at + dur) / dur) : -1);
