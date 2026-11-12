import { TILE } from '../core/constants';
import { clamp } from '../core/math';
import type { Element, StatusApply, StatusKind } from '../data/types';
import { UNIQUE_GEAR_MULT } from '../data/gears';
import type { Fighter, Structure, World } from './types';

export const has = (f: Fighter, k: StatusKind) => (f.statuses.get(k)?.t ?? 0) > 0;
export const pow = (f: Fighter, k: StatusKind) => { const s = f.statuses.get(k); return s && s.t > 0 ? s.power : 0; };
export const cubeMult = (f: Fighter) => Math.pow(1.1, f.cubes);
export const canAct = (f: Fighter) => f.alive && !has(f, 'stun') && !has(f, 'freeze') && !has(f, 'knockup');
export const canMove = (f: Fighter) => canAct(f) && !has(f, 'root');

/** Passive p1 with UNIQUE gear amplification (capped). */
export function pp(f: Fighter): number {
  const p = f.char.passive.p1;
  if (!f.gears.has('UNIQUE')) return p;
  if (f.char.passive.type === 'frostStacks') return Math.max(2, p - 1);
  if (f.char.passive.type === 'dodgeChance') return Math.min(0.35, p * UNIQUE_GEAR_MULT);
  return p * UNIQUE_GEAR_MULT;
}

export function applyStatus(w: World, target: Fighter, st: StatusApply, src: number) {
  if (!target.alive) return;
  if (target.isBoss && (st.kind === 'stun' || st.kind === 'freeze' || st.kind === 'knockup' || st.kind === 'root')) {
    st = { ...st, duration: st.duration * 0.3 };
  }
  const cur = target.statuses.get(st.kind);
  const power = st.power ?? 0;
  if (!cur || cur.t <= 0 || power >= cur.power) target.statuses.set(st.kind, { t: Math.max(cur?.t ?? 0, st.duration), power, src });
  else cur.t = Math.max(cur.t, st.duration);
  if (st.kind === 'stun' || st.kind === 'freeze' || st.kind === 'knockup') { target.casting = null; target.dash = null; target.charging = false; }
  w.events.push({ type: 'status', target: target.id, kind: st.kind });
}

export interface DmgOpts { kind: 'attack' | 'skill' | 'ult' | 'dot' | 'env' | 'turret'; element?: Element; kb?: number; dirX?: number; dirY?: number; status?: StatusApply; crit?: number; ambush?: boolean; ignoreShield?: boolean; noChain?: boolean; fromX?: number; fromY?: number }

export function revealFighter(f: Fighter, sec: number) { f.revealT = Math.max(f.revealT, sec); f.bushStayT = 0; }

export function fighterById(w: World, id: number): Fighter | undefined { return w.fighters.find(f => f.id === id); }

