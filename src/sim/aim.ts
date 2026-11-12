import { TILE } from '../core/constants';
import { hasLOS } from './physics';
import type { Fighter, World } from './types';

/**
 * Auto-aim target for quick-tap attacks. Aims at the CURRENT position (no perfect lead), so moving
 * targets can still dodge — auto-aim never guarantees a hit.
 */
export function autoAim(w: World, f: Fighter, rangeTiles: number): { ang: number; dist: number } | null {
  const vis = w.visibility[f.team];
  let best: { ang: number; dist: number } | null = null, bs = Infinity;
  const R = rangeTiles * TILE * 1.15;
  w.fighters.forEach((e, i) => {
    if (!e.alive || e.team === f.team || !vis[i]) return;
    const d = Math.hypot(e.x - f.x, e.y - f.y); if (d > R) return;
    const los = hasLOS(w, f.x, f.y, e.x, e.y);
    const s = d / R + (e.hp / e.maxHp) * 0.35 + (los ? 0 : 1.2) + (e.cloneOf !== null ? 0.3 : 0);
    if (s < bs) { bs = s; best = { ang: Math.atan2(e.y - f.y, e.x - f.x), dist: d }; }
  });
  if (!best) for (const s of w.structures) {
    if (s.dead || s.team === f.team) continue;
    const d = Math.hypot(s.x - f.x, s.y - f.y); if (d > R + s.r) continue;
    const sc = d / R + 0.5; if (sc < bs) { bs = sc; best = { ang: Math.atan2(s.y - f.y, s.x - f.x), dist: d }; }
  }
  return best;
}

/** Gentle aim assist for manual aim: nudges toward a target within a small cone. */
export function assistAim(w: World, f: Fighter, ang: number, rangeTiles: number): number {
  const vis = w.visibility[f.team];
  let bestDa = 0.14, out = ang;
  w.fighters.forEach((e, i) => {
    if (!e.alive || e.team === f.team || !vis[i]) return;
    const d = Math.hypot(e.x - f.x, e.y - f.y); if (d > rangeTiles * TILE * 1.1) return;
    let da = Math.atan2(e.y - f.y, e.x - f.x) - ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    if (Math.abs(da) < bestDa) { bestDa = Math.abs(da); out = ang + da * 0.5; }
  });
  return out;
}
