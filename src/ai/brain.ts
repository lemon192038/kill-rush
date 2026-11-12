import { DT, TILE } from '../core/constants';
import { clamp } from '../core/math';
import type { AbilityDef, Op } from '../data/types';
import { canAct, has } from '../sim/combat';
import { hasLOS, nextWaypoint, tileAt } from '../sim/physics';
import { T } from '../data/maps';
import { territoryZones } from '../sim/modes';
import type { Fighter, World } from '../sim/types';
import { BEHAVIOURS, type AbilityStats } from './profile';

type AbClass = 'offense' | 'defense' | 'mobility' | 'deploy' | 'support';
interface Known { x: number; y: number; vx: number; vy: number; t: number; hpFrac: number }
interface Brain {
  nextThink: number; known: Map<number, Known>; targetId: number; targetKind: 'fighter' | 'structure' | 'none';
  goalX: number; goalY: number; wpX: number; wpY: number; pathT: number;
  strafe: number; strafeT: number; holdT: number; mistakeT: number; dodgeT: number; dodgeX: number; dodgeY: number;
  role: 'striker' | 'passer' | 'defender' | 'keeper' | 'attacker'; learnRange: number; learnN: number; lastPos: { x: number; y: number }; stuckT: number;
  wantAttack: boolean; aimX: number; aimY: number; aimDist: number; press: { s1: boolean; s2: boolean; ult: boolean; dodge: boolean; pass: boolean };
}

const classCache = new Map<AbilityDef, AbClass>();
export function classify(ab: AbilityDef): AbClass {
  const c = classCache.get(ab); if (c) return c;
  const flat: Op[] = []; const visit = (ops: Op[]) => { for (const o of ops) { flat.push(o); if (o.op === 'repeat') visit(o.ops); } }; visit(ab.ops);
  let r: AbClass = 'offense';
  if (flat.some(o => o.op === 'heal' && (o.radius ?? 0) > 0) || flat.some(o => o.op === 'zone' && o.zone.healPs) || flat.some(o => o.op === 'shield' && o.radius)) r = 'support';
  else if (flat.some(o => o.op === 'shield' || o.op === 'heal' || o.op === 'cleanse' || (o.op === 'buff' && (o.status.kind === 'reflect' || o.status.kind === 'defUp')) || o.op === 'invis' || o.op === 'clone')) r = 'defense';
  else if (flat.some(o => o.op === 'turret' || o.op === 'wall')) r = 'deploy';
  else if (flat.every(o => (o.op === 'dash' && !o.damage) || (o.op === 'blink' && !o.damage) || (o.op === 'buff' && o.status.kind === 'haste'))) r = 'mobility';
  classCache.set(ab, r);
  return r;
}
function abilityReach(ab: AbilityDef): number {
  let r = ab.range;
  for (const o of ab.ops) {
    if (o.op === 'nova' && o.at !== 'target') r = Math.min(r, o.radius + 0.3);
    if (o.op === 'dash') r = Math.min(Math.max(o.distance, 1.5), r);
    if (o.op === 'fire') r = Math.min(r, o.spec.range);
    if (o.op === 'repeat' && o.ops.every(x => x.op === 'nova' && x.at !== 'target')) r = Math.min(r, (o.ops[0] as { radius: number }).radius + 0.3);
  }
  return r * TILE;
}

function brainOf(w: World, f: Fighter): Brain {
  if (!f.ai) {
    const roles: Brain['role'][] = ['striker', 'defender', 'passer', 'keeper', 'attacker'];
    const mates = w.fighters.filter(m => m.team === f.team && m.cloneOf === null);
    f.ai = {
      nextThink: w.time + w.rng.range(0.2, 0.6), known: new Map(), targetId: -1, targetKind: 'none', goalX: f.x, goalY: f.y, wpX: f.x, wpY: f.y, pathT: 0,
      strafe: w.rng.chance(0.5) ? 1 : -1, strafeT: 0, holdT: 0, mistakeT: 0, dodgeT: 0, dodgeX: 0, dodgeY: 0,
      role: roles[Math.max(0, mates.indexOf(f)) % roles.length], learnRange: 5 * TILE, learnN: 0, lastPos: { x: f.x, y: f.y }, stuckT: 0,
      wantAttack: false, aimX: 0, aimY: 0, aimDist: 0, press: { s1: false, s2: false, ult: false, dodge: false, pass: false },
    } satisfies Brain;
  }
  return f.ai as Brain;
}

