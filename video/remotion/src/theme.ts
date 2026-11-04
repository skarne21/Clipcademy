import {loadFont} from '@remotion/google-fonts/Fredoka';

export const {fontFamily} = loadFont('normal', {weights: ['500', '600', '700'], subsets: ['latin', 'latin-ext']});
export const FONT = `${fontFamily}, "DejaVu Sans", sans-serif`;

export const C = {
  sky: '#CDE8F1',
  cloud: '#FFFFFF',
  ground: '#A9D69B',
  groundEdge: '#7FB874',
  ink: '#1E2A26',
  board: '#FFFFFF',
  boardShadow: '#9BC7D6',
  template: '#F3EFE4',
  dna: '#2E9E6B',
  dnaDark: '#176B52',
  rung: '#9DB0A8',
  highlight: '#F2A71B',
  wrong: '#D6453D',
  caption: '#FFFFFF',
  captionHot: '#FFD23F',
};

// Phone safe zones at 720x1280 (Context/notes.md, shared contract).
export const SAFE = {top: 120, right: 120, bottom: 200, captionTop: 760, captionBottom: 1000};
export const BOARD = {x: 24, y: 262, w: 566, h: 294};
export const GUIDE = {x: 130, y: 790, scale: 1.36}; // guide-space origin at the feet
