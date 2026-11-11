export interface Vec { x: number; y: number }
export const v = (x = 0, y = 0): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const dist2 = (a: Vec, b: Vec): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
export const norm = (a: Vec): Vec => { const l = Math.hypot(a.x, a.y); return l > 1e-6 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 }; };
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const angleOf = (a: Vec): number => Math.atan2(a.y, a.x);
export const fromAngle = (r: number, l = 1): Vec => ({ x: Math.cos(r) * l, y: Math.sin(r) * l });
export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const rotate = (a: Vec, r: number): Vec => { const c = Math.cos(r), s = Math.sin(r); return { x: a.x * c - a.y * s, y: a.x * s + a.y * c }; };
export const angleDiff = (a: number, b: number): number => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
/** distance from point p to segment ab */
export function segDist(p: Vec, a: Vec, b: Vec): number {
  const abx = b.x - a.x, aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  let t = l2 > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}
export const TAU = Math.PI * 2;