/** Central damage pipeline for fighters. Returns damage actually dealt. */
export function damageFighter(w: World, src: Fighter | null, t: Fighter, base: number, o: DmgOpts): number {
  if (!t.alive || t.invulnT > 0 || t.spawnProtectT > 0) return 0;
  if (src && src.team === t.team && src.id !== t.id) return 0;
  let dmg = base;
  let crit = false;
  if (src) {
    dmg *= cubeMult(src);
    if (src.cloneOf !== null) dmg *= 0.3;
    dmg *= 1 + pow(src, 'dmgUp');
    if (src.gears.has('DAMAGE') && src.hp <= src.maxHp * 0.5) dmg *= 1.15;
    const P = src.char.passive; const p1 = pp(src);
    const dx = t.x - src.x, dy = t.y - src.y, d = Math.hypot(dx, dy) || 1;
    switch (P.type) {
      case 'backstab': { const fx = Math.cos(t.facing), fy = Math.sin(t.facing); if ((fx * dx + fy * dy) / d > 0.3) dmg *= 1 + p1; break; }
      case 'executeBonus': if (t.hp <= t.maxHp * (P.p2 ?? 0.4)) dmg *= 1 + p1; break;
      case 'comboDamage': dmg *= 1 + Math.min(src.combo, P.p2 ?? 8) * p1; break;
      case 'bushPower': if (src.inBush) dmg *= 1 + p1; break;
      case 'stillAccuracy': if (!src.moving) dmg *= 1 + p1; break;
      case 'rangeScaling': dmg *= 1 + p1 * clamp((d - 2 * TILE) / (7 * TILE), 0, 1); break;
      case 'closeScaling': dmg *= 1 + p1 * clamp(1 - (d - TILE) / (3 * TILE), 0, 1); break;
      case 'entropy': dmg *= 1 + Math.min(0.4, Math.floor(src.entropyT / 10) * p1); break;
      case 'revengeStack': if (o.kind === 'attack' && src.revenge > 0) { dmg += src.revenge; src.revenge = 0; } break;
      case 'ambush': if (o.ambush) dmg *= 1 + p1; break;
    }
    if (o.kind !== 'dot' && w.rng.next() < (o.crit ?? 0)) { dmg *= 1.5; crit = true; }
  }
  // target defenses
  let red = pow(t, 'defUp');
  const TP = t.char.passive; const tp1 = pp(t);
  if (TP.type === 'lowHpDefense' && t.hp <= t.maxHp * (TP.p2 ?? 0.5)) red += tp1;
  if (TP.type === 'movingArmor' && t.moving) red += tp1;
  if (TP.type === 'frontArmor' && src) { const dx = src.x - t.x, dy = src.y - t.y, d = Math.hypot(dx, dy) || 1; if ((Math.cos(t.facing) * dx + Math.sin(t.facing) * dy) / d > 0.5) red += tp1; }
  for (const a of w.fighters) if (a.alive && a.team === t.team && a.id !== t.id && a.char.passive.type === 'allyAura' && (a.x - t.x) ** 2 + (a.y - t.y) ** 2 < (3 * TILE) ** 2) { red += pp(a); break; }
  if (TP.type === 'dodgeChance' && o.kind === 'attack' && w.rng.next() < tp1) { w.events.push({ type: 'dodge', owner: t.id }); return 0; }
  dmg *= 1 - clamp(red, 0, 0.7);
  dmg *= 1 + pow(t, 'mark') + pow(t, 'curse');
  dmg = Math.max(1, Math.round(dmg));
  // shield
  let absorbed = 0;
  const ignore = o.ignoreShield || (o.ambush && src?.char.passive.type === 'ambush');
  if (!ignore) {
    if (t.shield > 0) { const a = Math.min(t.shield, dmg); t.shield -= a; absorbed += a; }
    if (t.gearShield > 0 && dmg - absorbed > 0) { const a = Math.min(t.gearShield, dmg - absorbed); t.gearShield -= a; absorbed += a; }
  }
  const hpDmg = dmg - absorbed;
  t.hp -= hpDmg;
  t.combatT = 0; t.fullHpT = 0;
  t.stats.taken += dmg;
  if (o.kind !== 'dot' && o.kind !== 'env') revealFighter(t, 1.0);
  if (TP.type === 'revengeStack') t.revenge = Math.min(t.revenge + dmg * tp1, 1500);
  w.events.push({ type: 'hit', x: t.x, y: t.y - t.radius, dmg, crit, target: t.id, src: src?.id ?? -1, shield: absorbed > 0 && hpDmg === 0, element: o.element });
  if (o.kb && o.kb > 0 && !t.isBoss) {
    const dx = o.dirX ?? (src ? t.x - src.x : 0), dy = o.dirY ?? (src ? t.y - src.y : 0); const d = Math.hypot(dx, dy) || 1;
    t.kx += (dx / d) * o.kb * 7; t.ky += (dy / d) * o.kb * 7;
  }
  if (o.status) applyStatus(w, t, o.status, src?.id ?? -1);
  if (src && src.id !== t.id) {
    src.combatT = 0;
    src.stats.damage += dmg;
    t.lastHitBy.set(src.id, w.time);
    if (o.kind === 'attack' || o.kind === 'skill' || o.kind === 'ult') {
      src.combo = src.comboT > 0 ? src.combo + 1 : 1;
      src.comboT = src.char.passive.type === 'comboDamage' && src.gears.has('UNIQUE') ? 2.1 : 1.5;
      src.stats.maxCombo = Math.max(src.stats.maxCombo, src.combo);
      if (src.isPlayer || t.isPlayer) { src.hitstop = Math.max(src.hitstop, crit ? 5 : 3); t.hitstop = Math.max(t.hitstop, crit ? 5 : 3); }
    }
    if (o.kind !== 'ult') gainUlt(src, dmg);
    if (src.gears.has('VISION')) t.revealedFor[src.team] = 2;
    onHitPassives(w, src, t, dmg, o);
  }
  if (t.hp <= 0) killFighter(w, t, src);
  return dmg;
}

