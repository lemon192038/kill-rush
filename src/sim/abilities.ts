import { TILE } from '../core/constants';
import { clamp } from '../core/math';
import type { AbilityDef, Element, Op, ProjectileSpec, StatusApply } from '../data/types';
import { T } from '../data/maps';
import { applyStatus, canAct, damageFighter, damageStructure, has, healFighter, pow, revealFighter } from './combat';
import { collides, hasLOS, solidShot, tileAt } from './physics';
import type { Fighter, Projectile, World } from './types';
import { themeOf } from '../data/skins';

const ELEMENT_COLOR: Record<string, string> = { fire: '#ff7a2f', ice: '#9be8ff', electric: '#ffe94a', poison: '#a6ff4a', light: '#fff3b0', dark: '#b07cff', earth: '#d9a066', water: '#4fb8ff', arcane: '#ff6bf0', physical: '#ffffff' };

export function projColor(f: Fighter, spec: ProjectileSpec): string {
  if (spec.element && spec.element !== 'physical') return ELEMENT_COLOR[spec.element];
  return themeOf(f.skinId).accent;
}

export function schedule(w: World, delayFrames: number, run: () => void) {
  if (delayFrames <= 0) run(); else w.scheduled.push({ at: w.tick + delayFrames, run });
}

/** Spawn projectile(s) for a spec from fighter f in direction ang. */
export function fireSpec(w: World, f: Fighter, spec: ProjectileSpec, ang: number, kind: Projectile['kind'], dmgMul = 1, targetDist = 0, ambush = false) {
  const count = spec.pattern === 'burst' || spec.pattern === 'beam' ? 1 : spec.count ?? 1;
  const spread = ((spec.spreadDeg ?? 0) * Math.PI) / 180;
  const blind = pow(f, 'blind');
  const range = spec.range * TILE * (1 - blind * 0.5);
  for (let i = 0; i < count; i++) {
    let a = ang;
    if (count > 1) a = ang - spread / 2 + (spread * i) / (count - 1);
    const p: Projectile = {
      id: w.nextId++, owner: f.id, team: f.team, x: f.x + Math.cos(a) * f.radius * 0.8, y: f.y + Math.sin(a) * f.radius * 0.8,
      vx: Math.cos(a) * spec.speed * TILE, vy: Math.sin(a) * spec.speed * TILE, r: spec.radius,
      dmg: spec.damage * dmgMul, left: range, spec, hit: new Set(), bounces: spec.bounces ?? 0, kind, lob: null,
      life: spec.lifeSec ?? 0, returning: false, ambush, color: projColor(f, spec), element: spec.element ?? 'physical', deployed: false, dead: false,
    };
    if (spec.pattern === 'lob' || spec.pattern === 'deploy') {
      const d = clamp(targetDist > 0 ? targetDist : range, TILE, range);
      const tx = f.x + Math.cos(a) * d, ty = f.y + Math.sin(a) * d;
      const T0 = d / (spec.speed * TILE);
      p.lob = { sx: f.x, sy: f.y, tx, ty, t: 0, T: Math.max(0.2, T0) };
      if (spec.pattern === 'deploy') p.life = spec.lifeSec ?? 6;
    }
    w.projectiles.push(p);
  }
  w.events.push({ type: 'shot', owner: f.id, x: f.x, y: f.y, pattern: spec.pattern, kind });
}

