import React from 'react';
import {pop} from '../../src/anim';
import {Check, Scene} from '../../src/scenes/common';
import {C} from '../../src/theme';
import {Target} from '../../src/types';
import {CourseProps, Item} from '../types';
import {HILITE, Lines, Pop, appear, at, highlighted, wrap} from './kit';

type Column = {title: string; points: Item[]};
const COLS = {left: {x: 16, fill: C.polymerase}, right: {x: 296, fill: C.ribosome}} as const;
const CW = 254;

// Two things side by side: a title per column and up to three points under each.
export const compareScene = (p: CourseProps): Scene => {
  const side = (s: 'left' | 'right'): Column => p.props[s] ?? {title: '', points: []};
  const pointY = (i: number) => 116 + i * 60;
  const targets = (): Record<string, Target> => {
    const out: Record<string, Target> = {};
    (['left', 'right'] as const).forEach((s) => {
      const x = COLS[s].x + CW / 2;
      out[s] = {x, y: 147, rx: CW / 2 - 4, ry: 130};
      side(s).points.forEach((pt, i) => (out[pt.id] = {x, y: pointY(i), rx: CW / 2 - 14, ry: 24}));
    });
    return out;
  };
  const content = (t: number) => {
    const lit = highlighted(p.events, t);
    const win = p.events.filter((e) => e.action === 'winner' && e.t <= t).pop();
    return (
      <g>
        {(['left', 'right'] as const).map((s) => {
          const col = side(s), x0 = COLS[s].x, cx = x0 + CW / 2;
          const k = appear(t, at(p.events, 'reveal', s));
          const won = win?.arg === s;
          const wk = won ? pop((t - win!.t) / 0.4) : 0;
          return (
            <Pop key={s} k={k} x={cx} y={147}>
              <rect x={x0} y={14} width={CW} height={266} rx={22} fill="#FFFFFF" stroke={won ? C.dna : C.ink} strokeWidth={won ? 8 : 4} />
              <rect x={x0} y={14} width={CW} height={62} rx={22} fill={lit.has(s) ? HILITE : COLS[s].fill} stroke={C.ink} strokeWidth={4} />
              <Lines lines={[col.title]} x={cx} y={45} size={28} weight={700} />
              {col.points.map((pt, i) => {
                const pk = appear(t, at(p.events, 'reveal', pt.id));
                const y = pointY(i);
                const lines = wrap(pt.text, 19, 2);
                return (
                  <Pop key={pt.id} k={pk} x={cx} y={y}>
                    <rect x={x0 + 12} y={y - 25} width={CW - 24} height={50} rx={14} fill={lit.has(pt.id) ? HILITE : '#F6F8F7'}
                      stroke={lit.has(pt.id) ? C.highlight : C.rung} strokeWidth={lit.has(pt.id) ? 5 : 3} />
                    <Lines lines={lines} x={cx} y={y} size={lines.length > 1 ? 19 : 22} />
                  </Pop>
                );
              })}
              <Check x={x0 + CW - 22} y={30} k={wk} />
            </Pop>
          );
        })}
      </g>
    );
  };
  return {targets, content};
};
