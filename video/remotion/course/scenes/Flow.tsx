import React from 'react';
import {clamp, lerp, pop} from '../../src/anim';
import {Cross, Scene} from '../../src/scenes/common';
import {C} from '../../src/theme';
import {Target} from '../../src/types';
import {CourseProps, Item} from '../types';
import {HILITE, Lines, Pop, W, appear, at, grow, highlighted, wrap} from './kit';

type Edge = {from: string; to: string};
const CY = 172, NH = 120, GAP = 30;

// Cause and effect: boxes in a row joined by arrows; arrows draw in once both ends are shown.
export const flowScene = (p: CourseProps): Scene => {
  const nodes: Item[] = p.props.nodes ?? [];
  const edges: Edge[] = p.props.edges ?? [];
  const n = Math.max(nodes.length, 1);
  const nw = (W - 28 - (n - 1) * GAP) / n;
  const idx = (id: string) => nodes.findIndex((x) => x.id === id);
  const nx = (i: number) => 14 + i * (nw + GAP);
  const shownAt = (id: string) => at(p.events, 'reveal', id);
  const chars = Math.max(6, Math.floor((nw - 12) / 11.5));
  const targets = (): Record<string, Target> =>
    Object.fromEntries(nodes.map((nd, i) => [nd.id, {x: nx(i) + nw / 2, y: CY, rx: nw / 2, ry: NH / 2}]));
  // Adjacent forward edges run straight between boxes; any other edge arcs over the top.
  const geometry = (e: Edge) => {
    const a = idx(e.from), b = idx(e.to);
    if (b === a + 1) {
      const y = CY;
      return {d: `M ${nx(a) + nw + 2} ${y} L ${nx(b) - 4} ${y}`, at: (k: number): [number, number] => [lerp(nx(a) + nw + 2, nx(b) - 4, k), y], end: [nx(b) - 4, y, 0] as const};
    }
    const x1 = nx(a) + nw / 2, x2 = nx(b) + nw / 2, top = CY - NH / 2, peak = 22;
    const mid = (x1 + x2) / 2;
    const q = (k: number): [number, number] => [
      (1 - k) ** 2 * x1 + 2 * (1 - k) * k * mid + k ** 2 * x2,
      (1 - k) ** 2 * top + 2 * (1 - k) * k * (peak * 2 - top) + k ** 2 * top,
    ];
    return {d: `M ${x1} ${top} Q ${mid} ${peak * 2 - top} ${x2} ${top - 4}`, at: q, end: [x2, top - 4, 90] as const};
  };
  const content = (t: number) => {
    const lit = highlighted(p.events, t);
    return (
      <g>
        {edges.map((e, i) => {
          if (idx(e.from) < 0 || idx(e.to) < 0) return null;
          const ready = Math.max(shownAt(e.from) ?? -1, shownAt(e.to) ?? -1);
          const k = grow(t, ready < 0 ? undefined : ready + 0.2, 0.5);
          if (k <= 0) return null;
          const g = geometry(e);
          const [ex, ey, ang] = g.end;
          const pulse = p.events.filter((x) => x.action === 'pulse_edge' && x.arg === `${e.from}-${e.to}` && x.t <= t && t < x.t + 0.9).pop();
          const dot = pulse ? g.at(clamp((t - pulse.t) / 0.8)) : null;
          return (
            <g key={i} opacity={k}>
              <path d={g.d} fill="none" stroke={C.ink} strokeWidth={6} strokeLinecap="round" />
              <path d="M -14 -10 L 0 0 L -14 10" transform={`translate(${ex} ${ey}) rotate(${ang})`} fill="none" stroke={C.ink} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
              {dot && <circle cx={dot[0]} cy={dot[1]} r={11} fill={C.highlight} stroke={C.ink} strokeWidth={3} />}
            </g>
          );
        })}
        {nodes.map((nd, i) => {
          const x = nx(i), k = appear(t, shownAt(nd.id));
          const blocked = at(p.events, 'block', nd.id);
          const bk = blocked === undefined || t < blocked ? 0 : pop((t - blocked) / 0.35);
          const lines = wrap(nd.text, chars, 3);
          return (
            <Pop key={nd.id} k={k} x={x + nw / 2} y={CY}>
              <rect x={x} y={CY - NH / 2} width={nw} height={NH} rx={18} fill={bk > 0 ? '#F9D7D4' : lit.has(nd.id) ? HILITE : '#FFFFFF'}
                stroke={lit.has(nd.id) ? C.highlight : C.ink} strokeWidth={lit.has(nd.id) ? 6 : 4} />
              <Lines lines={lines} x={x + nw / 2} y={CY} size={lines.length > 2 ? 20 : 23} />
              <Cross x={x + nw - 10} y={CY - NH / 2 + 10} k={bk} />
            </Pop>
          );
        })}
      </g>
    );
  };
  return {targets, content};
};