function meleeSwing(w: World, f: Fighter, spec: ProjectileSpec, ang: number, kind: 'attack' | 'skill' | 'ult', dmgMul: number, ambush: boolean) {
  const range = spec.range * TILE * (1 - pow(f, 'blind') * 0.4) + f.radius;
  const arc = ((spec.arcDeg ?? 90) * Math.PI) / 180 / 2;
  w.events.push({ type: 'shot', owner: f.id, x: f.x, y: f.y, pattern: 'melee', kind });
  w.events.push({ type: 'explode', x: f.x + Math.cos(ang) * range * 0.55, y: f.y + Math.sin(ang) * range * 0.55, r: -range, color: projColor(f, spec), owner: f.id });
  for (const t of w.fighters) {
    if (!t.alive || t.team === f.team) continue;
    const dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy);
    if (d > range + t.radius) continue;
    let da = Math.atan2(dy, dx) - ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    if (Math.abs(da) > arc + Math.atan2(t.radius, Math.max(d, 1))) continue;
    if (!hasLOS(w, f.x, f.y, t.x, t.y)) continue;
    damageFighter(w, f, t, spec.damage * dmgMul, { kind, element: spec.element, kb: spec.knockback, status: spec.status, crit: spec.critChance, ambush });
    if (spec.pull) pullToward(t, f.x, f.y, spec.pull);
  }
  for (const s of w.structures) {
    if (s.dead || s.team === f.team) continue;
    const d = Math.hypot(s.x - f.x, s.y - f.y);
    if (d > range + s.r) continue;
    let da = Math.atan2(s.y - f.y, s.x - f.x) - ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    if (Math.abs(da) <= arc + 0.3) damageStructure(w, f, s, spec.damage * dmgMul, kind);
  }
  // break crates in front
  const cx = f.x + Math.cos(ang) * range * 0.7, cy = f.y + Math.sin(ang) * range * 0.7;
  if (tileAt(w, cx, cy) === T.CRATE) damageTile(w, cx, cy, spec.damage * dmgMul);
}

export function pullToward(t: Fighter, x: number, y: number, px: number) {
  if (t.isBoss) return;
  const dx = x - t.x, dy = y - t.y, d = Math.hypot(dx, dy) || 1;
  const amt = Math.min(px, Math.max(0, d - t.radius * 2));
  t.kx += (dx / d) * amt * 7; t.ky += (dy / d) * amt * 7;
}

export function damageTile(w: World, x: number, y: number, dmg: number) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); const i = ty * w.map.w + tx;
  if (w.map.tiles[i] !== T.CRATE) return;
  w.map.crateHp[i] -= dmg;
  if (w.map.crateHp[i] <= 0) { w.map.tiles[i] = T.FLOOR; w.events.push({ type: 'explode', x: tx * TILE + 32, y: ty * TILE + 32, r: 40, color: '#c8a070', owner: -1 }); }
}

function attackSpeedMul(f: Fighter): number {
  let m = 1 + pow(f, 'atkSpeed');
  if (f.char.passive.type === 'hitStreakAtkSpeed' && f.hitStreakT > 0) {
    const per = f.char.passive.p1 * (f.gears.has('UNIQUE') ? 1.4 : 1);
    m += Math.min(f.hitStreak, f.char.passive.p2 ?? 5) * per;
  }
  return m;
}

/** Trigger normal attack. Returns true if fired. */
export function tryAttack(w: World, f: Fighter, ang: number, chargeFrac = 1): boolean {
  if (!canAct(f) || f.lock > 0 || f.casting || f.dash || f.air) return false;
  if (f.ammo < 1) return false;
  const a = f.char.attack;
  f.ammo -= 1;
  const sp = attackSpeedMul(f);
  f.lock = Math.round((a.startup + a.recovery) / sp);
  f.facing = ang; f.aim = ang;
  if (a.breaksStealth !== false) { revealFighter(f, 1.5); endInvis(f); }
  const ambush = f.ambushReady; f.ambushReady = false;
  const count = a.pattern === 'burst' || a.pattern === 'beam' || (a.pattern === 'melee' && (a.count ?? 1) > 1) ? a.count ?? 1 : 1;
  const interval = Math.max(2, Math.round((a.burstFrames ?? 6) / sp));
  const dmgMul = a.pattern === 'charge' ? 0.35 + 0.65 * chargeFrac : 1;
  for (let i = 0; i < count; i++) {
    schedule(w, Math.round(a.startup / sp) + i * interval, () => {
      if (!f.alive || !canAct(f)) return;
      const aa = f.aim;
      if (a.pattern === 'melee') meleeSwing(w, f, a, aa, 'attack', dmgMul, ambush && i === 0);
      else fireSpec(w, f, a, aa, 'attack', dmgMul, f.input.aimDist, ambush && i === 0);
    });
  }
  return true;
}

export function endInvis(f: Fighter) { const s = f.statuses.get('invis'); if (s) s.t = 0; }