export function gainUlt(f: Fighter, amount: number) {
  if (f.cloneOf !== null) return;
  const bonus = f.char.passive.type === 'ultChargeBonus' ? 1 + pp(f) : 1;
  f.ult = Math.min(1, f.ult + (amount / f.char.ultCharge) * bonus);
}

function onHitPassives(w: World, src: Fighter, t: Fighter, dmg: number, o: DmgOpts) {
  const P = src.char.passive; const p1 = pp(src);
  if (o.kind === 'dot') return;
  if (o.kind === 'attack') {
    src.hitStreak = src.hitStreakT > 0 ? src.hitStreak + 1 : 1; src.hitStreakT = 1.6;
  }
  switch (P.type) {
    case 'frostStacks': if (o.element === 'ice') { t.frost++; if (t.frost >= p1) { t.frost = 0; applyStatus(w, t, { kind: 'freeze', duration: 1 }, src.id); } } break;
    case 'poisonOnHit': if (o.kind === 'attack') applyStatus(w, t, { kind: 'poison', duration: 3, power: p1 }, src.id); break;
    case 'bleedOnHit': if (o.kind === 'attack') applyStatus(w, t, { kind: 'bleed', duration: 3, power: p1 }, src.id); break;
    case 'burnOnHit': if (o.kind === 'attack') applyStatus(w, t, { kind: 'burn', duration: 2, power: p1 }, src.id); break;
    case 'slowOnHit': if (o.kind === 'attack') applyStatus(w, t, { kind: 'slow', duration: 1, power: Math.min(0.5, p1) }, src.id); break;
    case 'markOnHit': if (o.kind === 'attack') { applyStatus(w, t, { kind: 'mark', duration: 2, power: Math.min(0.3, p1) }, src.id); t.revealedFor[src.team] = 2; } break;
    case 'lifesteal': healFighter(w, src, src, dmg * Math.min(0.3, p1), true); break;
    case 'cooldownOnHit': if (o.kind === 'attack') { src.cd[0] = Math.max(0, src.cd[0] - p1); src.cd[1] = Math.max(0, src.cd[1] - p1); } break;
    case 'chainHit': if (!o.noChain && o.kind !== 'turret') {
      let best: Fighter | null = null, bd = (3 * TILE) ** 2;
      for (const e of w.fighters) if (e.alive && e.team !== src.team && e.id !== t.id) { const d = (e.x - t.x) ** 2 + (e.y - t.y) ** 2; if (d < bd) { bd = d; best = e; } }
      if (best) damageFighter(w, src, best, dmg * Math.min(0.5, p1), { kind: 'dot', element: 'electric', noChain: true });
    } break;
  }
  if (t.char.passive.type === 'thorns' && o.kind !== 'turret') damageFighter(w, t, src, dmg * Math.min(0.35, pp(t)), { kind: 'dot', noChain: true });
}

export function healFighter(w: World, src: Fighter, t: Fighter, amount: number, silent = false): number {
  if (!t.alive) return 0;
  if (has(t, 'curse')) amount *= 0.5;
  amount *= cubeMult(src);
  if (src.char.key === 'AETHER' && src.gears.has('UNIQUE')) amount *= 1.2;
  const real = Math.min(t.maxHp - t.hp, Math.round(amount));
  if (real <= 0) return 0;
  t.hp += real;
  if (src.id !== t.id) { src.stats.healing += real; src.stats.protect += real * 0.5; }
  if (src.char.passive.type === 'healCharge' && src.id !== t.id) gainUlt(src, real * pp(src));
  else if (src.char.passive.type === 'healCharge') gainUlt(src, real * pp(src) * 0.35);
  if (!silent) w.events.push({ type: 'hit', x: t.x, y: t.y - t.radius, dmg: real, crit: false, target: t.id, src: src.id, heal: true });
  return real;
}

