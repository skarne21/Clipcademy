import {Beat, Word} from '../src/types';

export type Item = {id: string; text: string};
export type TemplateName = 'steps' | 'compare' | 'flow' | 'term' | 'myth_fact';

// Everything is decided in Python (video/course/templates.py) and passed in, like the biology clips.
export type CourseProps = {
  fps: number;
  durationInFrames: number;
  audio: string; // path under public/
  title: string;
  sources: string;
  template: TemplateName;
  props: Record<string, any>;
  words: Word[];
  events: Beat[];
  energy: number[];
};