/** Effective stats for this moment (PRODIGY learning, CLUTCH focus). */
function stats(w: World, f: Fighter): AbilityStats {
  const s = { ...f.cpu!.stats };
  const p = f.cpu!.personality;
  if (p === 'PRODIGY') { const k = Math.min(0.12, w.time / 900); s.reading += k; s.control += k * 0.7; s.judgment += k * 0.7; }
  if (p === 'CLUTCH' && f.hp < f.maxHp * 0.4) { s.control *= 1.15; s.reaction *= 1.15; s.judgment *= 1.1; }
  for (const k of Object.keys(s) as (keyof AbilityStats)[]) s[k] = clamp(s[k], 0.02, 0.99);
  return s;
}

export function updateBrain(w: World, f: Fighter) {
  const b = brainOf(w, f);
  const S = stats(w, f);
  const B = BEHAVIOURS[f.cpu!.personality];
  // always clear one-shot presses after one tick so edge detection works
  f.input.skill1 = f.input.skill2 = f.input.ult = f.input.dodge = f.input.pass = false;
  if (b.press.s1) { f.input.skill1 = true; b.press.s1 = false; }
  if (b.press.s2) { f.input.skill2 = true; b.press.s2 = false; }
  if (b.press.ult) { f.input.ult = true; b.press.ult = false; }
  if (b.press.dodge) { f.input.dodge = true; b.press.dodge = false; }
  if (b.press.pass) { f.input.pass = true; b.press.pass = false; }
  // continuous steering toward waypoint every tick
  steer(w, f, b);
  // charge attack hold
  if (f.char.attack.pattern === 'charge' && f.charging) { b.holdT -= DT; f.input.attack = b.holdT > 0; }
  if (w.time < b.nextThink) return;
  // think tick: reaction time depends on reaction stat; variability on stability
  const base = 0.09 + (1 - S.reaction) * 0.33;
  b.nextThink = w.time + Math.max(0.05, base + w.rng.gauss() * 0.06 * (1 - S.stability));
  think(w, f, b, S, B);
}

function steer(w: World, f: Fighter, b: Brain) {
  let dx = b.wpX - f.x, dy = b.wpY - f.y; const d = Math.hypot(dx, dy);
  if (b.dodgeT > 0) { b.dodgeT -= DT; f.input.mx = b.dodgeX; f.input.my = b.dodgeY; return; }
  if (d < 6) { f.input.mx = 0; f.input.my = 0; } else { dx /= d; dy /= d; f.input.mx = dx; f.input.my = dy; }
  if (b.strafeT > 0) b.strafeT -= DT;
}

function see(w: World, f: Fighter, b: Brain, S: AbilityStats) {
  const vis = w.visibility[f.team];
  const memory = 1.2 + S.tactics * 4.5;
  for (let i = 0; i < w.fighters.length; i++) {
    const e = w.fighters[i];
    if (e.team === f.team) continue;
    if (e.alive && vis[i]) {
      const k = b.known.get(e.id);
      const dt = k ? Math.max(0.05, w.time - k.t) : 1;
      const vx = k ? (e.x - k.x) / dt : 0, vy = k ? (e.y - k.y) / dt : 0;
      b.known.set(e.id, { x: e.x, y: e.y, vx: clamp(vx, -400, 400), vy: clamp(vy, -400, 400), t: w.time, hpFrac: e.hp / e.maxHp });
    } else if (!e.alive) b.known.delete(e.id);
  }
  for (const [id, k] of b.known) if (w.time - k.t > memory) b.known.delete(id);
}