export function killFighter(w: World, t: Fighter, killer: Fighter | null) {
  if (!t.alive) return;
  t.alive = false; t.hp = 0; t.casting = null; t.dash = null; t.charging = false; t.air = null;
  if (t.cloneOf !== null) { w.events.push({ type: 'explode', x: t.x, y: t.y, r: 30, color: '#ffffff', owner: t.id }); return; }
  t.stats.deaths++; t.stats.streak = 0;
  const assists: number[] = [];
  for (const [id, time] of t.lastHitBy) if (w.time - time < 5 && id !== killer?.id) {
    const a = fighterById(w, id); if (a && a.team !== t.team) { a.stats.assists++; assists.push(id); if (a.char.passive.type === 'speedOnKill') applyStatus(w, a, { kind: 'haste', duration: 3, power: pp(a) }, a.id); }
  }
  t.lastHitBy.clear();
  if (killer && killer.team !== t.team) {
    const k = killer.cloneOf !== null ? fighterById(w, killer.cloneOf) ?? killer : killer;
    k.stats.kills++; k.stats.streak++; k.stats.maxStreak = Math.max(k.stats.maxStreak, k.stats.streak);
    if (k.char.passive.type === 'speedOnKill') applyStatus(w, k, { kind: 'haste', duration: 3, power: pp(k) }, k.id);
    w.feed.push({ t: w.time, killer: k.name, victim: t.name, kTeam: k.team, vTeam: t.team, kColor: k.char.color, vColor: t.char.color });
    w.events.push({ type: 'kill', killer: k.id, victim: t.id, assist: assists, x: t.x, y: t.y });
    if (k.stats.streak >= 3) w.events.push({ type: 'announce', text: `${k.name} ${k.stats.streak} KILL CHAIN!`, color: '#ffcc00' });
    w.rules.onKill(w, t, k);
  } else {
    w.feed.push({ t: w.time, killer: '環境', victim: t.name, kTeam: -1, vTeam: t.team, kColor: '#999', vColor: t.char.color });
    w.events.push({ type: 'kill', killer: -1, victim: t.id, assist: assists, x: t.x, y: t.y });
    w.rules.onKill(w, t, null);
  }
  if (w.feed.length > 6) w.feed.shift();
  // remove that fighter's clones
  for (const c of w.fighters) if (c.cloneOf === t.id && c.alive) { c.alive = false; }
  t.respawnT = w.cfg.mode.respawn ?? -1;
}

export function damageStructure(w: World, src: Fighter | null, s: Structure, base: number, kind: DmgOpts['kind']): number {
  if (s.dead) return 0;
  if (src && src.team === s.team) return 0;
  let dmg = base * (src ? cubeMult(src) * (1 + pow(src, 'dmgUp')) : 1);
  dmg = Math.round(dmg);
  s.hp -= dmg;
  w.events.push({ type: 'hit', x: s.x, y: s.y - s.r, dmg, crit: false, target: -s.id, src: src?.id ?? -1 });
  if (src) {
    src.combatT = Math.min(src.combatT, 1);
    if (s.kind === 'vault') { src.stats.objective += dmg; src.stats.damage += dmg * 0.5; gainUlt(src, dmg * 0.5); }
    else if (s.kind === 'turret') { src.stats.damage += dmg; gainUlt(src, dmg * 0.5); }
    else gainUlt(src, dmg * 0.15);
  }
  void kind;
  if (s.hp <= 0) { s.dead = true; s.hp = 0; w.rules.onStructureDestroyed?.(w, s, src); if (s.kind === 'box') w.events.push({ type: 'boxbreak', x: s.x, y: s.y }); else w.events.push({ type: 'explode', x: s.x, y: s.y, r: s.r * 1.5, color: '#ffaa33', owner: -1 }); }
  return dmg;
}
