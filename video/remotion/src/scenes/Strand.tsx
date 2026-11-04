import React from 'react';
import {clamp, easeOut, lerp, pop, since, smooth} from '../anim';
import {C} from '../theme';
import {ClipProps, Piece, Point, Target} from '../types';
import {Cross, Enzyme, Scene, TEXT, first, flyIn, visible} from './common';

// Replication: template on top, the new strand (RNA primer + DNA) below, base pairs between.
const SLOT0 = 58, STEP = 46, BW = 40, BH = 30, TY = 82, NY = 182;
const slotX = (i: number) => SLOT0 + STEP * i;
const MID = (TY + BH + NY) / 2;
const EY = 254; // enzymes hold the new strand from below

export const strandScene = (p: ClipProps): Scene => {
  const {events, pieces} = p;
  const slots = Number(p.stage.slots ?? 10);
  const shown = (t: number) => pieces.filter((q) => visible(q, t));
  const end = (t: number) => {
    const s = shown(t);
    if (!s.length) return SLOT0;
    const last = s.reduce((a, b) => (b.slot > a.slot ? b : a));
    const e = slotX(last.slot) + BW;
    return last.t > 0 ? lerp(e - STEP, e, smooth((t - last.t) / 0.22)) : e;
  };
  const tPrimase = first(events, 'primase');
  const rna = pieces.filter((q) => q.kind === 'rna' && q.t > 0);
  const primaseDone = rna.length ? rna[rna.length - 1].t + 0.7 : (tPrimase ?? 0) + 1.5;
  const primaseX = (t: number): Point | null => {
    if (tPrimase === undefined || t < tPrimase || t > primaseDone + 0.8) return null;
    const home = shown(t).length ? end(t) - 20 : SLOT0 + 40;
    if (t < tPrimase + 0.6) return [lerp(640, home, easeOut((t - tPrimase) / 0.6)), EY];
    if (t > primaseDone) return [lerp(home, 700, smooth((t - primaseDone) / 0.8)), EY];
    return [home, EY];
  };
  const tPol = first(events, 'polymerase');
  const tFail = first(events, 'fail');
  const polX = (t: number): Point | null => {
    if (tPol === undefined || t < tPol) return null;
    const own = shown(t).length ? end(t) - 40 : SLOT0 + 60;
    // Step aside to x=455 while primase works, gliding both ways.
    let target = own;
    if (tPrimase !== undefined && t >= tPrimase) {
      const away = smooth((t - tPrimase) / 0.6) * (1 - smooth((t - primaseDone) / 0.6));
      target = lerp(own, 455, away);
    }
    const arrive = lerp(660, target, easeOut((t - tPol) / 0.8));
    const shake = tFail !== undefined && t >= tFail && t < tFail + 0.6 ? 6 * Math.sin((t - tFail) * 40) : 0;
    return [(t < tPol + 0.8 ? arrive : target) + shake, EY];
  };
  const targets = (t: number): Record<string, Target> => {
    const e = end(t);
    const nRna = shown(t).filter((q) => q.kind === 'rna').length;
    const pol = polX(t) ?? [470, MID];
    const pri = primaseX(t) ?? [470, MID];
    return {
      template: {x: 284, y: TY + BH / 2, rx: 250, ry: 26},
      new_5: {x: 30, y: NY + BH / 2, rx: 24, ry: 24},
      new_3: {x: e + 22, y: NY + BH / 2, rx: 26, ry: 26},
      strand: {x: (SLOT0 + e) / 2, y: NY + BH / 2, rx: Math.max(30, (e - SLOT0) / 2 + 18), ry: 26},
      primer: {x: SLOT0 + (nRna * STEP) / 2, y: NY + BH / 2, rx: Math.max(30, (nRna * STEP) / 2 + 12), ry: 26},
      ghost: {x: slotX(0) + 2 * STEP - 3, y: NY + BH / 2, rx: 2 * STEP + 8, ry: 26},
      arrow: {x: 300, y: 262, rx: 150, ry: 22},
      polymerase: {x: pol[0], y: pol[1], rx: 84, ry: 34},
      primase: {x: pri[0], y: pri[1], rx: 60, ry: 34},
    };
  };
  const content = (t: number) => {
    const s = shown(t);
    const e = end(t);
    const tGhost = first(events, 'ghost');
    const fade = 1 - since(t, tGhost, 0.5);
    const labelK = (which: string) => {
      const at = first(events, 'label', which);
      return at === undefined ? 1 : pop((t - at) / 0.35);
    };
    const blocks: React.ReactNode[] = [];
    for (let i = 0; i < slots; i++) blocks.push(<rect key={`t${i}`} x={slotX(i)} y={TY} width={BW} height={BH} rx={8} fill={C.template} />);
    s.forEach((q: Piece, i) => {
      const squash = q.t > 0 ? 1 - 0.18 * Math.sin(Math.PI * clamp((t - q.t) / 0.2)) : 1;
      const grow = q.kind === 'rna' && q.t > 0 ? pop((t - q.t) / 0.3) : 1;
      blocks.push(
        <g key={`n${i}`} opacity={fade}>
          <line x1={slotX(q.slot) + BW / 2} y1={TY + BH + 2} x2={slotX(q.slot) + BW / 2} y2={NY - 2} stroke={C.rung} strokeWidth={4} />
          <rect x={slotX(q.slot) + (BW * (1 - grow)) / 2} y={NY + BH * (1 - squash)} width={BW * grow} height={BH * squash} rx={8}
            fill={q.kind === 'rna' ? C.rna : C.dna} />
        </g>,
      );
    });
    const flying = pieces.map((q, j) => {
      if (q.kind !== 'dna' || q.t <= 0) return null;
      const k = flyIn(t, q.t);
      if (k >= 0) {
        const kk = easeOut(k);
        const x = lerp(slotX(q.slot) + 90, slotX(q.slot), kk);
        const y = lerp(NY + 120, NY, kk) - 40 * Math.sin(Math.PI * kk);
        return <rect key={`f${j}`} x={x} y={y} width={BW} height={BH} rx={8} fill={C.dna} transform={`rotate(${-25 * (1 - kk)} ${x + BW / 2} ${y + BH / 2})`} />;
      }
      if (t >= q.t && t < q.t + 0.35) {
        const k2 = (t - q.t) / 0.35;
        return <circle key={`c${j}`} cx={slotX(q.slot) + BW} cy={NY + BH / 2} r={8 + 22 * k2} stroke={C.highlight} strokeWidth={5} opacity={1 - k2} fill="none" />;
      }
      return null;
    });
    // A piece tries the 5' end and bounces off.
    const tBounce = first(events, 'bounce');
    let bounce: React.ReactNode = null;
    if (tBounce !== undefined && t >= tBounce && t < tBounce + 1.4) {
      const a = t - tBounce;
      const hx = slotX(-1) + 4;
      let x: number, y: number, op = 1;
      if (a < 0.5) {
        const k = easeOut(a / 0.5);
        x = lerp(hx + 20, hx, k);
        y = lerp(NY + 120, NY, k) - 30 * Math.sin(Math.PI * k);
      } else {
        const k = (a - 0.5) / 0.9;
        x = hx - 60 * k;
        y = NY + 140 * k * k - 50 * k;
        op = 1 - k;
      }
      bounce = (
        <g>
          <rect x={x} y={y} width={BW} height={BH} rx={8} fill={C.dna} opacity={op} stroke={C.ink} strokeWidth={4}
            transform={`rotate(${a > 0.5 ? -40 * (a - 0.5) : 0} ${x + BW / 2} ${y + BH / 2})`} />
          <Cross x={hx + 2} y={NY - 28} k={a >= 0.45 && a < 1.2 ? pop((a - 0.45) / 0.25) : 0} />
        </g>
      );
    }
    const ak = smooth(since(t, first(events, 'arrow'), 0.7));
    const gk = tGhost === undefined || (s.length && t > tGhost + 0.6) ? 0 : pop((t - tGhost - 0.3) / 0.4);
    const l5 = labelK('5') * fade, l3 = labelK('3') * fade;
    const pri = primaseX(t), pol = polX(t);
    const enzymes = pri || pol;
    const failK = tFail !== undefined && t >= tFail && t < tFail + 2.2 ? pop((t - tFail - 0.2) / 0.3) : 0;
    return (
      <g>
        <text x={SLOT0} y={48} fontSize={22} fill={C.ink} style={{...TEXT, fontWeight: 600}}>Template DNA</text>
        <text x={30} y={TY + 23} fontSize={26} fill={C.ink} textAnchor="middle" style={TEXT}>3′</text>
        <text x={slotX(slots) + 16} y={TY + 23} fontSize={26} fill={C.ink} textAnchor="middle" style={TEXT}>5′</text>
        <line x1={SLOT0 - 12} y1={TY - 8} x2={slotX(slots) + 2} y2={TY - 8} stroke={C.ink} strokeWidth={6} strokeLinecap="round" />
        <g stroke={C.ink} strokeWidth={4}>{blocks}</g>
        {s.length > 0 && fade > 0 && (
          <line x1={SLOT0 - 6} y1={NY + BH + 9} x2={e + 4} y2={NY + BH + 9} stroke={C.dnaDark} strokeWidth={6} strokeLinecap="round" opacity={fade} />
        )}
        <g stroke={C.ink} strokeWidth={4}>{flying}</g>
        {bounce}
        {pri && <Enzyme x={pri[0]} y={pri[1]} w={110} h={64} fill={C.primase} label="Primase" t={t} mood="busy" opacity={1} />}
        {pol && <Enzyme x={pol[0]} y={pol[1]} w={160} h={64} fill={C.polymerase} label="DNA polymerase" t={t}
          mood={failK > 0 ? 'sad' : 'happy'} opacity={1} look={-1} />}
        {pol && <Cross x={Math.min(pol[0], 478) + 82} y={EY - 30} k={failK} />}
        {s.length > 0 && l5 > 0 && <text x={30} y={NY + 26} fontSize={36 * l5} fill={C.dnaDark} textAnchor="middle" style={TEXT}>5′</text>}
        {s.length > 0 && l3 > 0 && <text x={e + 25} y={NY + 26} fontSize={36 * l3} fill={C.dnaDark} textAnchor="middle" style={TEXT}>3′</text>}
        {s.length > 0 && fade > 0 && !enzymes && ak === 0 && (
          <text x={SLOT0} y={NY + 70} fontSize={22} fill={C.dnaDark} opacity={fade} style={{...TEXT, fontWeight: 600}}>
            {s.every((q) => q.kind === 'rna') ? 'RNA primer' : s.some((q) => q.kind === 'rna') ? 'RNA primer + new DNA' : 'New DNA'}
          </text>
        )}
        {ak > 0 && (
          <g opacity={fade}>
            <line x1={170} y1={262} x2={lerp(172, 372, ak)} y2={262} stroke={C.dnaDark} strokeWidth={7} strokeLinecap="round" />
            <polygon points={`${lerp(172, 372, ak) + 16},262 ${lerp(172, 372, ak) - 2},251 ${lerp(172, 372, ak) - 2},273`} fill={C.dnaDark} />
            <text x={400} y={273} fontSize={30 * smooth((ak - 0.4) / 0.6)} fill={C.dnaDark} style={TEXT}>5′ → 3′</text>
          </g>
        )}
        {gk > 0 && (
          <g>
            <rect x={slotX(0)} y={NY} width={4 * STEP - 6} height={BH} rx={8} fill="none" stroke={C.ink} strokeWidth={4} strokeDasharray="10 8" opacity={clamp(gk)} />
            <text x={slotX(0) + 2 * STEP - 3} y={NY + 25} fontSize={32 * gk} fill={C.ink} textAnchor="middle" style={TEXT}>?</text>
          </g>
        )}
      </g>
    );
  };
  return {targets, content};
};
