export type Word = {text: string; start: number; end: number};
export type Beat = {t: number; action: string; arg: string};

// Everything the clip shows is decided in Python (video/beats.py) and passed in here,
// so the animation is a pure function of the reviewed script and its narration timing.
export type ClipProps = {
  fps: number;
  durationInFrames: number;
  audio: string; // path under public/
  title: string;
  sources: string;
  diagram: 'strand' | 'repair' | 'transcription' | 'translation' | 'timeline';
  stage: Record<string, number | boolean | number[]>;
  words: Word[];
  events: Beat[];
  pieces: Piece[]; // strand pieces with the time each one joins (and leaves, if removed)
  energy: number[]; // narration loudness per frame, 0..1
};

export type Point = [number, number];
export type Target = {x: number; y: number; rx: number; ry: number};

export type Piece = {slot: number; kind: string; t: number; until?: number};