function think(w: World, f: Fighter, b: Brain, S: AbilityStats, B: typeof BEHAVIOURS['BEGINNER']) {
  see(w, f, b, S);
  const vis = w.visibility[f.team];
  const mode = w.cfg.mode.id;
  const atk = f.char.attack;
  const melee = atk.pattern === 'melee';
  const range = (melee ? atk.range * TILE + f.radius : atk.range * TILE) * (1 - (f.statuses.get('blind')?.t ? 0.4 : 0));
  // blunder check
  if (w.rng.next() < (1 - S.stability) * 0.12 * (0.5 + B.randomness)) { b.mistakeT = w.rng.range(0.2, 0.7); }
  const blundering = b.mistakeT > 0; b.mistakeT -= 0.25;

  // ── target choice among known enemies
  let target: Fighter | null = null, tKnown: Known | null = null, best = Infinity;
  for (const [id, k] of b.known) {
    const e = w.fighters.find(x => x.id === id); if (!e || !e.alive) continue;
    const d = Math.hypot(k.x - f.x, k.y - f.y) / TILE;
    const stale = w.time - k.t;
    let score = d + stale * 2 - B.lowHpFocus * (1 - k.hpFrac) * 6 * S.judgment;
    if (e.cloneOf !== null) score += 3 * S.judgment + (S.reading > 0.6 ? 6 : 0); // good players ignore clones
    if (e.isBoss) score -= 4;
    if (mode === 'goal' && w.ball?.holder === e.id) score -= 6;
    if (B.teamwork > 0.5 && f.team === w.cfg.playerTeam) { /* allies of player: help player by focusing near threats */ const p = w.fighters.find(x => x.isPlayer); if (p && p.alive) score += Math.hypot(k.x - p.x, k.y - p.y) / TILE * 0.15 * B.teamwork; }
    if (score < best) { best = score; target = e; tKnown = k; }
  }
  const tVisible = target ? !!vis[w.fighters.indexOf(target)] : false;
  const dist = tKnown ? Math.hypot(tKnown.x - f.x, tKnown.y - f.y) : Infinity;
  const hpF = f.hp / f.maxHp;

  // ── dodge visible incoming projectiles (fair: projectiles are visible to everyone)
  if (b.dodgeT <= 0 && w.rng.next() < 0.25 + S.reaction * 0.45 + S.reading * 0.2) {
    for (const p of w.projectiles) {
      if (p.dead || p.team === f.team || p.lob) continue;
      const rx = f.x - p.x, ry = f.y - p.y; const pd = Math.hypot(rx, ry); if (pd > 4 * TILE) continue;
      const sp = Math.hypot(p.vx, p.vy) || 1; const ux = p.vx / sp, uy = p.vy / sp;
      const along = rx * ux + ry * uy; if (along < 0) continue;
      const perp = Math.abs(rx * uy - ry * ux);
      if (perp < f.radius + p.r + 10) {
        const side = rx * uy - ry * ux >= 0 ? 1 : -1;
        b.dodgeX = uy * side; b.dodgeY = -ux * side; b.dodgeT = 0.18 + S.control * 0.2;
        if (S.control > 0.55 && f.dodgeCd <= 0 && p.dmg > f.hp * 0.35 && w.rng.next() < S.judgment) b.press.dodge = true;
        break;
      }
    }
  }
  // ── avoid visible telegraphed casts (wind-up is visible; no pre-knowledge)
  for (const e of w.fighters) {
    if (!e.alive || e.team === f.team || !e.casting || !vis[w.fighters.indexOf(e)]) continue;
    if (w.rng.next() > S.reading * 0.8 + S.reaction * 0.2) continue;
    const c = e.casting; const cx = c.ab.aim === 'point' ? c.tx : e.x, cy = c.ab.aim === 'point' ? c.ty : e.y;
    const r = abilityReach(c.ab) + TILE;
    if ((f.x - cx) ** 2 + (f.y - cy) ** 2 < r * r) { const a = Math.atan2(f.y - cy, f.x - cx); b.dodgeX = Math.cos(a); b.dodgeY = Math.sin(a); b.dodgeT = 0.35; if (c.slot === 3 && f.dodgeCd <= 0 && S.control > 0.5) b.press.dodge = true; }
  }

  // ── decide goal position
  let gx = f.x, gy = f.y;
  const objectiveGoal: { x: number; y: number } | null = objective(w, f, b, B, S);
  const retreatAt = B.retreatHp * (0.6 + S.tactics * 0.6);
  const retreating = hpF < retreatAt && f.cpu!.personality !== 'BERSERKER' && mode !== 'goal' && !(mode === 'gem' && false);
  const desired = melee ? Math.max(f.radius * 2, range * 0.7) : Math.max(1.6 * TILE, range * (0.45 + B.preferredRange * 0.5));
  let engage = false;
  if (target && tKnown) {
    const chase = B.aggression + (1 - (tKnown.hpFrac)) * B.lowHpFocus;
    engage = tVisible ? dist < range * 1.6 + chase * 3 * TILE : (B.aggression > 0.6 || f.cpu!.personality === 'HUNTER') && S.tactics > 0.3;
    if (objectiveGoal && B.objective > 0.6 && dist > range * 1.2) engage = false;
    if (w.storm && objectiveGoal && dist > range * 1.1 && B.aggression < 0.85 && w.time < w.cfg.mode.duration * 0.5) engage = false; // BR: loot first
  }
  if (retreating && target && tKnown) {
    const a = Math.atan2(f.y - tKnown.y, f.x - tKnown.x);
    gx = f.x + Math.cos(a) * 4 * TILE; gy = f.y + Math.sin(a) * 4 * TILE;
    // smart retreat into bush
    if (S.tactics > 0.5) { const bush = nearestTile(w, f, T.BUSH, 5); if (bush && Math.hypot(bush.x - tKnown.x, bush.y - tKnown.y) > dist) { gx = bush.x; gy = bush.y; } }
  } else if (engage && target && tKnown) {
    const a = Math.atan2(f.y - tKnown.y, f.x - tKnown.x);
    if (tVisible) {
      let want = desired;
      if (f.cpu!.personality === 'GENIUS' || f.cpu!.personality === 'PRODIGY') { // adapt to observed range
        b.learnRange = (b.learnRange * b.learnN + dist) / (b.learnN + 1); b.learnN = Math.min(30, b.learnN + 1);
        if (!melee && b.learnRange < range * 0.6) want = Math.max(want, range * 0.85);
      }
      if (b.strafeT <= 0) { b.strafeT = 0.35 + w.rng.next() * (1.2 - S.control * 0.6); if (w.rng.next() < 0.5 + B.feint * 0.3) b.strafe = -b.strafe; }
      const perp = a + (Math.PI / 2) * b.strafe;
      const radial = dist > want + 0.4 * TILE ? -1 : dist < want - 0.6 * TILE ? 1 : 0;
      const sx = Math.cos(a) * radial * 2 * TILE + Math.cos(perp) * (0.6 + S.control) * TILE;
      const sy = Math.sin(a) * radial * 2 * TILE + Math.sin(perp) * (0.6 + S.control) * TILE;
      gx = f.x + sx; gy = f.y + sy;
      if (!hasLOS(w, f.x, f.y, tKnown.x, tKnown.y)) { gx = tKnown.x; gy = tKnown.y; }
    } else { // go check last known / predicted position
      const pr = S.reading * 0.6;
      gx = tKnown.x + tKnown.vx * pr; gy = tKnown.y + tKnown.vy * pr;
    }
  } else if (objectiveGoal) { gx = objectiveGoal.x; gy = objectiveGoal.y; }
  else if (B.bushUse > 0.6 && S.tactics > 0.35) { const bush = nearestTile(w, f, T.BUSH, 8); if (bush) { gx = bush.x; gy = bush.y; } else { gx = w.map.w * TILE / 2; gy = w.map.h * TILE / 2; } }
  else {
    // roam toward center with jitter
    if (Math.hypot(b.goalX - f.x, b.goalY - f.y) < TILE || w.rng.next() < 0.05 + B.randomness * 0.1) { b.goalX = w.map.w * TILE * w.rng.range(0.25, 0.75); b.goalY = w.map.h * TILE * w.rng.range(0.25, 0.75); }
    gx = b.goalX; gy = b.goalY;
  }
  if (B.randomness > 0.7 && w.rng.next() < 0.15) { gx += w.rng.range(-3, 3) * TILE; gy += w.rng.range(-3, 3) * TILE; }
  // storm avoidance (BR)
  if (w.storm) { const s = w.storm; const dc = Math.hypot(f.x - s.cx, f.y - s.cy); if (dc > s.r * 0.85 || Math.hypot(gx - s.cx, gy - s.cy) > s.r * 0.85) { const a = Math.atan2(s.cy - f.y, s.cx - f.x); gx = f.x + Math.cos(a) * 3 * TILE; gy = f.y + Math.sin(a) * 3 * TILE; } }
  // stuck detection
  if (Math.hypot(f.x - b.lastPos.x, f.y - b.lastPos.y) < 4 && Math.hypot(gx - f.x, gy - f.y) > TILE) b.stuckT += 0.3; else b.stuckT = 0;
  b.lastPos = { x: f.x, y: f.y };
  if (b.stuckT > 1) { gx = f.x + w.rng.range(-2, 2) * TILE; gy = f.y + w.rng.range(-2, 2) * TILE; b.stuckT = 0; b.pathT = 0; }
  gx = clamp(gx, TILE, (w.map.w - 1) * TILE); gy = clamp(gy, TILE, (w.map.h - 1) * TILE);
  b.goalX = gx; b.goalY = gy;
  // path
  if (w.time >= b.pathT || Math.hypot(b.wpX - f.x, b.wpY - f.y) < TILE * 0.5) {
    const wp = hasLOS(w, f.x, f.y, gx, gy) && !blockedMove(w, f.x, f.y, gx, gy) ? { x: gx, y: gy } : nextWaypoint(w, f.x, f.y, gx, gy);
    if (wp) { b.wpX = wp.x; b.wpY = wp.y; }
    b.pathT = w.time + 0.3 + (1 - S.tactics) * 0.3;
  }
  if (blundering && w.rng.next() < 0.5) { b.wpX = f.x + w.rng.range(-1, 1) * TILE; b.wpY = f.y + w.rng.range(-1, 1) * TILE; }

  // ── attacking
  f.input.attack = false;
  let aimTargetX = 0, aimTargetY = 0, hasAim = false;
  if (target && tKnown && tVisible && dist < range * 0.98 && hasLOS(w, f.x, f.y, tKnown.x, tKnown.y)) {
    const sp = Math.max(1, atk.speed * TILE);
    const lead = melee ? 0.05 : (dist / sp) * S.reading * (0.4 + S.judgment * 0.5);
    aimTargetX = tKnown.x + tKnown.vx * lead; aimTargetY = tKnown.y + tKnown.vy * lead; hasAim = true;
  } else if (mode === 'vault' || w.storm || mode === 'boss') {
    // structures (vault, boxes)
    for (const s of w.structures) if (!s.dead && s.team !== f.team && s.kind !== 'turret' && Math.hypot(s.x - f.x, s.y - f.y) < range * 0.95 + s.r && hasLOS(w, f.x, f.y, s.x, s.y)) { aimTargetX = s.x; aimTargetY = s.y; hasAim = true; break; }
  }
  if (!hasAim) for (const s of w.structures) if (!s.dead && s.kind === 'turret' && s.team !== f.team && Math.hypot(s.x - f.x, s.y - f.y) < range * 0.9 && hasLOS(w, f.x, f.y, s.x, s.y)) { aimTargetX = s.x; aimTargetY = s.y; hasAim = true; break; }
  const holdingBall = w.ball?.holder === f.id;
  if (hasAim && !holdingBall) {
    const err = w.rng.gauss() * (0.03 + (1 - S.control) * 0.32 + (blundering ? 0.5 : 0));
    const a = Math.atan2(aimTargetY - f.y, aimTargetX - f.x) + err;
    f.input.aimX = Math.cos(a); f.input.aimY = Math.sin(a); f.input.aimDist = Math.hypot(aimTargetX - f.x, aimTargetY - f.y);
    // ammo discipline
    const keep = S.judgment > 0.6 && tKnown && tKnown.hpFrac > 0.3 && !melee ? 1 : 0;
    const fireChance = 0.55 + S.control * 0.4;
    if (f.ammo >= 1 + keep * 0.99 || (tKnown && tKnown.hpFrac < 0.25) || melee) {
      if (w.rng.next() < fireChance && !blundering) {
        f.input.attack = true;
        if (atk.pattern === 'charge') b.holdT = w.rng.range(0.3, 1.0) * (0.5 + S.judgment);
      }
    }
  }
  // ── abilities
  if (canAct(f) && !has(f, 'silence') && !holdingBall) useAbilities(w, f, b, S, B, target, tKnown, tVisible, dist, hasAim);
  // ── KILL&GOAL kicking
  if (holdingBall) goalKick(w, f, b, S);
}

