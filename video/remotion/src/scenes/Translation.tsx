import React from 'react';
import {clamp, easeOut, lerp, pop, smooth} from '../anim';
import {C} from '../theme';
import {ClipProps, Point, Target} from '../types';
import {Check, Cross, Scene, Sparkle, TEXT, Tile} from './common';

// Translation: ribosome with E, P, A sites over an mRNA that slides left one codon per shift.
export const CODONS = ['AUG', 'GCU', 'AAC', 'UGG', 'CCA', 'GAU'];
const COMP: Record<string, string> = {A: 'U', U: 'A', G: 'C', C: 'G'};
export const anticodon = (codon: string) => codon.split('').map((b) => COMP[b]).join('');
const SITE: Record<string, number> = {E: 185, P: 283, A: 381};
const STEP = 98, MRNA_Y = 214, BEAD_Y = 66;
const BEADS = ['#F2B935', '#7FC8F8', '#9BD97B', '#C9A3F0', '#F49CAB', '#7FD6C2'];

type TRNA = {codon: number; anti: string; enter: number; exit?: number; reject?: number; wrong?: boolean; pair?: number};

export const translationScene = (p: ClipProps): Scene => {
  const ev = p.events;
  const shifts: number[] = [];
  const trnas: TRNA[] = [];
  const bonds: {t: number; from: number; to: number}[] = [];
  let s = 0;
  if (p.stage.p_trna !== false) trnas.push({codon: 0, anti: anticodon(CODONS[0]), enter: -1, pair: -1});
  const at = (j: number) => trnas.find((r) => r.codon === j && !r.wrong);
  for (const e of ev) {
    if (e.action === 'enter') { const j = e.arg === 'p' ? s : s + 1; trnas.push({codon: j, anti: anticodon(CODONS[j]), enter: e.t}); }
    if (e.action === 'reject') trnas.push({codon: s + 1, anti: e.arg || 'GGG', enter: e.t, reject: e.t + 0.6, exit: e.t + 1.5, wrong: true});
    if (e.action === 'pair') { const r = at(s + 1); if (r) r.pair = e.t; }
    if (e.action === 'bond') { const from = trnas.indexOf(at(s)!), to = trnas.indexOf(at(s + 1)!); if (from >= 0 && to >= 0) bonds.push({t: e.t, from, to}); }
    if (e.action === 'shift') { shifts.push(e.t); s += 1; }
    if (e.action === 'exit') { const r = at(s - 1); if (r) r.exit = e.t; }
  }
  const shiftAt = (t: number) => shifts.reduce((n, st) => n + smooth((t - st) / 0.6), 0);
  const codonX = (j: number, t: number) => SITE.P + STEP * (j - shiftAt(t));
  const pos = (r: TRNA, t: number): Point & {op: number} | null => {
    if (t < r.enter) return null;
    let x = codonX(r.codon, t), y = 0, op = 1;
    const k = r.enter > 0 ? easeOut((t - r.enter) / 0.6) : 1;
    x = lerp(x + 150, x, k); y = lerp(-180, 0, k);
    if (r.exit !== undefined && t > r.exit) {
      const o = clamp((t - r.exit) / 0.8);
      x += (r.wrong ? 120 : -70) * o; y -= 170 * o; op = 1 - o;
      if (o >= 1) return null;
    }
    if (r.wrong && r.reject !== undefined && t > r.reject && (r.exit === undefined || t < r.exit)) x += 4 * Math.sin(t * 40);
    return Object.assign([x, y] as Point, {op});
  };
  // Which tRNA holds the growing chain, and how many beads it has.
  const chainAt = (t: number) => {
    let holder = trnas.findIndex((r) => r.enter < 0), beads = 1, moving = -1, from = holder;
    for (const b of bonds) {
      if (t < b.t) break;
      from = holder; holder = b.to; beads += 1;
      if (t < b.t + 0.6) moving = (t - b.t) / 0.6;
    }
    return {holder, beads, moving, from};
  };
  const targets = (t: number): Record<string, Target> => {
    const latest = trnas.filter((r) => !r.wrong && t >= r.enter && (r.exit === undefined || t < r.exit)).pop();
    const lp = latest ? pos(latest, t) : null;
    const ch = chainAt(t);
    const hp = ch.holder >= 0 ? pos(trnas[ch.holder], t) : null;
    return {
      a_site: {x: SITE.A, y: 134, rx: 46, ry: 76}, p_site: {x: SITE.P, y: 134, rx: 46, ry: 76}, e_site: {x: SITE.E, y: 134, rx: 46, ry: 76},
      codon: {x: SITE.A, y: MRNA_Y + 13, rx: 50, ry: 20}, anticodon: {x: lp ? lp[0] : SITE.A, y: 184, rx: 48, ry: 18},
      start: {x: codonX(0, t), y: MRNA_Y + 13, rx: 50, ry: 20}, mrna: {x: 283, y: MRNA_Y + 13, rx: 270, ry: 22},
      chain: {x: hp ? hp[0] : SITE.P, y: BEAD_Y, rx: 30 + 12 * ch.beads, ry: 30}, peptide: {x: (SITE.P + SITE.A) / 2, y: BEAD_Y, rx: 70, ry: 26},
      trna: {x: lp ? lp[0] : SITE.A, y: 130, rx: 50, ry: 90},
    };
  };
  const content = (t: number) => {
    const ch = chainAt(t);
    const codonTiles = CODONS.map((cd, j) => cd.split('').map((b, k) => (
      <Tile key={`m${j}${k}`} x={codonX(j, t) - 44 + 30 * k} y={MRNA_Y} w={27} h={27} letter={b} fill={j === 0 ? '#FFF1C7' : '#FFFFFF'} size={18} />
    )));
    const drawn = trnas.map((r, i) => {
      const q = pos(r, t);
      if (!q) return null;
      const [x, y] = q;
      const paired = !r.wrong && t >= (r.pair ?? r.enter + 0.6);
      const red = r.wrong && r.reject !== undefined && t >= r.reject;
      const hasBead = i === ch.holder ? false : !bonds.some((b) => b.to === i && t >= b.t) && !bonds.some((b) => b.from === i && t >= b.t) && !(r.enter < 0 && bonds.length && t >= bonds[0].t);
      const ownBead = i !== ch.holder && hasBead && !(i === ch.from && ch.moving >= 0);
      return (
        <g key={i} opacity={q.op}>
          <line x1={x} y1={y + BEAD_Y + 16} x2={x} y2={y + 92} stroke={C.ink} strokeWidth={5} />
          <rect x={x - 32} y={y + 90} width={64} height={78} rx={16} fill={C.trna} stroke={C.ink} strokeWidth={5} />
          <text x={x} y={y + 136} fontSize={17} textAnchor="middle" fill={C.ink} style={{...TEXT, fontWeight: 600}}>tRNA</text>
          {r.anti.split('').map((b, k) => (
            <Tile key={k} x={x - 44 + 30 * k} y={y + 172} w={27} h={26} letter={b} size={17}
              fill={red ? '#FDE3E1' : paired ? '#C9EED8' : '#FFFFFF'} color={red ? C.wrong : C.ink} stroke={red ? C.wrong : C.ink} />
          ))}
          {paired && [0, 1, 2].map((k) => <line key={`p${k}`} x1={x - 30 + 30 * k} y1={y + 199} x2={x - 30 + 30 * k} y2={MRNA_Y - 1} stroke={C.dna} strokeWidth={4} />)}
          {ownBead && <circle cx={x} cy={y + BEAD_Y} r={17} fill={BEADS[r.codon % BEADS.length]} stroke={C.ink} strokeWidth={4} />}
          {ownBead && r.codon === 0 && <text x={x} y={y + BEAD_Y + 6} fontSize={14} textAnchor="middle" fill={C.ink} style={TEXT}>Met</text>}
          {red && <Cross x={x + 46} y={y + 160} k={pop((t - r.reject!) / 0.3)} />}
          {paired && r.enter > 0 && t < (r.pair ?? r.enter + 0.6) + 0.9 && <Check x={x + 46} y={y + 160} k={pop((t - (r.pair ?? r.enter + 0.6)) / 0.3)} />}
        </g>
      );
    });
    // The growing chain of amino acids rides on the tRNA that holds it.
    let chain: React.ReactNode = null;
    if (ch.holder >= 0) {
      const hp = pos(trnas[ch.holder], t);
      const fp = ch.moving >= 0 ? pos(trnas[ch.from], t) : null;
      if (hp) {
        const k = ch.moving >= 0 && fp ? smooth(ch.moving) : 1;
        const bx = fp ? lerp(fp[0], hp[0], k) : hp[0];
        const by = fp ? lerp(fp[1], hp[1], k) : hp[1];
        const order = Array.from({length: ch.beads}, (_, n) => n);
        chain = (
          <g opacity={hp.op}>
            {order.map((n) => {
              const cx = bx - 26 * (ch.beads - 1 - n), cy = by + BEAD_Y - 14 * (ch.beads - 1 - n);
              const codon = n === 0 ? 0 : trnas[bonds[n - 1].to].codon;
              return (
                <g key={n}>
                  {n > 0 && <line x1={cx - 26} y1={cy + 14} x2={cx} y2={cy} stroke={C.ink} strokeWidth={5} />}
                  <circle cx={cx} cy={cy} r={17} fill={BEADS[codon % BEADS.length]} stroke={C.ink} strokeWidth={4} />
                  {codon === 0 && <text x={cx} y={cy + 6} fontSize={14} textAnchor="middle" fill={C.ink} style={TEXT}>Met</text>}
                </g>
              );
            })}
          </g>
        );
      }
    }
    const sparks = bonds.map((b, i) => <Sparkle key={i} x={(SITE.P + SITE.A) / 2} y={BEAD_Y} k={(t - b.t) / 0.8} />);
    return (
      <g>
        <rect x={128} y={196} width={310} height={64} rx={26} fill={C.ribosome} stroke={C.ink} strokeWidth={5} />
        <rect x={118} y={16} width={330} height={186} rx={44} fill={C.ribosome} fillOpacity={0.85} stroke={C.ink} strokeWidth={5} />
        {Object.entries(SITE).map(([name, x]) => (
          <g key={name}>
            <rect x={x - 46} y={86} width={92} height={112} rx={16} fill="#FFFFFF" fillOpacity={0.55} stroke={C.ink} strokeWidth={3} strokeDasharray="8 6" />
            <text x={x} y={52} fontSize={30} textAnchor="middle" fill={C.ink} style={TEXT}>{name}</text>
          </g>
        ))}
        <text x={458} y={40} fontSize={20} fill={C.ink} style={{...TEXT, fontWeight: 600}}>Ribosome</text>
        <text x={16} y={MRNA_Y + 64} fontSize={20} fill={C.ink} style={{...TEXT, fontWeight: 600}}>mRNA</text>
        {codonTiles}
        {drawn}
        {chain}
        {sparks}
      </g>
    );
  };
  return {targets, content};
};
