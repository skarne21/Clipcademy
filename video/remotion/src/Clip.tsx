import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {pop} from './anim';
import {StrandScene} from './Board';
import {Guide, guideEvents} from './Guide';
import {C, FONT, SAFE} from './theme';
import {ClipProps, Point, Word} from './types';

// TikTok-style caption groups: 1-3 words, never across a sentence or clause end.
export const captionChunks = (words: Word[], maxWords = 3, maxChars = 19): Word[][] => {
  const out: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    if (cur.length && (cur.length >= maxWords || [...cur, w].map((x) => x.text).join(' ').length > maxChars)) {
      out.push(cur);
      cur = [];
    }
    cur.push(w);
    if (/[.,:;?!]$/.test(w.text)) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
};

const Cloud: React.FC<{x: number; y: number; s: number}> = ({x, y, s}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill={C.cloud} stroke={C.ink} strokeWidth={5} strokeLinejoin="round">
    <path d="M -60 20 Q -66 -6 -38 -10 Q -30 -36 0 -30 Q 22 -46 40 -22 Q 70 -22 64 8 Q 70 24 50 24 L -50 24 Q -64 24 -60 20 Z" />
  </g>
);

const Cards: React.FC<{t: number; cards: {t: number; text: string}[]}> = ({t, cards}) => (
  <g>
    {cards.filter((c) => t >= c.t).map((c, i) => {
      const k = pop((t - c.t) / 0.4);
      const size = c.text.length > 18 ? 25 : 29;
      const w = Math.min(350, c.text.length * size * 0.56 + 78);
      const x = 720 - SAFE.right - 10 - w, y = 598 + 68 * i;
      return (
        <g key={i} transform={`translate(${x + w} ${y + 27}) scale(${k}) translate(${-(x + w)} ${-(y + 27)})`}>
          <rect x={x + 4} y={y + 6} width={w} height={54} rx={27} fill="rgba(30,42,38,0.2)" />
          <rect x={x} y={y} width={w} height={54} rx={27} fill="#FFFFFF" stroke={C.ink} strokeWidth={4} />
          <circle cx={x + 30} cy={y + 27} r={15} fill={C.dna} stroke={C.ink} strokeWidth={3} />
          <path d={`M ${x + 23} ${y + 27} l 6 6 l 9 -12`} fill="none" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          <text x={x + 56} y={y + 37} fontSize={size} fill={C.ink} style={{fontFamily: FONT, fontWeight: 600}}>{c.text}</text>
        </g>
      );
    })}
  </g>
);

export const Clip: React.FC<ClipProps> = (props) => {
  const frame = useCurrentFrame();
  const t = frame / props.fps;
  const scene = new StrandScene(props);
  const duration = props.durationInFrames / props.fps;
  const targets = scene.targets(t);
  const targetAt = (name: string): Point => {
    const tg = targets[name] ?? {x: 283, y: 147};
    return scene.toScreen(t, [tg.x, tg.y]);
  };
  const energy = props.energy[Math.min(frame, props.energy.length - 1)] ?? 0;
  const cards = props.events.filter((e) => e.action === 'card').map((e) => ({t: e.t, text: e.arg}));
  const chunks = captionChunks(props.words);
  let chunk = chunks[0] ?? [];
  for (const c of chunks) if (c[0].start <= t) chunk = c;
  const titleSize = props.title.length > 30 ? 46 : 54;
  const outline = (px: number, color: string) => ({WebkitTextStroke: `${px}px ${color}`, paintOrder: 'stroke fill' as const});
  return (
    <AbsoluteFill style={{backgroundColor: C.sky, fontFamily: FONT}}>
      <Audio src={staticFile(props.audio)} />
      <svg width={720} height={1280} viewBox="0 0 720 1280" style={{position: 'absolute'}}>
        <Cloud x={((560 + t * 9) % 860) - 70} y={62} s={0.75} />
        <Cloud x={((300 + t * 6) % 860) - 70} y={640} s={0.6} />
        <rect x={0} y={790} width={720} height={490} fill={C.ground} />
        <line x1={0} y1={790} x2={720} y2={790} stroke={C.ink} strokeWidth={6} />
        {[60, 250, 430, 560].map((x, i) => (
          <path key={i} d={`M ${x} 832 q 6 -14 12 0 q 6 -14 12 0`} fill="none" stroke={C.groundEdge} strokeWidth={4} strokeLinecap="round" />
        ))}
        {scene.render(t)}
        <Cards t={t} cards={cards} />
        <Guide t={t} events={guideEvents(props.events, duration)} energy={energy} targetAt={targetAt} />
      </svg>
      <div style={{position: 'absolute', left: 24, top: SAFE.top + 12, width: 720 - SAFE.right - 40, fontSize: titleSize,
        lineHeight: 1.08, fontWeight: 700, color: C.ink, ...outline(10, '#FFFFFF')}}>
        {props.title}
      </div>
      <div style={{position: 'absolute', left: 16, width: 720 - SAFE.right - 32, top: 846, textAlign: 'center', fontSize: 78,
        fontWeight: 700, lineHeight: 1.05, color: C.caption, ...outline(12, C.ink)}}>
        {chunk.map((w, i) => {
          const next = chunk[i + 1]?.start ?? w.end;
          const hot = t >= w.start && t < Math.max(next, w.end);
          return (
            <span key={i} style={{color: hot ? C.captionHot : C.caption, display: 'inline-block', transform: `scale(${hot ? 1.08 : 1})`, margin: '0 15px'}}>
              {w.text}
            </span>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 24, top: 1032, fontSize: 21, fontWeight: 500, color: C.ink, opacity: 0.75}}>
        {props.sources}
      </div>
    </AbsoluteFill>
  );
};
