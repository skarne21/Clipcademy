import React from 'react';
import {angleLerp, clamp, dir, lerp, pop, since, smooth} from './anim';
import {C, GUIDE} from './theme';
import {Beat, Point} from './types';

// The one guide character shared by every clip. Angles are degrees on screen (0 = right, 90 = down).
type Pose = {r: [number, number]; l: [number, number]; hand: 'open' | 'point' | 'thumb'; face: string; tilt?: number; bubble?: string};
const TALK: Pose = {r: [74, 98], l: [106, 92], hand: 'open', face: 'smile'};
const POSES: Record<string, Pose> = {
  talk: TALK,
  present: {r: [12, -18], l: [106, 92], hand: 'open', face: 'smile'},
  shrug: {r: [40, -40], l: [140, -140], hand: 'open', face: 'flat', tilt: 9, bubble: '?'},
  think: {r: [64, -116], l: [100, 14], hand: 'open', face: 'think', tilt: -7, bubble: '?'},
  thumbs: {r: [-26, -84], l: [106, 92], hand: 'thumb', face: 'big'},
  celebrate: {r: [-50, -74], l: [-130, -106], hand: 'open', face: 'big'},
  wag: {r: [-8, -88], l: [126, 40], hand: 'point', face: 'flat'},
  surprised: {r: [40, -58], l: [140, -122], hand: 'open', face: 'o', bubble: '!'},
};
const TRANSIENT = new Set(['shrug', 'think', 'thumbs', 'celebrate', 'wag', 'surprised']);

// Body proportions (local units, feet at 0,0): a big head reads well on a phone.
const THIGH = 27, SHIN = 27, TORSO = 66, NECK_TO_HEAD = 34, HEAD = 35, UPPER = 31, FORE = 29;

export type GuideEvent = {t: number; pose: string; arg: string};

export const guideEvents = (events: Beat[], duration: number): GuideEvent[] => {
  const ev: GuideEvent[] = [];
  for (const e of events) {
    if (e.action === 'point') ev.push({t: e.t, pose: 'point', arg: e.arg});
    if (e.action === 'pose') ev.push({t: e.t, pose: e.arg, arg: ''});
  }
  ev.sort((a, b) => a.t - b.t);
  const out: GuideEvent[] = [];
  ev.forEach((e, i) => {
    out.push(e);
    const next = i + 1 < ev.length ? ev[i + 1].t : duration + 10;
    if (TRANSIENT.has(e.pose) && next - e.t > 2.2) out.push({t: e.t + 2.0, pose: 'talk', arg: ''});
  });
  return out.sort((a, b) => a.t - b.t);
};

type Resolved = Pose & {look?: Point};

const resolve = (e: GuideEvent, t: number, shoulder: Point, targetAt: (n: string) => Point, energy: number): Resolved => {
  if (e.pose === 'point') {
    const [tx, ty] = toLocal(targetAt(e.arg));
    const a = clamp((Math.atan2(ty - shoulder[1], tx - shoulder[0]) * 180) / Math.PI, -88, 62);
    return {r: [a - 12, a], l: [126, 40], hand: 'point', face: 'smile', look: [tx, ty]};
  }
  const p = {...(POSES[e.pose] ?? TALK)};
  let [r1, r2] = p.r;
  if (e.pose === 'wag') r2 += 15 * Math.sin(t * 11);
  if (e.pose === 'talk') {
    const beat = energy * (0.55 + 0.45 * Math.sin(t * 3.1));
    r1 -= 10 * beat;
    r2 -= 52 * beat;
  }
  return {...p, r: [r1, r2]};
};

const toLocal = ([sx, sy]: Point): Point => [(sx - GUIDE.x) / GUIDE.scale, (sy - GUIDE.y) / GUIDE.scale];
const add = (p: Point, deg: number, len: number): Point => {
  const [dx, dy] = dir(deg);
  return [p[0] + dx * len, p[1] + dy * len];
};
const pts = (...ps: Point[]) => ps.map((p) => p.join(',')).join(' ');