/** Use ability slot (1,2 = skills, 3 = ult). */
export function tryAbility(w: World, f: Fighter, slot: 1 | 2 | 3, ang: number, dist: number): boolean {
  if (!canAct(f) || f.casting || f.dash || f.air || has(f, 'silence')) return false;
  if (f.lock > 0 && slot !== 3) return false;
  const ab = slot === 1 ? f.char.skill1 : slot === 2 ? f.char.skill2 : f.char.ult;
  if (slot === 3) { if (f.ult < 1) return false; f.ult = 0; }
  else {
    if (f.cd[slot - 1] > 0) return false;
    const cdMul = f.gears.has('COOLDOWN') ? 0.85 : 1;
    f.cd[slot - 1] = ab.cooldown * cdMul;
  }
  f.facing = ang; f.aim = ang;
  const range = ab.range * TILE;
  const d = ab.aim === 'point' ? clamp(dist > 0 ? dist : range, TILE * 0.5, range) : range;
  const tx = f.x + Math.cos(ang) * d, ty = f.y + Math.sin(ang) * d;
  f.casting = { ab, slot, t: ab.startup, ax: Math.cos(ang), ay: Math.sin(ang), tx, ty };
  const breaks = slot === 3 || ab.stealth !== 'keep';
  if (breaks) { revealFighter(f, 1.5); endInvis(f); }
  w.events.push({ type: 'cast', owner: f.id, slot, x: f.x, y: f.y, name: ab.name });
  // telegraph: biggest radius op
  const tr = telegraphRadius(ab);
  if (tr > 0 && ab.startup >= 6) {
    const self = ab.aim === 'self' || ab.ops.some(o => o.op === 'nova' && o.at !== 'target');
    w.events.push({ type: 'telegraph', owner: f.id, x: self ? f.x : tx, y: self ? f.y : ty, r: tr, t: ab.startup / 60, ult: slot === 3 });
  }
  if (slot === 3) w.ultZoomT = f.isPlayer ? 1.4 : w.ultZoomT;
  if (f.char.passive.type === 'shieldOnSkill' && slot !== 3) { f.shield = Math.max(f.shield, f.maxHp * Math.min(0.3, f.char.passive.p1 * (f.gears.has('UNIQUE') ? 1.4 : 1))); f.shieldT = 2; }
  return true;
}
function telegraphRadius(ab: AbilityDef): number {
  let r = 0;
  const visit = (ops: Op[]) => { for (const o of ops) { if (o.op === 'nova') r = Math.max(r, o.radius); if (o.op === 'zone') r = Math.max(r, o.zone.radius); if (o.op === 'repeat') visit(o.ops); } };
  visit(ab.ops);
  return r * TILE;
}

/** Called each tick for fighters with an active cast. */
export function updateCast(w: World, f: Fighter) {
  const c = f.casting; if (!c) return;
  c.t--;
  if (c.t > 0) return;
  f.casting = null;
  f.lock = Math.max(f.lock, c.ab.recovery);
  const kind = c.slot === 3 ? 'ult' : 'skill';
  runOps(w, f, c.ab.ops, kind, Math.atan2(c.ay, c.ax), c.tx, c.ty);
}

function runOps(w: World, f: Fighter, ops: Op[], kind: 'skill' | 'ult', ang: number, tx: number, ty: number) {
  for (const op of ops) schedule(w, op.delay ?? 0, () => { if (f.alive) runOp(w, f, op, kind, ang, tx, ty); });
}

function nearestEnemy(w: World, f: Fighter, maxD: number) {
  let best: Fighter | null = null, bd = maxD * maxD;
  for (const e of w.fighters) if (e.alive && e.team !== f.team && e.cloneOf === null) { const d = (e.x - f.x) ** 2 + (e.y - f.y) ** 2; if (d < bd && w.visibility[f.team][w.fighters.indexOf(e)]) { bd = d; best = e; } }
  return best;
}