function blockedMove(w: World, x0: number, y0: number, x1: number, y1: number) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (TILE / 2));
  for (let i = 1; i <= n; i++) { const t = tileAt(w, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); if (t === T.WATER || t === T.WALL || t === T.CRATE || t === T.HAZARD) return true; }
  return false;
}

function nearestTile(w: World, f: Fighter, code: number, maxR: number): { x: number; y: number } | null {
  const tx = Math.floor(f.x / TILE), ty = Math.floor(f.y / TILE);
  let best: { x: number; y: number } | null = null, bd = Infinity;
  for (let dy = -maxR; dy <= maxR; dy++) for (let dx = -maxR; dx <= maxR; dx++) {
    const x = tx + dx, y = ty + dy; if (x < 0 || y < 0 || x >= w.map.w || y >= w.map.h) continue;
    if (w.map.tiles[y * w.map.w + x] !== code) continue;
    const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 }; }
  }
  return best;
}

function objective(w: World, f: Fighter, b: Brain, B: typeof BEHAVIOURS['BEGINNER'], S: AbilityStats): { x: number; y: number } | null {
  const mode = w.cfg.mode.id;
  const wantObj = B.objective * (0.4 + S.tactics * 0.8);
  const cx = w.map.w * TILE / 2, cy = w.map.h * TILE / 2;
  const ownBaseY = f.team === 0 ? (w.map.h - 3) * TILE : 3 * TILE;
  switch (mode) {
    case 'gem': {
      const teamGems = w.fighters.filter(m => m.team === f.team).reduce((a, m) => a + m.gems, 0);
      if (f.gems >= 4 && teamGems >= 10 && S.tactics > 0.25) return { x: cx, y: ownBaseY }; // carrier retreats
      let best: { x: number; y: number } | null = null, bd = Infinity;
      for (const p of w.pickups) if (p.kind === 'gem') { const d = Math.hypot(p.x - f.x, p.y - f.y); if (d < bd) { bd = d; best = p; } }
      if (best && (bd < 8 * TILE || wantObj > 0.4)) return { x: best.x, y: best.y };
      return wantObj > 0.3 ? { x: cx, y: cy + (f.team === 0 ? 2 : -2) * TILE } : null;
    }
    case 'vault': {
      const own = w.structures.find(s => s.kind === 'vault' && s.team === f.team), enemy = w.structures.find(s => s.kind === 'vault' && s.team !== f.team);
      if (!own || !enemy) return null;
      if (B.objective > 0.8 && b.role === 'defender') return { x: own.x, y: own.y + (f.team === 0 ? -2 : 2) * TILE };
      return { x: enemy.x, y: enemy.y + (f.team === 0 ? 2.5 : -2.5) * TILE };
    }
    case 'territory': {
      const zs = territoryZones(w); const st = w.modeState as { owner: number[] };
      const idx = b.role === 'striker' || b.role === 'passer' ? 0 : 1;
      const z = st.owner[idx] === f.team && st.owner[1 - idx] !== f.team ? zs[1 - idx] : zs[idx];
      return { x: z.x + w.rng.range(-0.8, 0.8) * TILE, y: z.y + w.rng.range(-0.8, 0.8) * TILE };
    }
    case 'goal': return goalPosition(w, f, b, S);
    case 'boss': { const boss = w.fighters.find(x => x.isBoss && x.alive); return boss ? { x: boss.x, y: boss.y } : null; }
    case 'br-solo': case 'br-duo': case 'br-trio': case 'br-mega': {
      let best: { x: number; y: number } | null = null, bd = Infinity;
      for (const p of w.pickups) if (p.kind === 'cube') { const d = Math.hypot(p.x - f.x, p.y - f.y); if (d < bd) { bd = d; best = p; } }
      if (best && bd < 9 * TILE) return best;
      for (const s of w.structures) if (s.kind === 'box' && !s.dead) { const d = Math.hypot(s.x - f.x, s.y - f.y); if (d < bd) { bd = d; best = s; } }
      if (w.cfg.mode.teamSize > 1) { const mate = w.fighters.find(m => m.team === f.team && m.id !== f.id && m.alive && m.cloneOf === null); if (mate && Math.hypot(mate.x - f.x, mate.y - f.y) > 7 * TILE && B.teamwork > 0.3) return { x: mate.x, y: mate.y }; }
      if (best) { const a = Math.atan2(f.y - best.y, f.x - best.x); return { x: best.x + Math.cos(a) * f.char.attack.range * TILE * 0.6, y: best.y + Math.sin(a) * f.char.attack.range * TILE * 0.6 }; }
      return null;
    }
    case 'tdm': case 'deathmatch': {
      if (B.teamwork > 0.5) { const mates = w.fighters.filter(m => m.team === f.team && m.id !== f.id && m.alive && m.cloneOf === null); if (mates.length) { const mx = mates.reduce((a, m) => a + m.x, 0) / mates.length, my = mates.reduce((a, m) => a + m.y, 0) / mates.length; if (Math.hypot(mx - f.x, my - f.y) > 5 * TILE) return { x: mx, y: my }; } }
      return null;
    }
  }
  return null;
}

