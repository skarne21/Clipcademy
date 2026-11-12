import React from 'react';
import {pop, smooth} from '../../src/anim';
import {C, FONT} from '../../src/theme';
import {Beat} from '../../src/types';

export const W = 566, H = 294; // board-local units, as in src/scenes/common.tsx
export const HILITE = '#FFF2C8';
export const LABEL = {fontFamily: FONT, fontWeight: 600} as const;

/** Time of the first `action:arg` beat, or undefined if the clip never uses it. */
export const at = (events: Beat[], action: string, arg = '') =>
  events.find((e) => e.action === action && e.arg === arg)?.t;

/** 0 before an appear beat, then a springy 0..1; things that are never revealed are visible from the start. */
export const appear = (t: number, when: number | undefined) =>
  when === undefined ? 1 : t < when ? 0 : pop((t - when) / 0.4);

/** Highlights stay on once given. */
export const highlighted = (events: Beat[], t: number) =>
  new Set(events.filter((e) => e.action === 'highlight' && e.t <= t).map((e) => e.arg));

export const shake = (events: Beat[], id: string, t: number) => {
  const s = events.filter((e) => e.action === 'shake' && e.arg === id && e.t <= t && t < e.t + 0.6).pop();
  return s ? 9 * Math.sin((t - s.t) * 34) * (1 - (t - s.t) / 0.6) : 0;
};

export const grow = (t: number, when: number | undefined, dur = 0.5) =>
  when === undefined ? 1 : t < when ? 0 : smooth((t - when) / dur);

/** Greedy word wrap into at most `max` lines of about `chars` characters. */
export const wrap = (text: string, chars: number, max = 3): string[] => {
  const lines: string[] = [];
  let cur = '';
  for (const word of text.split(/\s+/)) {
    if (cur && (cur + ' ' + word).length > chars) {
      lines.push(cur);
      cur = word;
    } else cur = cur ? cur + ' ' + word : word;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, max);
};

/** Scale a group about its own centre, for pop-in. */
export const Pop: React.FC<{k: number; x: number; y: number; children: React.ReactNode}> = ({k, x, y, children}) =>
  k <= 0 ? null : <g transform={`translate(${x} ${y}) scale(${k}) translate(${-x} ${-y})`}>{children}</g>;

export const Lines: React.FC<{lines: string[]; x: number; y: number; size: number; color?: string; anchor?: 'start' | 'middle';
  italic?: boolean; weight?: number}> = ({lines, x, y, size, color = C.ink, anchor = 'middle', italic = false, weight = 600}) => {
  const lh = size * 1.12;
  const top = y - ((lines.length - 1) * lh) / 2 + size * 0.36;
  return (
    <text x={x} y={top} fontSize={size} textAnchor={anchor} fill={color}
      style={{fontFamily: FONT, fontWeight: weight, fontStyle: italic ? 'italic' : 'normal'}}>
      {lines.map((l, i) => <tspan key={i} x={x} dy={i === 0 ? 0 : lh}>{l}</tspan>)}
    </text>
  );
};
