import { TILE } from '../core/constants';
import { T } from '../data/maps';
import type { World } from './types';

export const tileAt = (w: World, px: number, py: number): number => {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= w.map.w || ty >= w.map.h) return T.WALL;
  return w.map.tiles[ty * w.map.w + tx];
};
export const solidMove = (t: number) => t === T.WALL || t === T.CRATE || t === T.WATER || t === T.GOAL0 || t === T.GOAL1;
export const solidShot = (t: number) => t === T.WALL || t === T.CRATE;

/** Circle vs tile-grid collision. Moves (x,y) by (dx,dy) with axis separation & sliding. */
export function moveCircle(w: World, x: number, y: number, r: number, dx: number, dy: number, solid = solidMove): { x: number; y: number; hitX: boolean; hitY: boolean } {
  let hitX = false, hitY = false;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (r * 0.5)));
  const sx = dx / steps, sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    if (!collides(w, x + sx, y, r, solid)) x += sx; else hitX = true;
    if (!collides(w, x, y + sy, r, solid)) y += sy; else hitY = true;
  }
  return { x, y, hitX, hitY };
}

export function collides(w: World, x: number, y: number, r: number, solid = solidMove): boolean {
  const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = tx < 0 || ty < 0 || tx >= w.map.w || ty >= w.map.h ? T.WALL : w.map.tiles[ty * w.map.w + tx];
    if (!solid(t)) continue;
    const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
    const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
    if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
  }
  return false;
}

/** Line of sight over shot-blocking tiles (DDA). */
export function hasLOS(w: World, ax: number, ay: number, bx: number, by: number): boolean {
  const d = Math.hypot(bx - ax, by - ay);
  const n = Math.ceil(d / (TILE / 3));
  for (let i = 1; i < n; i++) {
    const t = tileAt(w, ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n);
    if (solidShot(t)) return false;
  }
  return true;
}

/** BFS on tile grid returning next waypoint (px) toward goal. Cached per call; maps are small (<= 56x56). */
export function nextWaypoint(w: World, fx: number, fy: number, gx: number, gy: number, maxNodes = 2500): { x: number; y: number } | null {
  const W = w.map.w, H = w.map.h;
  const sx = Math.floor(fx / TILE), sy = Math.floor(fy / TILE);
  let tx = Math.floor(gx / TILE), ty = Math.floor(gy / TILE);
  tx = Math.max(0, Math.min(W - 1, tx)); ty = Math.max(0, Math.min(H - 1, ty));
  if (sx === tx && sy === ty) return { x: gx, y: gy };
  const prev = new Int32Array(W * H).fill(-1);
  const start = sy * W + sx, goal = ty * W + tx;
  const q = new Int32Array(W * H); let qh = 0, qt = 0;
  q[qt++] = start; prev[start] = start;
  let found = -1, best = start, bestD = Infinity, nodes = 0;
  while (qh < qt && nodes < maxNodes) {
    const cur = q[qh++]; nodes++;
    if (cur === goal) { found = cur; break; }
    const cx = cur % W, cy = (cur / W) | 0;
    const dd = Math.abs(cx - tx) + Math.abs(cy - ty); if (dd < bestD) { bestD = dd; best = cur; }
    for (let k = 0; k < 8; k++) {
      const dx = [1, -1, 0, 0, 1, 1, -1, -1][k], dy = [0, 0, 1, -1, 1, -1, 1, -1][k];
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx; if (prev[ni] !== -1) continue;
      if (solidMove(w.map.tiles[ni])) continue;
      if (dx && dy && (solidMove(w.map.tiles[cy * W + nx]) || solidMove(w.map.tiles[ny * W + cx]))) continue;
      prev[ni] = cur; q[qt++] = ni;
    }
  }
  let node = found >= 0 ? found : best;
  if (node === start) return found >= 0 ? { x: gx, y: gy } : null;
  // walk back to the first step after start; skip ahead while LOS allows smoothing
  const path: number[] = [];
  while (node !== start) { path.push(node); node = prev[node]; }
  path.reverse();
  let pick = path[0];
  for (let i = Math.min(path.length - 1, 4); i >= 0; i--) {
    const p = path[i]; const px = (p % W) * TILE + TILE / 2, py = ((p / W) | 0) * TILE + TILE / 2;
    if (hasLOS(w, fx, fy, px, py)) { pick = p; break; }
  }
  if (pick === goal && found >= 0) return { x: gx, y: gy };
  return { x: (pick % W) * TILE + TILE / 2, y: ((pick / W) | 0) * TILE + TILE / 2 };
}