function runOp(w: World, f: Fighter, op: Op, kind: 'skill' | 'ult', ang: number, tx: number, ty: number) {
  // current aim for repeated ops follows the caster's aim (lets players steer barrages)
  const curAng = op.op === 'fire' ? f.aim + (op.angleOffset ?? 0) : ang;
  switch (op.op) {
    case 'fire':
      if (op.spec.pattern === 'melee') meleeSwing(w, f, op.spec, curAng, kind, 1, false);
      else fireSpec(w, f, op.spec, curAng, kind, 1, Math.hypot(tx - f.x, ty - f.y));
      break;
    case 'dash': {
      const a = op.backward ? ang + Math.PI : ang;
      const sp = op.speed * TILE;
      f.dash = { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, left: op.distance * TILE, dmg: op.damage ?? 0, r: (op.radius ?? 1) * TILE, kb: op.knockback ?? 0, status: op.status, stop: !!op.stopOnHit, hit: new Set(), ownerKind: kind };
      f.invulnT = Math.max(f.invulnT, op.damage ? 0 : 0.12);
      break;
    }
    case 'blink': {
      let a = ang, dist = op.distance * TILE;
      let dx = f.x + Math.cos(a) * dist, dy = f.y + Math.sin(a) * dist;
      if (op.behindTarget) {
        const e = nearestEnemy(w, f, op.distance * TILE + TILE);
        if (e) { const back = e.facing + Math.PI; dx = e.x + Math.cos(back) * (e.radius + f.radius + 6); dy = e.y + Math.sin(back) * (e.radius + f.radius + 6); a = Math.atan2(e.y - dy, e.x - dx); }
      } else if (kind === 'ult' || op.distance < 2.5) {
        // ult/short blinks hop toward nearest visible enemy if close
        const e = nearestEnemy(w, f, op.distance * TILE + 2 * TILE);
        if (e) { dx = e.x - Math.cos(a) * (e.radius + f.radius); dy = e.y - Math.sin(a) * (e.radius + f.radius); a = Math.atan2(e.y - f.y, e.x - f.x); }
      }
      // step back until free
      const sx = f.x, sy = f.y;
      for (let k = 0; k <= 20; k++) {
        const px = dx + (sx - dx) * (k / 20), py = dy + (sy - dy) * (k / 20);
        if (!collides(w, px, py, f.radius)) { dx = px; dy = py; break; }
        if (k === 20) { dx = sx; dy = sy; }
      }
      w.events.push({ type: 'explode', x: f.x, y: f.y, r: 26, color: '#b9a6ff', owner: f.id });
      f.x = dx; f.y = dy; f.facing = a; f.aim = a;
      if (op.damage) novaAt(w, f, dx, dy, (op.radius ?? 1.2) * TILE, op.damage, kind, 0, op.status);
      break;
    }
    case 'nova': {
      const x = op.at === 'target' ? tx : f.x, y = op.at === 'target' ? ty : f.y;
      novaAt(w, f, x, y, op.radius * TILE, op.damage, kind, op.knockback ?? 0, op.status, op.element, op.pull);
      break;
    }
    case 'zone': {
      const x = op.at === 'target' ? tx : f.x, y = op.at === 'target' ? ty : f.y;
      w.zones.push({ id: w.nextId++, owner: f.id, team: f.team, x, y, r: op.zone.radius * TILE, t: op.zone.duration, spec: op.zone, follow: !!op.follow, tick: 0 });
      break;
    }
    case 'shield': {
      const targets = op.radius ? w.fighters.filter(a => a.alive && a.team === f.team && (a.x - f.x) ** 2 + (a.y - f.y) ** 2 < (op.radius! * TILE) ** 2) : [f];
      for (const a of targets) { a.shield = Math.max(a.shield, a.maxHp * op.amount); a.shieldT = op.duration; if (a.id !== f.id) f.stats.protect += a.maxHp * op.amount * 0.5; }
      break;
    }
    case 'buff': {
      const targets = op.radius ? w.fighters.filter(a => a.alive && a.team === f.team && (a.x - f.x) ** 2 + (a.y - f.y) ** 2 < (op.radius! * TILE) ** 2) : [f];
      for (const a of targets) applyStatus(w, a, op.status, f.id);
      break;
    }
    case 'heal': {
      const targets = op.radius ? w.fighters.filter(a => a.alive && a.team === f.team && a.cloneOf === null && (a.x - f.x) ** 2 + (a.y - f.y) ** 2 < (op.radius! * TILE) ** 2) : [f];
      for (const a of targets) healFighter(w, f, a, op.amount);
      w.events.push({ type: 'explode', x: f.x, y: f.y, r: (op.radius ?? 1) * TILE, color: '#7dffb0', owner: f.id });
      break;
    }
    case 'invis': applyStatus(w, f, { kind: 'invis', duration: op.duration }, f.id); f.ambushReady = true; break;
    case 'clone': spawnClones(w, f, op.count, op.duration, op.hpFrac); break;
    case 'wall': buildWall(w, f, ang, op.length, op.hp, op.duration); break;
    case 'turret': {
      const a = ang + (w.rng.next() - 0.5) * 0.8;
      let x = f.x + Math.cos(a) * TILE, y = f.y + Math.sin(a) * TILE;
      if (collides(w, x, y, 20)) { x = f.x; y = f.y; }
      w.structures.push({ id: w.nextId++, kind: 'turret', team: f.team, owner: f.id, x, y, r: 20, hp: op.hp, maxHp: op.hp, t: op.duration, spec: op.spec, rate: op.rate, cdT: 20, dead: false });
      break;
    }
    case 'reveal': w.revealZones.push({ team: f.team, x: f.x, y: f.y, r: op.radius * TILE, t: op.duration }); w.events.push({ type: 'explode', x: f.x, y: f.y, r: op.radius * TILE, color: '#ffffff', owner: f.id }); break;
    case 'cleanse': for (const k of ['slow', 'stun', 'freeze', 'poison', 'burn', 'bleed', 'silence', 'blind', 'mark', 'root', 'curse'] as const) f.statuses.delete(k); break;
    case 'repeat': for (let i = 0; i < op.times; i++) schedule(w, i * op.interval, () => { if (f.alive && canAct(f)) runOps(w, f, op.ops, kind, f.aim, kind === 'ult' && op.ops.some(o => o.op === 'nova' && o.at === 'target') ? tx + (w.rng.next() - 0.5) * TILE * 2.4 : tx, ty + (op.ops.some(o => o.op === 'nova' && o.at === 'target') ? (w.rng.next() - 0.5) * TILE * 2.4 : 0)); }); break;
  }
}

