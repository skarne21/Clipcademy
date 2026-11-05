import React from 'react';
import {lerp, pop, since, smooth} from '../anim';
import {C} from '../theme';
import {ClipProps, Target} from '../types';
import {Enzyme, Scene, TEXT, each, first} from './common';

// One round of copying as a timeline: proofreading during, mismatch repair after.
export const timelineScene = (p: ClipProps): Scene => {
  const ev = p.events;
  const tLine = first(ev, 'timeline');
  const marks = each(ev, 'mark');
  const markAt = (which: string) => marks.find((m) => m.arg === which)?.t;
  const targets = (): Record<string, Target> => ({
    during: {x: 160, y: 150, rx: 115, ry: 60}, after: {x: 405, y: 150, rx: 115, ry: 60}, line: {x: 283, y: 112, rx: 250, ry: 20},
  });
  const content = (t: number) => {
    const k = tLine === undefined ? 1 : smooth(since(t, tLine, 0.7));
    const dot = lerp(40, 283, smooth(since(t, tLine ?? 0, 3.0)));
    const d = markAt('during'), a = markAt('after');
    const dk = d === undefined ? 0 : pop((t - d) / 0.4), ak = a === undefined ? 0 : pop((t - a) / 0.4);
    return (
      <g>
        <text x={160} y={56} fontSize={26} textAnchor="middle" fill={C.ink} style={TEXT}>During copying</text>
        <text x={405} y={56} fontSize={26} textAnchor="middle" fill={C.ink} style={TEXT}>After copying</text>
        <line x1={40} y1={112} x2={lerp(40, 526, k)} y2={112} stroke={C.ink} strokeWidth={8} strokeLinecap="round" />
        <line x1={283} y1={92} x2={283} y2={132} stroke={C.ink} strokeWidth={5} opacity={k} />
        <circle cx={dot} cy={112} r={12} fill={C.dna} stroke={C.ink} strokeWidth={4} opacity={k} />
        {dk > 0 && (
          <g transform={`translate(160 196) scale(${dk}) translate(-160 -196)`}>
            <Enzyme x={160} y={190} w={110} h={86} fill={C.polymerase} label="" t={t} />
            <text x={160} y={262} fontSize={24} textAnchor="middle" fill={C.dnaDark} style={TEXT}>Proofreading</text>
          </g>
        )}
        {ak > 0 && (
          <g transform={`translate(405 196) scale(${ak}) translate(-405 -196)`}>
            <Enzyme x={405} y={190} w={110} h={86} fill={C.repair} label="" t={t} look={1} />
            <text x={405} y={262} fontSize={24} textAnchor="middle" fill="#5B4A8B" style={TEXT}>Mismatch repair</text>
          </g>
        )}
      </g>
    );
  };
  return {targets, content};
};
