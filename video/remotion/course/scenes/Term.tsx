import React from 'react';
import {Scene} from '../../src/scenes/common';
import {C} from '../../src/theme';
import {Target} from '../../src/types';
import {CourseProps} from '../types';
import {HILITE, Lines, Pop, appear, at, highlighted, wrap} from './kit';

// One new word: the term, what it means in plain words, and an everyday example.
export const termScene = (p: CourseProps): Scene => {
  const {term = '', plain = '', example = ''} = p.props as Record<string, string>;
  const T: Record<string, Target> = {
    term: {x: 283, y: 60, rx: 220, ry: 34}, plain: {x: 283, y: 150, rx: 250, ry: 46}, example: {x: 283, y: 240, rx: 250, ry: 36},
  };
  const content = (t: number) => {
    const lit = highlighted(p.events, t);
    const glow = (id: string) => lit.has(id) && <rect x={T[id].x - T[id].rx} y={T[id].y - T[id].ry} width={T[id].rx * 2}
      height={T[id].ry * 2} rx={20} fill={HILITE} stroke={C.highlight} strokeWidth={5} />;
    const pk = appear(t, at(p.events, 'reveal_plain'));
    const ek = appear(t, at(p.events, 'reveal_example'));
    return (
      <g>
        {glow('term')}
        <Lines lines={[term]} x={283} y={60} size={44} weight={700} color={C.dnaDark} />
        <line x1={120} y1={98} x2={446} y2={98} stroke={C.rung} strokeWidth={4} strokeLinecap="round" />
        <Pop k={pk} x={283} y={150}>
          {glow('plain')}
          <Lines lines={wrap(plain, 30, 2)} x={283} y={150} size={26} />
        </Pop>
        <Pop k={ek} x={283} y={240}>
          {glow('example')}
          <Lines lines={wrap(`e.g. ${example}`, 36, 2)} x={283} y={240} size={22} italic color={C.dnaDark} />
        </Pop>
      </g>
    );
  };
  return {targets: () => T, content};
};
