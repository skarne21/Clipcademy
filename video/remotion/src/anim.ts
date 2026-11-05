// Small easing helpers shared by every component. Times are in seconds.
export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const smooth = (v: number) => {
  const x = clamp(v);
  return x * x * (3 - 2 * x);
};
export const easeOut = (v: number) => 1 - (1 - clamp(v)) ** 3;
export const pop = (v: number) => {
  const x = clamp(v);
  const c = 1.70158;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
};
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const since = (t: number, start: number | undefined, dur: number) =>
  start === undefined ? 0 : clamp((t - start) / dur);
export const angleLerp = (a: number, b: number, k: number) => a + ((((b - a + 180) % 360) + 360) % 360 - 180) * k;
export const dir = (deg: number): [number, number] => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
