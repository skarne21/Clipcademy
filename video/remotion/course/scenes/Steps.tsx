import React from 'react';
import {pop} from '../../src/anim';
import {Check, Scene} from '../../src/scenes/common';
import {C, FONT} from '../../src/theme';
import {Target} from '../../src/types';
import {CourseProps, Item} from '../types';
import {H, HILITE, LABEL, Pop, appear, at, highlighted, shake} from './kit';

// An ordered process: numbered rows that pop in, light up, wobble when wrong and tick off.
export const stepsScene = (p: CourseProps): Scene => {
  const items: Item[] = p.props.steps ?? [];
  const n = Math.max(items.length, 1);
  const rowH = Math.min(64, (H - 36) / n);
  const top = (H - rowH * n) / 2;
  const cy = (i: number) => top + rowH * i + rowH / 2;
  const size = Math.min(28, Math.floor(rowH * 0.46));
  const targets = (): Record<string, Target> =>
    Object.fromEntries(items.map((s, i) => [s.id, {x: 290, y: cy(i), rx: 240, ry: rowH / 2 - 6}]));
  const content = (t: number) => {
    const lit = highlighted(p.events, t);
    return (
      <g>
        {items.map((s, i) => {
          const y = cy(i), h = rowH - 12;
          const k = appear(t, at(p.events, 'reveal', s.id));
          const checked = at(p.events, 'check', s.id);
          const ck = checked === undefined || t < checked ? 0 : pop((t - checked) / 0.35);
          return (
            <g key={s.id}>
              {k === 0 && (
                <g opacity={0.35}>
                  <rect x={74} y={y - h / 2} width={436} height={h} rx={h / 2} fill="none" stroke={C.ink} strokeWidth={3} strokeDasharray="10 8" />
                  <circle cx={44} cy={y} r={17} fill="none" stroke={C.ink} strokeWidth={3} />
                </g>
              )}
              <Pop k={k} x={290} y={y}>
                <g transform={`translate(${shake(p.events, s.id, t)} 0)`}>
                  <rect x={74} y={y - h / 2} width={436} height={h} rx={h / 2} fill={lit.has(s.id) ? HILITE : '#FFFFFF'}
                    stroke={lit.has(s.id) ? C.highlight : C.ink} strokeWidth={lit.has(s.id) ? 6 : 4} />
                  <circle cx={44} cy={y} r={18} fill={C.dna} stroke={C.ink} strokeWidth={3} />
                  <text x={44} y={y + 7} fontSize={20} textAnchor="middle" fill="#FFFFFF" style={{fontFamily: FONT, fontWeight: 700}}>{i + 1}</text>
                  <text x={98} y={y + size * 0.36} fontSize={size} fill={C.ink} style={LABEL}>{s.text}</text>
                  <Check x={478} y={y} k={ck} />
                </g>
              </Pop>
            </g>
          );
        })}
      </g>
    );
  };
  return {targets, content};
};