export function novaAt(w: World, f: Fighter, x: number, y: number, r: number, dmg: number, kind: 'skill' | 'ult' | 'attack', kb: number, status?: StatusApply, element?: Element, pull?: number) {
  w.events.push({ type: 'explode', x, y, r, color: element ? ELEMENT_COLOR[element] : themeOf(f.skinId).accent, owner: f.id });
  for (const t of w.fighters) {
    if (!t.alive || t.team === f.team) continue;
    if ((t.x - x) ** 2 + (t.y - y) ** 2 > (r + t.radius) ** 2) continue;
    damageFighter(w, f, t, dmg, { kind, kb, dirX: t.x - x, dirY: t.y - y, status, element });
    if (pull) pullToward(t, x, y, pull);
    revealFighter(t, 1);
  }
  for (const s of w.structures) if (!s.dead && s.team !== f.team && (s.x - x) ** 2 + (s.y - y) ** 2 < (r + s.r) ** 2) damageStructure(w, f, s, dmg, kind);
  // crates
  const r2 = Math.ceil(r / TILE);
  for (let oy = -r2; oy <= r2; oy++) for (let ox = -r2; ox <= r2; ox++) { const px = x + ox * TILE, py = y + oy * TILE; if ((px - x) ** 2 + (py - y) ** 2 <= r * r && tileAt(w, px, py) === T.CRATE) damageTile(w, px, py, dmg); }
  // area attacks reveal hidden enemies inside
  w.revealZones.push({ team: f.team, x, y, r, t: 0.6 });
}

function spawnClones(w: World, f: Fighter, count: number, dur: number, hpFrac: number) {
  // Lazy import cycle avoidance: world.ts registers factory
  for (let i = 0; i < count; i++) {
    const a = f.facing + Math.PI / 2 + (i * Math.PI * 2) / count;
    const c = cloneFactory(w, f);
    c.x = f.x + Math.cos(a) * 40; c.y = f.y + Math.sin(a) * 40;
    if (collides(w, c.x, c.y, c.radius)) { c.x = f.x; c.y = f.y; }
    c.maxHp = c.hp = Math.max(1, Math.round(f.maxHp * hpFrac)); c.cloneT = dur; c.cloneOf = f.id;
    w.fighters.push(c);
  }
}
export let cloneFactory: (w: World, f: Fighter) => Fighter = () => { throw new Error('cloneFactory not set'); };
export function setCloneFactory(fn: typeof cloneFactory) { cloneFactory = fn; }

