import React from 'react';
import {smooth} from '../../src/anim';
import {Cross, Scene} from '../../src/scenes/common';
import {C, FONT} from '../../src/theme';
import {Target} from '../../src/types';
import {CourseProps} from '../types';
import {Lines, Pop, appear, at, wrap} from './kit';

const Tag: React.FC<{x: number; y: number; text: string; fill: string}> = ({x, y, text, fill}) => (
  <g>
    <rect x={x} y={y} width={92} height={34} rx={17} fill={fill} stroke={C.ink} strokeWidth={3} />
    <text x={x + 46} y={y + 24} fontSize={20} textAnchor="middle" fill="#FFFFFF" style={{fontFamily: FONT, fontWeight: 700}}>{text}</text>
  </g>
);

// A wrong idea, struck out, then the right one.
export const mythFactScene = (p: CourseProps): Scene => {
  const {myth = '', fact = ''} = p.props as Record<string, string>;
  const T: Record<string, Target> = {myth: {x: 283, y: 77, rx: 260, ry: 58}, fact: {x: 283, y: 217, rx: 260, ry: 58}};
  const mythLines = wrap(myth, 30, 2);
  const content = (t: number) => {
    const mk = appear(t, at(p.events, 'show_myth'));
    const fk = appear(t, at(p.events, 'show_fact'));
    const crossAt = at(p.events, 'cross_out');
    const ck = crossAt === undefined || t < crossAt ? 0 : smooth((t - crossAt) / 0.5);
    return (
      <g>
        <Pop k={mk} x={283} y={77}>
          <g opacity={1 - 0.35 * ck}>
            <rect x={14} y={20} width={538} height={114} rx={22} fill="#FDECEA" stroke={C.ink} strokeWidth={4} />
            <Tag x={30} y={4} text="MYTH" fill={C.wrong} />
            <Lines lines={mythLines} x={290} y={82} size={26} />
          </g>
          {ck > 0 && mythLines.map((l, i) => {
            // Strike through each line of the myth, left to right, one line after another.
            const half = (l.length * 26 * 0.53) / 2 + 10;
            const y = 82 - ((mythLines.length - 1) * 26 * 1.12) / 2 + i * 26 * 1.12;
            const k = Math.max(0, Math.min(1, ck * mythLines.length - i));
            return k > 0 && <line key={i} x1={290 - half} y1={y} x2={290 - half + 2 * half * k} y2={y} stroke={C.wrong} strokeWidth={7} strokeLinecap="round" />;
          })}
          <Cross x={530} y={30} k={ck} />
        </Pop>
        <Pop k={fk} x={283} y={217}>
          <rect x={14} y={160} width={538} height={114} rx={22} fill="#E6F4EC" stroke={C.ink} strokeWidth={4} />
          <Tag x={30} y={144} text="FACT" fill={C.dna} />
          <Lines lines={wrap(fact, 30, 2)} x={290} y={222} size={26} />
        </Pop>
      </g>
    );
  };
  return {targets: () => T, content};
};