export const Guide: React.FC<{t: number; events: GuideEvent[]; energy: number; targetAt: (name: string) => Point}> = ({
  t, events, energy, targetAt,
}) => {
  const bob = 1.4 * Math.sin(t * 2.4);
  const hip: Point = [0, -(THIGH + SHIN) + 2 + bob];
  let idx = -1;
  events.forEach((e, i) => {
    if (e.t <= t) idx = i;
  });
  const talk: GuideEvent = {t: 0, pose: 'talk', arg: ''};
  const cur = idx >= 0 ? events[idx] : talk;
  const prev = idx >= 1 ? events[idx - 1] : talk;
  const lean = lerp(prev.pose === 'point' ? 5 : 0, cur.pose === 'point' ? 5 : 0, idx >= 0 ? smooth((t - cur.t) / 0.3) : 1);
  const neck = add(hip, -90 + lean, TORSO);
  const shoulder: Point = [lerp(hip[0], neck[0], 0.8), lerp(hip[1], neck[1], 0.8)];
  const a = resolve(prev, t, shoulder, targetAt, energy);
  const b = resolve(cur, t, shoulder, targetAt, energy);
  const k = idx >= 0 ? smooth((t - cur.t) / 0.3) : 1;
  const arm = (side: 'r' | 'l') => [angleLerp(a[side][0], b[side][0], k), angleLerp(a[side][1], b[side][1], k)];
  const hand = k > 0.5 ? b.hand : a.hand;
  const face = k > 0.4 ? b.face : a.face;
  const tilt = lerp(a.tilt ?? 0, b.tilt ?? 0, k);
  const look = k > 0.3 ? b.look : a.look;
  const head = add(neck, -90 + lean, NECK_TO_HEAD);
  const ink = C.ink;
  const limbs = [
    [104, 100],
    [76, 80],
  ].map(([th, sh], i) => {
    const knee = add(hip, th, THIGH);
    const foot = add(knee, sh, SHIN);
    return <polyline key={`leg${i}`} points={pts(hip, knee, foot, [foot[0] + 10, foot[1]])} />;
  });
  const arms = (['l', 'r'] as const).map((side) => {
    const [a1, a2] = arm(side);
    const elbow = add(shoulder, a1, UPPER);
    const h = add(elbow, a2, FORE);
    const style = side === 'r' ? hand : 'open';
    return (
      <g key={side}>
        <polyline points={pts(shoulder, elbow, h)} />
        {style === 'point' && <line x1={h[0]} y1={h[1]} x2={add(h, a2, 11)[0]} y2={add(h, a2, 11)[1]} strokeWidth={4.5} />}
        {style === 'thumb' && <line x1={h[0]} y1={h[1] - 2} x2={h[0] + 1} y2={h[1] - 14} strokeWidth={5} />}
        <circle cx={h[0]} cy={h[1]} r={style === 'thumb' ? 7 : 5.5} fill={ink} />
      </g>
    );
  });
  // Face, in head space so the tilt rotates it as one.
  let dx = 1.5, dy = 0;
  if (look) {
    const d = Math.hypot(look[0] - head[0], look[1] - head[1]) || 1;
    dx = (3.4 * (look[0] - head[0])) / d;
    dy = (3.4 * (look[1] - head[1])) / d;
  }
  const blink = (t + 0.4) % 3.4 < 0.12;
  const open = clamp(energy * 1.5);
  const brow = face === 'o' ? -5 : face === 'big' ? -2 : face === 'flat' ? -1 : 0;
  let mouth: React.ReactNode;
  if (open > 0.12 && face !== 'o') {
    mouth = <ellipse cx={dx * 0.4} cy={14} rx={6.5 - 1.5 * open + (face === 'big' ? 2 : 0)} ry={2 + 6.5 * open} fill={ink} stroke="none" />;
  } else if (face === 'big') {
    mouth = <path d="M -10 9 Q 0 24 10 9 Z" fill={ink} strokeWidth={3} />;
  } else if (face === 'smile') {
    mouth = <path d="M -9 10 Q 0 19 9 10" fill="none" strokeWidth={3.5} />;
  } else if (face === 'o') {
    mouth = <ellipse cx={0} cy={14} rx={4.5 + 2 * open} ry={5.5 + 2 * open} fill="none" strokeWidth={3.2} />;
  } else if (face === 'think') {
    mouth = <line x1={-5} y1={15} x2={6} y2={12} strokeWidth={3.5} />;
  } else {
    mouth = <line x1={-7} y1={14} x2={7} y2={14} strokeWidth={3.5} />;
  }
  const bubble = b.bubble;
  const bk = bubble ? pop(since(t, cur.t, 0.35)) : 0;
  return (
    <g transform={`translate(${GUIDE.x} ${GUIDE.y}) scale(${GUIDE.scale})`} stroke={ink} strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <ellipse cx={4} cy={2} rx={46} ry={6} fill="rgba(30,42,38,0.18)" stroke="none" />
      {limbs}
      <line x1={hip[0]} y1={hip[1]} x2={neck[0]} y2={neck[1]} />
      {arms}
      <g transform={`translate(${neck[0]} ${neck[1] + 4})`} stroke="none" fill={C.dna}>
        <polygon points="0,0 -12,-7 -12,7" />
        <polygon points="0,0 12,-7 12,7" />
        <circle r={3.5} fill={C.dnaDark} />
      </g>
      <g transform={`translate(${head[0]} ${head[1]}) rotate(${tilt})`}>
        <circle r={HEAD} fill="#FFFFFF" />
        <circle cx={-19} cy={8} r={5} fill="#F6B8A8" stroke="none" opacity={0.7} />
        <circle cx={19} cy={8} r={5} fill="#F6B8A8" stroke="none" opacity={0.7} />
        {[-11, 11].map((x) =>
          blink ? (
            <path key={x} d={`M ${x - 6} -3 Q ${x} 1 ${x + 6} -3`} strokeWidth={3.2} />
          ) : (
            <g key={x}>
              <ellipse cx={x} cy={-4} rx={6.5} ry={8.5} fill="#FFFFFF" strokeWidth={3.2} />
              <circle cx={x + dx} cy={-4 + dy} r={3.6} fill={ink} stroke="none" />
            </g>
          ),
        )}
        {[-1, 1].map((s) => {
          const inner = face === 'flat' ? 3 : face === 'think' && s === 1 ? -2 : 0;
          const outer = face === 'think' && s === -1 ? 3 : 0;
          return <line key={s} x1={s * 17} y1={-17 + brow + outer} x2={s * 6} y2={-18 + brow - inner} strokeWidth={3.4} />;
        })}
        {mouth}
      </g>
      {bubble && bk > 0 && (
        <g transform={`translate(${head[0] + 38} ${head[1] - 40}) scale(${bk})`}>
          <circle r={16} fill="#FFFFFF" strokeWidth={3.5} />
          <text y={8} textAnchor="middle" fontSize={24} fontWeight={700} fill={bubble === '!' ? C.wrong : ink} stroke="none"
            style={{fontFamily: 'inherit'}}>
            {bubble}
          </text>
        </g>
      )}
    </g>
  );
};