function buildWall(w: World, f: Fighter, ang: number, length: number, hp: number, dur: number) {
  const cx = f.x + Math.cos(ang) * TILE * 1.6, cy = f.y + Math.sin(ang) * TILE * 1.6;
  const px = -Math.sin(ang), py = Math.cos(ang);
  const tiles: number[] = [];
  for (let i = 0; i < length; i++) {
    const o = (i - (length - 1) / 2) * TILE;
    const x = cx + px * o, y = cy + py * o;
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx <= 0 || ty <= 0 || tx >= w.map.w - 1 || ty >= w.map.h - 1) continue;
    const idx = ty * w.map.w + tx;
    if (w.map.tiles[idx] !== T.FLOOR && w.map.tiles[idx] !== T.BUSH) continue;
    // never trap fighters inside
    if (w.fighters.some(a => a.alive && Math.abs(a.x - (tx * TILE + 32)) < 32 + a.radius && Math.abs(a.y - (ty * TILE + 32)) < 32 + a.radius)) continue;
    w.map.tiles[idx] = T.CRATE; w.map.crateHp[idx] = hp / length; tiles.push(idx);
  }
  if (tiles.length) w.tempWalls.push({ tiles, t: dur });
}

/** Projectile simulation */
export function updateProjectiles(w: World, dt: number) {
  for (const p of w.projectiles) {
    if (p.dead) continue;
    const owner = w.fighters.find(f => f.id === p.owner);
    if (p.lob) {
      if (p.spec.pattern === 'deploy' && p.deployed) {
        p.life -= dt;
        // trigger when enemy steps close
        const trig = w.fighters.some(f => f.alive && f.team !== p.team && (f.x - p.x) ** 2 + (f.y - p.y) ** 2 < (p.r + f.radius + 6) ** 2);
        if (trig || p.life <= 0) { detonate(w, p, owner); }
        continue;
      }
      p.lob.t += dt;
      const k = Math.min(1, p.lob.t / p.lob.T);
      p.x = p.lob.sx + (p.lob.tx - p.lob.sx) * k; p.y = p.lob.sy + (p.lob.ty - p.lob.sy) * k;
      if (k >= 1) {
        if (p.spec.pattern === 'deploy') { p.deployed = true; if (collides(w, p.x, p.y, 4, solidShot)) detonate(w, p, owner); }
        else detonate(w, p, owner);
      }
      continue;
    }
    // homing
    if (p.spec.homing && owner) {
      let best: Fighter | null = null, bd = (5 * TILE) ** 2;
      for (const e of w.fighters) if (e.alive && e.team !== p.team && !p.hit.has(e.id) && w.visibility[p.team]?.[w.fighters.indexOf(e)]) { const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2; if (d < bd) { bd = d; best = e; } }
      if (best) {
        const cur = Math.atan2(p.vy, p.vx), want = Math.atan2(best.y - p.y, best.x - p.x);
        let da = want - cur; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        const turn = clamp(da, -p.spec.homing * dt, p.spec.homing * dt); const sp = Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(cur + turn) * sp; p.vy = Math.sin(cur + turn) * sp;
      }
    }
    if (p.spec.pattern === 'boomerang' && p.returning && owner) {
      const dx = owner.x - p.x, dy = owner.y - p.y, d = Math.hypot(dx, dy) || 1; const sp = Math.hypot(p.vx, p.vy);
      p.vx = (dx / d) * sp; p.vy = (dy / d) * sp;
      if (d < owner.radius + 10) { p.dead = true; continue; }
    }
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    const stepLen = Math.hypot(nx - p.x, ny - p.y);
    // walls
    if (!p.spec.ignoreWalls && solidShot(tileAt(w, nx, ny))) {
      if (tileAt(w, nx, ny) === T.CRATE) damageTile(w, nx, ny, p.dmg * 0.5);
      if (p.bounces > 0) {
        p.bounces--; p.hit.clear();
        const hx = solidShot(tileAt(w, nx, p.y)), hy = solidShot(tileAt(w, p.x, ny));
        if (hx || !hy) p.vx = -p.vx; if (hy || !hx) p.vy = -p.vy;
        continue;
      }
      if (p.spec.pattern === 'boomerang' && !p.returning) { p.returning = true; p.hit.clear(); continue; }
      if (p.spec.explodeRadius) detonate(w, p, owner); else p.dead = true;
      continue;
    }
    p.x = nx; p.y = ny; p.left -= stepLen;
    // reflect barrier: enemies with reflect status near projectile flip it
    for (const f of w.fighters) {
      if (!f.alive || f.team === p.team || p.hit.has(f.id)) continue;
      const rr = (f.radius + p.r) ** 2;
      const d2 = (f.x - p.x) ** 2 + (f.y - p.y) ** 2;
      if (has(f, 'reflect') && d2 < (f.radius + p.r + 18) ** 2) {
        p.team = f.team; p.owner = f.id; p.vx = -p.vx; p.vy = -p.vy; p.left = Math.max(p.left, p.spec.range * TILE * 0.6); p.hit.clear(); p.color = '#ffffff';
        w.events.push({ type: 'explode', x: p.x, y: p.y, r: 18, color: '#ffffff', owner: f.id });
        break;
      }
      if (d2 < rr) {
        const src = owner && owner.team === p.team ? owner : w.fighters.find(a => a.id === p.owner) ?? null;
        if (p.spec.explodeRadius && !p.spec.pierce) { detonate(w, p, src); break; }
        damageFighter(w, src, f, p.dmg, { kind: p.kind === 'turret' ? 'turret' : p.kind, element: p.spec.element, kb: p.spec.knockback, dirX: p.vx, dirY: p.vy, status: p.spec.status, crit: p.spec.critChance, ambush: p.ambush });
        if (p.spec.pull && src) pullToward(f, src.x, src.y, p.spec.pull);
        p.hit.add(f.id);
        if (p.bounces > 0 && p.spec.pattern === 'bounce') {
          // ricochet to next enemy if any
          p.bounces--;
          let best: Fighter | null = null, bd = (4 * TILE) ** 2;
          for (const e of w.fighters) if (e.alive && e.team !== p.team && !p.hit.has(e.id)) { const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2; if (d < bd) { bd = d; best = e; } }
          if (best) { const sp = Math.hypot(p.vx, p.vy), a = Math.atan2(best.y - p.y, best.x - p.x); p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.left = Math.max(p.left, 4 * TILE); continue; }
        }
        if (!p.spec.pierce) { p.dead = true; break; }
      }
    }
    if (p.dead) continue;
    for (const s of w.structures) {
      if (s.dead || s.team === p.team || p.hit.has(-s.id)) continue;
      if ((s.x - p.x) ** 2 + (s.y - p.y) ** 2 < (s.r + p.r) ** 2) {
        damageStructure(w, owner ?? null, s, p.dmg, p.kind === 'turret' ? 'turret' : p.kind);
        p.hit.add(-s.id);
        if (p.spec.explodeRadius && !p.spec.pierce) { detonate(w, p, owner); break; }
        if (!p.spec.pierce) { p.dead = true; break; }
      }
    }
    if (p.dead) continue;
    if (p.left <= 0) {
      if (p.spec.pattern === 'boomerang' && !p.returning) { p.returning = true; p.left = p.spec.range * TILE * 1.2; p.hit.clear(); continue; }
      if (p.spec.explodeRadius) detonate(w, p, owner); else p.dead = true;
    }
  }
  if (w.tick % 30 === 0 || w.projectiles.length > 300) w.projectiles = w.projectiles.filter(p => !p.dead);
}

