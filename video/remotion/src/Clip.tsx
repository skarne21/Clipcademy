import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {pop} from './anim';
import {Pulses, Scene, camera} from './scenes/common';
import {repairScene} from './scenes/Repair';
import {strandScene} from './scenes/Strand';
import {timelineScene} from './scenes/Timeline';
import {transcriptionScene} from './scenes/Transcription';
import {translationScene} from './scenes/Translation';
import {Guide, guideEvents} from './Guide';
import {BOARD, C, FONT, SAFE} from './theme';
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
      // Fredoka 600 averages ~0.53 em per character: shrink the text until it fits a 350 px pill.
      const size = Math.max(16, Math.min(29, Math.floor((350 - 78) / (c.text.length * 0.53))));
      const w = Math.min(350, c.text.length * size * 0.53 + 78);
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

const SCENES: Record<ClipProps['diagram'], (p: ClipProps) => Scene> = {
  strand: strandScene, repair: repairScene, transcription: transcriptionScene, translation: translationScene, timeline: timelineScene,
};

// A numbered checklist that ticks off, two per row, beside the guide.
const Steps: React.FC<{t: number; steps: {t: number; text: string}[]}> = ({t, steps}) => (
  <g>
    {steps.filter((st) => t >= st.t).map((st, i) => {
      const k = pop((t - st.t) / 0.35);
      const x = 250 + (i % 2) * 172, y = 600 + Math.floor(i / 2) * 72;
      return (
        <g key={i} transform={`translate(${x + 80} ${y + 28}) scale(${k}) translate(${-(x + 80)} ${-(y + 28)})`}>
          <rect x={x} y={y} width={160} height={56} rx={28} fill="#FFFFFF" stroke={C.ink} strokeWidth={4} />
          <circle cx={x + 28} cy={y + 28} r={16} fill={C.dna} stroke={C.ink} strokeWidth={3} />
          <text x={x + 28} y={y + 35} fontSize={19} textAnchor="middle" fill="#FFFFFF" style={{fontFamily: FONT, fontWeight: 700}}>{i + 1}</text>
          <text x={x + 52} y={y + 36} fontSize={st.text.length > 8 ? 20 : 23} fill={C.ink} style={{fontFamily: FONT, fontWeight: 600}}>{st.text}</text>
        </g>
      );
    })}
  </g>
);

const BoardFrame: React.FC<{t: number; scene: Scene; props: ClipProps}> = ({t, scene, props}) => {
  const {s, f, c} = camera(props.events, t, scene.targets);
  return (
    <g transform={`translate(${BOARD.x} ${BOARD.y})`}>
      <defs><clipPath id="board"><rect width={BOARD.w} height={BOARD.h} rx={28} /></clipPath></defs>
      <rect x={7} y={9} width={BOARD.w} height={BOARD.h} rx={28} fill={C.boardShadow} />
      <rect width={BOARD.w} height={BOARD.h} rx={28} fill={C.board} />
      <g clipPath="url(#board)">
        <g transform={`translate(${c[0]} ${c[1]}) scale(${s}) translate(${-f[0]} ${-f[1]})`}>
          {scene.content(t)}
          <Pulses events={props.events} t={t} targets={scene.targets(t)} />
        </g>
      </g>
      <rect width={BOARD.w} height={BOARD.h} rx={28} fill="none" stroke={C.ink} strokeWidth={6} />
    </g>
  );
};

export const Clip: React.FC<ClipProps> = (props) => {
  const frame = useCurrentFrame();
  const t = frame / props.fps;
  const scene = SCENES[props.diagram](props);
  const duration = props.durationInFrames / props.fps;
  const targets = scene.targets(t);
  const cam = camera(props.events, t, scene.targets);
  const targetAt = (name: string): Point => {
    const tg = targets[name] ?? {x: BOARD.w / 2, y: BOARD.h / 2};
    return [BOARD.x + cam.c[0] + (tg.x - cam.f[0]) * cam.s, BOARD.y + cam.c[1] + (tg.y - cam.f[1]) * cam.s];
  };
  const energy = props.energy[Math.min(frame, props.energy.length - 1)] ?? 0;
  const cards = props.events.filter((e) => e.action === 'card').map((e) => ({t: e.t, text: e.arg}));
  const steps = props.events.filter((e) => e.action === 'step').map((e) => ({t: e.t, text: e.arg}));
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
        <BoardFrame t={t} scene={scene} props={props} />
        <Cards t={t} cards={cards} />
        <Steps t={t} steps={steps} />
        <Guide t={t} events={guideEvents(props.events, duration)} energy={energy} targetAt={targetAt} />
      </svg>
      <div style={{position: 'absolute', left: 24, top: SAFE.top + 12, width: 720 - SAFE.right - 40, fontSize: titleSize,
        lineHeight: 1.08, fontWeight: 700, color: C.ink, ...outline(10, '#FFFFFF')}}>
        {props.title}
      </div>
      {/* Caption box: centred in the caption band so one or two lines, outline included, stay within y 760-1000. */}
      <div style={{position: 'absolute', left: 16, width: 720 - SAFE.right - 32, top: SAFE.captionTop + 12,
        height: SAFE.captionBottom - SAFE.captionTop - 24, display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
        alignContent: 'center', alignItems: 'center', fontSize: 78, fontWeight: 700, lineHeight: 1.0, color: C.caption,
        ...outline(12, C.ink)}}>
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