function goalPosition(w: World, f: Fighter, b: Brain, S: AbilityStats): { x: number; y: number } | null {
  const ball = w.ball; if (!ball || ball.x < -1000) return null;
  const ownGoalY = f.team === 0 ? (w.map.h - 1.5) * TILE : 1.5 * TILE;
  const enemyGoalY = f.team === 0 ? 1.2 * TILE : (w.map.h - 1.2) * TILE;
  const cx = w.map.w * TILE / 2;
  if (ball.holder === f.id) return { x: cx + (f.x > cx ? -1 : 1) * TILE * 0.5, y: enemyGoalY };
  const holder = ball.holder !== null ? w.fighters.find(x => x.id === ball.holder) : null;
  const mates = w.fighters.filter(m => m.team === f.team && m.alive && m.cloneOf === null);
  const nearest = mates.reduce((a, m) => (Math.hypot(m.x - ball.x, m.y - ball.y) < Math.hypot(a.x - ball.x, a.y - ball.y) ? m : a), mates[0]);
  // No future-ball omniscience: use current velocity with limited, skill-scaled lead
  const lead = S.reading * 0.35;
  const bx = ball.x + ball.vx * lead, by = ball.y + ball.vy * lead;
  if (holder && holder.team === f.team) {
    // support: move ahead for a pass
    return { x: cx + (b.role === 'passer' ? -3 : 3) * TILE, y: (holder.y + enemyGoalY) / 2 };
  }
  switch (b.role) {
    case 'keeper': return { x: cx + (bx - cx) * 0.3, y: ownGoalY + (f.team === 0 ? -1.5 : 1.5) * TILE };
    case 'defender': return { x: (bx + cx) / 2, y: (by + ownGoalY) / 2 };
    default: if (nearest === f || b.role === 'striker' || b.role === 'attacker') return { x: bx, y: by }; return { x: (bx + cx) / 2, y: by };
  }
}