function detonate(w: World, p: Projectile, owner: Fighter | null | undefined) {
  p.dead = true;
  if (!owner) return;
  const r = (p.spec.explodeRadius ?? 1) * TILE;
  w.events.push({ type: 'explode', x: p.x, y: p.y, r, color: p.color, owner: p.owner });
  for (const t of w.fighters) {
    if (!t.alive || t.team === p.team) continue;
    if ((t.x - p.x) ** 2 + (t.y - p.y) ** 2 > (r + t.radius) ** 2) continue;
    damageFighter(w, owner, t, p.dmg, { kind: p.kind === 'turret' ? 'turret' : p.kind, element: p.spec.element, kb: p.spec.knockback, dirX: t.x - p.x, dirY: t.y - p.y, status: p.spec.status, crit: p.spec.critChance });
    if (p.spec.pull) pullToward(t, p.x, p.y, p.spec.pull);
  }
  for (const s of w.structures) if (!s.dead && s.team !== p.team && (s.x - p.x) ** 2 + (s.y - p.y) ** 2 < (r + s.r) ** 2) damageStructure(w, owner, s, p.dmg, p.kind);
  if (tileAt(w, p.x, p.y) === T.CRATE) damageTile(w, p.x, p.y, p.dmg);
  if (p.spec.zone) w.zones.push({ id: w.nextId++, owner: owner.id, team: p.team, x: p.x, y: p.y, r: p.spec.zone.radius * TILE, t: p.spec.zone.duration, spec: p.spec.zone, follow: false, tick: 0 });
  w.revealZones.push({ team: p.team, x: p.x, y: p.y, r, t: 0.5 });
}

