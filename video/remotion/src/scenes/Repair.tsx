import React from 'react';
import {clamp, easeOut, lerp, pop, since, smooth} from '../anim';
import {C} from '../theme';
import {ClipProps, Point, Target} from '../types';
import {Cross, Enzyme, Scene, Sparkle, TEXT, Tile, first, flyIn, visible} from './common';

// Repair: original strand on top, new strand below, as letter tiles.
export const TOP = 'GCTAGGATC';
const PAIR: Record<string, string> = {A: 'T', T: 'A', G: 'C', C: 'G'};
export const BOT = TOP.split('').map((b) => PAIR[b]).join(''); // C G A T C C T A G: C and T side by side at 5, 6
const X0 = 44, STEP = 54, W = 40, TY = 64, BY = 176;
const slotX = (i: number) => X0 + STEP * i;
const N = TOP.length;
// A wrong base is never accidentally the right one.
export const wrongLetter = (i: number) => (BOT[i] === 'T' ? 'G' : 'T');

export const repairScene = (p: ClipProps): Scene => {
  const {events, pieces} = p;
  const wrongSlot = p.stage.wrong === undefined ? -1 : Number(p.stage.wrong);
  const section = (p.stage.section as number[] | undefined) ?? (wrongSlot >= 0 ? [wrongSlot - 1, wrongSlot + 1] : [4, 7]);
  const [sa, sb] = section;
  const damaged = Boolean(p.stage.damaged), gap = Boolean(p.stage.gap);
  const f = (a: string) => first(events, a);
  const tFound = f('found'), tCut = f('cut'), tRemove = f('remove'), tReplace = f('replace'), tReseal = f('reseal');
  const tUv = f('uv'), tBond = f('bond'), tBulge = f('bulge'), tScan = f('scan'), tPol = f('polymerase'), tMis = f('misadd');
  const bonded = (t: number) => damaged || (tBond !== undefined && t >= tBond);
  const bulge = (t: number) => {
    let k = damaged ? 1 : smooth(since(t, tBulge, 0.6));
    if (tRemove !== undefined) k *= 1 - smooth(since(t, tRemove, 0.5));
    return k;
  };
  const shown = (t: number) => pieces.filter((q) => visible(q, t));
  const end = (t: number) => {
    const s = shown(t);
    if (!s.length) return X0;
    const last = s.reduce((a, b) => (b.slot > a.slot ? b : a));
    const e = slotX(last.slot) + W;
    return last.t > 0 ? lerp(e - STEP, e, smooth((t - last.t) / 0.22)) : e;
  };
  const damageX = wrongSlot >= 0 ? slotX(wrongSlot) + W / 2 : slotX(5.5) + W / 2;
  const proteinX = (t: number): number | null => {
    if (tScan === undefined || t < tScan) return null;
    const arrive = tFound ?? tScan + 2.0;
    return lerp(-70, damageX, easeOut((t - tScan) / Math.max(arrive - tScan, 0.5)));
  };
  const polX = (t: number): Point | null => {
    if (tPol === undefined || t < tPol) return null;
    const target = end(t) - 10;
    const jig = tMis !== undefined && t > tMis + 0.3 && t < tMis + 1.0 ? 5 * Math.sin(t * 40) : 0;
    let x = (t < tPol + 0.7 ? lerp(640, target, easeOut((t - tPol) / 0.7)) : target) + jig;
    if (tScan !== undefined && tScan > tPol && t > tScan) {  // copying is over: polymerase leaves
      if (t > tScan + 0.8) return null;
      x = lerp(x, 700, smooth((t - tScan) / 0.8));
    }
    return [x - 40, 264];
  };
  const targets = (t: number): Record<string, Target> => {
    const px = proteinX(t) ?? damageX;
    const pol = polX(t) ?? [end(t), 264];
    const secX = (slotX(sa) + slotX(sb) + W) / 2;
    return {
      top: {x: 283, y: TY + 20, rx: 250, ry: 28}, bottom: {x: 283, y: BY + 20, rx: 250, ry: 28},
      damage: {x: damageX, y: BY + 20, rx: wrongSlot >= 0 ? 30 : 58, ry: 32},
      section: {x: secX, y: BY + 20, rx: (slotX(sb) - slotX(sa) + W) / 2 + 12, ry: 32},
      gap: {x: secX, y: BY + 20, rx: (slotX(sb) - slotX(sa) + W) / 2 + 12, ry: 32},
      backbone: {x: secX, y: BY + 52, rx: (slotX(sb) - slotX(sa) + W) / 2 + 30, ry: 14},
      protein: {x: px, y: 264, rx: 90, ry: 34}, polymerase: {x: pol[0], y: pol[1], rx: 84, ry: 34},
      three_end: {x: end(t) + 18, y: BY + 20, rx: 24, ry: 26},
    };
  };
  const content = (t: number) => {
    const bk = bulge(t);
    const lift = (i: number) => -bk * (i === 5 || i === 6 ? 16 : i === 4 || i === 7 ? 6 : 0);
    const inSection = (i: number) => i >= sa && i <= sb;
    const cut = gap || (tCut !== undefined && t >= tCut);
    const sealed = tReseal !== undefined && t >= tReseal + 0.3;
    const tiles: React.ReactNode[] = [];
    const rungs: React.ReactNode[] = [];
    const s = shown(t);
    for (const q of s) {
      const i = q.slot;
      let letter = BOT[i], fill = '#FFFFFF', color = C.dnaDark, stroke = C.ink;
      if (q.kind === 'wrong' || q.kind === 'mismatch') letter = wrongLetter(i);
      const red = q.kind === 'wrong' || (q.kind === 'mismatch' && tFound !== undefined && t >= tFound) || (bonded(t) && (i === 5 || i === 6) && wrongSlot < 0);
      if (red) { fill = '#FDE3E1'; color = C.wrong; stroke = C.wrong; }
      let dx = 0, dy = lift(i), op = 1, rot = 0;
      // Removed with its section (mismatch or UV), unless it is a replacement.
      const replaced = tReplace !== undefined && inSection(i) && t >= tReplace + 0.3 * (i - sa);
      if (inSection(i) && (gap || tRemove !== undefined) && !replaced) {
        const k = gap ? 1 : since(t, tRemove! + 0.07 * (i - sa), 0.55);
        if (k >= 1) continue;
        dx = 20 * k; dy += 70 * k; op = 1 - k; rot = 25 * k;
      }
      if (replaced) {
        const k = easeOut((t - tReplace! - 0.3 * (i - sa)) / 0.35);
        letter = BOT[i]; fill = '#FFFFFF'; color = C.dnaDark; stroke = C.ink;
        dy = 70 * (1 - k); op = k;
      }
      // Pieces joining during copying fly in; an excised wrong base flies out.
      const k = q.t > 0 ? flyIn(t, q.t, 0.35) : -1;
      if (k >= 0) { dx = 60 * (1 - easeOut(k)); dy = 80 * (1 - easeOut(k)); op = easeOut(k); }
      if (q.until !== undefined && t > q.until - 0.5) {
        const out = clamp((t - (q.until - 0.5)) / 0.5);
        dx = 40 * out; dy = -110 * out; op = 1 - out; rot = 40 * out;
      }
      if (dx === 0 && op > 0.9) rungs.push(<line key={`r${i}`} x1={slotX(i) + W / 2} y1={TY + W + 2} x2={slotX(i) + W / 2} y2={BY + dy - 2} stroke={C.rung} strokeWidth={4} />);
      tiles.push(<Tile key={`b${i}${q.kind}`} x={slotX(i) + dx} y={BY + dy} w={W} h={W} letter={letter} fill={fill} color={color} stroke={stroke} opacity={op} rotate={rot} />);
    }
    // Backbones; the new strand's backbone breaks at the cuts and is resealed at the end.
    const a = slotX(sa) - 7, b = slotX(sb) + W + 7;
    const g = cut && !sealed ? 6 : 0;
    const secPresent = s.some((q) => inSection(q.slot)) && !(gap && tReplace === undefined) &&
      !(tRemove !== undefined && t > tRemove + 0.4 && (tReplace === undefined || t < tReplace));
    const reach = tReplace !== undefined && t >= tReplace ? lerp(a, b, clamp((t - tReplace) / (0.3 * (sb - sa + 1) + 0.3))) : b;
    const ys = (x: number) => BY + W + 10 - bk * 14 * Math.exp(-(((x - (slotX(5.5) + W / 2)) / 70) ** 2));
    const endX = s.length ? Math.max(...s.map((q) => slotX(q.slot) + W)) + 6 : X0;
    const mainEnd = p.stage.copying ? end(t) + 4 : endX;
    const pathAB = Array.from({length: 13}, (_, j) => lerp(a + g, secPresent ? reach : a + g, j / 12)).map((x) => `${x},${ys(x)}`).join(' ');
    const tUvAge = tUv === undefined ? -1 : t - tUv;
    const px = proteinX(t), pol = polX(t);
    const foundK = tFound !== undefined && t >= tFound && t < tFound + 1.8 ? pop((t - tFound) / 0.3) : 0;
    return (
      <g>
        <text x={X0} y={36} fontSize={21} fill={C.ink} style={{...TEXT, fontWeight: 600}}>Original strand</text>
        {proteinX(t) === null && polX(t) === null && <text x={X0} y={BY + W + 44} fontSize={21} fill={C.dnaDark} style={{...TEXT, fontWeight: 600}}>New strand</text>}
        <line x1={X0 - 10} y1={TY - 10} x2={slotX(N) - 4} y2={TY - 10} stroke={C.ink} strokeWidth={6} strokeLinecap="round" />
        {TOP.split('').map((l, i) => <Tile key={`t${i}`} x={slotX(i)} y={TY} w={W} h={W} letter={l} fill={C.template} />)}
        {px !== null && <Enzyme x={px} y={264} w={170} h={60} fill={C.repair} label="Repair proteins" t={t} mood={foundK > 0 ? 'busy' : 'happy'} opacity={1} look={1} />}
        {pol && <Enzyme x={pol[0]} y={pol[1]} w={160} h={60} fill={C.polymerase} label="DNA polymerase" t={t} opacity={1} look={-1} />}
        {rungs}
        {s.length > 0 && (
          <g stroke={C.dnaDark} strokeWidth={6} strokeLinecap="round" fill="none">
            <line x1={X0 - 10} y1={ys(X0)} x2={Math.min(a - g, mainEnd)} y2={ys(X0)} />
            {mainEnd > b && <line x1={b + g} y1={ys(b)} x2={mainEnd} y2={ys(b)} />}
            {secPresent && <polyline points={pathAB} />}
          </g>
        )}
        {tiles}
        {bonded(t) && wrongSlot < 0 && s.some((q) => q.slot === 5) && !(tRemove !== undefined && t > tRemove) && (
          <line x1={slotX(5) + W} y1={BY + lift(5) + W / 2} x2={lerp(slotX(5) + W, slotX(6), damaged ? 1 : pop((t - tBond!) / 0.35))}
            y2={BY + lift(6) + W / 2} stroke={C.wrong} strokeWidth={8} strokeLinecap="round" />
        )}
        {cut && !sealed && [a, b].map((x, i) => (
          <g key={i} transform={`translate(${x} ${BY + W + 10}) scale(${gap ? 1 : pop(since(t, tCut, 0.3))})`}>
            <line x1={-10} y1={-14} x2={10} y2={14} stroke={C.wrong} strokeWidth={5} strokeLinecap="round" />
          </g>
        ))}
        {tReseal !== undefined && [a, b].map((x, i) => <Sparkle key={i} x={x} y={BY + W + 10} k={(t - tReseal) / 0.9} />)}
        {tUvAge >= 0 && tUvAge < 1.6 && (
          <g stroke={C.uv} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={smooth((1.6 - tUvAge) / 0.5)}>
            {[-26, 26].map((o) => {
              const reach2 = easeOut(tUvAge / 0.6);
              const pts = Array.from({length: 9}, (_, j) => {
                const k = (j / 8) * reach2;
                return `${lerp(slotX(5.5) + W / 2 + o * 3, slotX(5.5) + W / 2 + o, k) + (j % 2 ? 9 : -9)},${lerp(-10, BY - 8, k)}`;
              }).join(' ');
              return <polyline key={o} points={pts} />;
            })}
            <text x={slotX(5.5) + W / 2 + 90} y={30} fontSize={30} fill={C.uv} stroke="none" style={TEXT}>UV</text>
          </g>
        )}
        {foundK > 0 && <text x={damageX} y={BY - 18} fontSize={40 * foundK} textAnchor="middle" fill={C.wrong} style={TEXT}>!</text>}
        {p.stage.copying && s.length > 0 && <text x={end(t) + 22} y={BY + 28} fontSize={30} fill={C.dnaDark} textAnchor="middle" style={TEXT}>3′</text>}
        {tMis !== undefined && <Cross x={slotX(Math.max(0, ...pieces.filter((q) => q.kind === 'wrong').map((q) => q.slot))) + W / 2} y={BY + W + 30}
          k={t >= tMis + 0.4 && t < tMis + 1.8 ? pop((t - tMis - 0.4) / 0.3) : 0} />}
      </g>
    );
  };
  return {targets, content};
};