function goalKick(w: World, f: Fighter, b: Brain, S: AbilityStats) {
  const enemyGoalY = f.team === 0 ? 0.5 * TILE : (w.map.h - 0.5) * TILE;
  const cx = w.map.w * TILE / 2;
  const d = Math.hypot(cx - f.x, enemyGoalY - f.y);
  const goalAimX = cx + w.rng.gauss() * (1 - S.control) * 2 * TILE;
  const shotLane = hasLOS(w, f.x, f.y, goalAimX, enemyGoalY);
  // threatened? (visible enemy close)
  const vis = w.visibility[f.team];
  const threat = w.fighters.some((e, i) => e.alive && e.team !== f.team && vis[i] && Math.hypot(e.x - f.x, e.y - f.y) < 2.2 * TILE);
  if (d < (5 + S.judgment * 3) * TILE && shotLane) {
    const a = Math.atan2(enemyGoalY - f.y, goalAimX - f.x);
    f.input.aimX = Math.cos(a); f.input.aimY = Math.sin(a);
    f.input.attack = true; b.holdT = 0.2 + S.control * 0.4;
    // release next think
    setTimeoutRelease(w, f, 0.15 + S.control * 0.4);
  } else if (threat && w.rng.next() < 0.3 + S.judgment * 0.5) {
    const a = Math.atan2(enemyGoalY - f.y, cx - f.x);
    f.input.aimX = Math.cos(a); f.input.aimY = Math.sin(a); b.press.pass = true;
  }
}
function setTimeoutRelease(w: World, f: Fighter, sec: number) { w.scheduled.push({ at: w.tick + Math.round(sec * 60), run: () => { f.input.attack = false; } }); }