export function updateZones(w: World, dt: number) {
  for (const z of w.zones) {
    z.t -= dt; z.tick++;
    const owner = w.fighters.find(f => f.id === z.owner);
    if (!owner) { z.t = 0; continue; }
    if (z.follow && owner.alive) { z.x = owner.x; z.y = owner.y; }
    const every = 6; // apply 10x/sec
    if (z.tick % every !== 0) continue;
    const k = (every * dt);
    for (const f of w.fighters) {
      if (!f.alive) continue;
      if ((f.x - z.x) ** 2 + (f.y - z.y) ** 2 > (z.r + f.radius * 0.5) ** 2) continue;
      if (f.team !== z.team) {
        if (z.spec.dps) damageFighter(w, owner, f, z.spec.dps * k, { kind: 'dot', element: z.spec.element });
        if (z.spec.slow) applyStatus(w, f, { kind: 'slow', duration: 0.25, power: z.spec.slow }, owner.id);
        if (z.spec.status) applyStatus(w, f, z.spec.status, owner.id);
        if (z.spec.pull) pullToward(f, z.x, z.y, z.spec.pull * k * 0.6);
      } else {
        if (z.spec.healPs) healFighter(w, owner, f, z.spec.healPs * k, true);
        if (z.spec.allyBuff) applyStatus(w, f, z.spec.allyBuff, owner.id);
      }
    }
    if (z.spec.dps) for (const s of w.structures) if (!s.dead && s.team !== z.team && s.kind !== 'vault' && (s.x - z.x) ** 2 + (s.y - z.y) ** 2 < z.r ** 2) damageStructure(w, owner, s, z.spec.dps * k, 'skill');
  }
  w.zones = w.zones.filter(z => z.t > 0);
}

export function updateStructures(w: World, dt: number) {
  for (const s of w.structures) {
    if (s.dead) continue;
    if (s.kind === 'turret') {
      s.t -= dt; if (s.t <= 0) { s.dead = true; continue; }
      s.cdT = (s.cdT ?? 0) - 1;
      if (s.cdT > 0) continue;
      const owner = w.fighters.find(f => f.id === s.owner);
      if (!owner || !s.spec) { s.dead = true; continue; }
      let best: Fighter | null = null, bd = (s.spec.range * TILE) ** 2;
      const vis = w.visibility[s.team];
      w.fighters.forEach((e, i) => { if (e.alive && e.team !== s.team && vis?.[i]) { const d = (e.x - s.x) ** 2 + (e.y - s.y) ** 2; if (d < bd && hasLOS(w, s.x, s.y, e.x, e.y)) { bd = d; best = e; } } });
      if (best) {
        const b = best as Fighter;
        const a = Math.atan2(b.y - s.y, b.x - s.x);
        const p: Projectile = { id: w.nextId++, owner: owner.id, team: s.team, x: s.x, y: s.y, vx: Math.cos(a) * s.spec.speed * TILE, vy: Math.sin(a) * s.spec.speed * TILE, r: s.spec.radius, dmg: s.spec.damage, left: s.spec.range * TILE, spec: s.spec, hit: new Set(), bounces: 0, kind: 'turret', lob: null, life: 0, returning: false, ambush: false, color: projColor(owner, s.spec), element: 'physical', deployed: false, dead: false };
        w.projectiles.push(p);
        s.cdT = s.rate ?? 30;
      } else s.cdT = 10;
    }
  }
  if (w.tick % 60 === 0) w.structures = w.structures.filter(s => !s.dead || s.kind === 'vault');
}