function useAbilities(w: World, f: Fighter, b: Brain, S: AbilityStats, B: typeof BEHAVIOURS['BEGINNER'], target: Fighter | null, tk: Known | null, tVisible: boolean, dist: number, _hasAim: boolean) {
  const skillChance = B.skillUse * (0.35 + S.judgment * 0.65);
  if (w.rng.next() > skillChance) return;
  const hpF = f.hp / f.maxHp;
  const underFire = f.combatT < 1.2;
  const slots: (1 | 2 | 3)[] = [1, 2];
  if (f.ult >= 1) slots.push(3);
  for (const slot of slots) {
    if (slot !== 3 && f.cd[slot - 1] > 0) continue;
    const ab = slot === 1 ? f.char.skill1 : slot === 2 ? f.char.skill2 : f.char.ult;
    const cls = classify(ab);
    const reach = abilityReach(ab);
    let use = false;
    let ax = f.input.aimX, ay = f.input.aimY, ad = f.input.aimDist;
    if (target && tk && tVisible) { const a = Math.atan2(tk.y - f.y, tk.x - f.x) + w.rng.gauss() * (1 - S.control) * 0.25; ax = Math.cos(a); ay = Math.sin(a); ad = dist; }
    switch (cls) {
      case 'offense':
        use = !!target && tVisible && dist < reach * 0.95 && hasLOS(w, f.x, f.y, tk!.x, tk!.y);
        if (use && B.comboFocus > 0.5 && S.combo > 0.4 && slot !== 3) use = f.combo > 0 || w.rng.next() < 0.4; // combo players chain off hits
        if (use && f.cpu!.personality === 'BEGINNER' && w.rng.next() < 0.6) use = false;
        if (use && slot === 3 && S.judgment > 0.6) {
          const n = w.fighters.filter((e, i) => e.alive && e.team !== f.team && w.visibility[f.team][i] && Math.hypot(e.x - f.x, e.y - f.y) < reach + TILE).length;
          use = n >= 2 || (tk!.hpFrac < 0.6) || hpF < 0.35;
        }
        break;
      case 'defense': use = (underFire && hpF < 0.65) || (B.counter > 0.6 && underFire && w.rng.next() < 0.5) || (ab.ops.some(o => o.op === 'invis') && !!target && tVisible && dist < 6 * TILE && B.aggression > 0.5); break;
      case 'support': {
        const hurt = w.fighters.some(a => a.alive && a.team === f.team && a.cloneOf === null && a.hp < a.maxHp * 0.6 && Math.hypot(a.x - f.x, a.y - f.y) < 4 * TILE);
        use = hurt || (slot === 3 && underFire);
        break;
      }
      case 'deploy': use = (!!target && tVisible && dist < 8 * TILE) && w.rng.next() < 0.4 + B.deploy * 0.6; break;
      case 'mobility': use = (!!target && tVisible && dist > (f.char.attack.range * TILE) && dist < 8 * TILE && B.aggression > 0.5) || (underFire && hpF < 0.35); if (underFire && hpF < 0.35 && tk) { const a = Math.atan2(f.y - tk.y, f.x - tk.x); ax = Math.cos(a); ay = Math.sin(a); } break;
    }
    if (!use) continue;
    f.input.aimX = ax; f.input.aimY = ay; f.input.aimDist = ad;
    if (slot === 1) b.press.s1 = true; else if (slot === 2) b.press.s2 = true; else b.press.ult = true;
    break;
  }
}

/** Clones: wander toward nearest visible enemy and swing. */
export function updateCloneBrain(w: World, f: Fighter) {
  const vis = w.visibility[f.team];
  let best: Fighter | null = null, bd = Infinity;
  w.fighters.forEach((e, i) => { if (e.alive && e.team !== f.team && vis?.[i]) { const d = Math.hypot(e.x - f.x, e.y - f.y); if (d < bd) { bd = d; best = e; } } });
  f.input.attack = false;
  if (!best) { f.input.mx = Math.cos(f.facing) * 0.5; f.input.my = Math.sin(f.facing) * 0.5; return; }
  const e = best as Fighter;
  const a = Math.atan2(e.y - f.y, e.x - f.x);
  f.input.mx = Math.cos(a); f.input.my = Math.sin(a); f.input.aimX = Math.cos(a); f.input.aimY = Math.sin(a);
  if (bd < f.char.attack.range * TILE * 0.9 && w.tick % 20 === f.id % 20) f.input.attack = true;
}
