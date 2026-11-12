import { DT, FIGHTER_RADIUS, SPEED, TILE } from '../core/constants';
import { T } from '../data/maps';
import { CUBE_SPEED_CAP } from '../data/config';
import type { CharacterDef } from '../data/types';
import type { GearKey } from '../data/gears';
import { applyStatus, canAct, canMove, cubeMult, damageFighter, has, healFighter, pow } from './combat';
import { damageTile, endInvis, novaAt, tryAbility, tryAttack, updateCast } from './abilities';
import { moveCircle, tileAt } from './physics';
import { emptyInput, type Fighter, type World } from './types';

export function createFighter(w: World, char: CharacterDef, team: number, o: { skinId: string; name: string; title: string; bg: string; isPlayer: boolean; cpu: Fighter['cpu']; gears: GearKey[] }): Fighter {
  const f: Fighter = {
    id: w.nextId++, team, char, skinId: o.skinId, name: o.name, title: o.title, bg: o.bg, isPlayer: o.isPlayer, cpu: o.cpu, ai: null,
    x: 0, y: 0, kx: 0, ky: 0, radius: FIGHTER_RADIUS, facing: -Math.PI / 2, aim: -Math.PI / 2, moving: false, lastMoveX: 0, lastMoveY: 0,
    hp: char.hp, maxHp: char.hp, baseMaxHp: char.hp, shield: 0, shieldT: 0, gearShield: 0, gearShieldMax: 0, fullHpT: 0,
    ammo: char.attack.ammo, reloadT: 0, lock: 0, castLock: 0, casting: null, cd: [0, 0], ult: 0, dodgeCd: 0,
    statuses: new Map(), alive: true, respawnT: 0, invulnT: 0, spawnProtectT: 1.5,
    inBush: false, bushStayT: 0, revealT: 0, revealedFor: [], combatT: 10,
    stats: { kills: 0, deaths: 0, assists: 0, damage: 0, taken: 0, healing: 0, objective: 0, maxStreak: 0, streak: 0, maxCombo: 0, survival: 0, protect: 0, defense: 0 },
    combo: 0, comboT: 0, hitStreak: 0, hitStreakT: 0, revenge: 0, frost: 0, entropyT: 0,
    cubes: 0, gears: new Set(o.gears.slice(0, 2)), gems: 0, lives: 1,
    input: emptyInput(), prevInput: emptyInput(), chargeT: 0, charging: false, dash: null, air: null, hitstop: 0,
    lastHitBy: new Map(), cloneOf: null, cloneT: 0, isBoss: false, ambushReady: false, firstShotDelay: 0,
  };
  if (f.gears.has('SHIELD')) { f.gearShieldMax = Math.round(char.hp * 0.15); f.gearShield = f.gearShieldMax; }
  return f;
}

export function applyCubeStats(f: Fighter) {
  const m = cubeMult(f);
  const frac = f.hp / f.maxHp;
  f.maxHp = Math.round(f.baseMaxHp * m);
  f.hp = Math.max(1, Math.round(f.maxHp * frac));
}

export function speedOf(w: World, f: Fighter): number {
  let s = SPEED[f.char.speedClass];
  if (f.isBoss) s = SPEED.SLOW;
  s *= 1 - Math.min(0.75, pow(f, 'slow'));
  s *= 1 + pow(f, 'haste');
  if (f.inBush && f.gears.has('SPEED')) s *= 1.15;
  if (f.inBush && f.char.passive.type === 'bushPower') s *= 1.1;
  if (w.cfg.mode.powerCubes) s *= Math.min(CUBE_SPEED_CAP, cubeMult(f)); // ⚡ 1.1^n, capped for controllability (see config)
  if (w.ball && w.ball.holder === f.id) s *= 0.92;
  if (f.charging) s *= 0.7;
  return s;
}

export function isHidden(f: Fighter): boolean { return (f.inBush && f.revealT <= 0 && f.bushStayT >= 0.5) || has(f, 'invis'); }

export function updateFighter(w: World, f: Fighter) {
  if (!f.alive) return;
  if (f.cloneOf !== null) { f.cloneT -= DT; if (f.cloneT <= 0) { f.alive = false; return; } }
  f.stats.survival += DT;
  // timers
  f.invulnT = Math.max(0, f.invulnT - DT); f.spawnProtectT = Math.max(0, f.spawnProtectT - DT);
  f.revealT = Math.max(0, f.revealT - DT);
  for (let i = 0; i < f.revealedFor.length; i++) if (f.revealedFor[i] > 0) f.revealedFor[i] -= DT;
  f.cd[0] = Math.max(0, f.cd[0] - DT); f.cd[1] = Math.max(0, f.cd[1] - DT); f.dodgeCd = Math.max(0, f.dodgeCd - DT);
  f.comboT = Math.max(0, f.comboT - DT); if (f.comboT <= 0) f.combo = 0;
  f.hitStreakT = Math.max(0, f.hitStreakT - DT); if (f.hitStreakT <= 0) f.hitStreak = 0;
  f.shieldT = Math.max(0, f.shieldT - DT); if (f.shieldT <= 0) f.shield = 0;
  f.combatT += DT; f.entropyT += DT;
  if (f.lock > 0) f.lock--;
  // statuses
  for (const [k, s] of f.statuses) {
    if (s.t <= 0) continue;
    s.t -= DT;
    if (k === 'poison' || k === 'burn' || k === 'bleed') {
      if (w.tick % 15 === 0) {
        const src = w.fighters.find(a => a.id === s.src) ?? null;
        let dps = s.power; if (k === 'bleed' && f.moving) dps *= 1.5;
        damageFighter(w, src, f, dps * 0.25, { kind: 'dot', element: k === 'burn' ? 'fire' : k === 'poison' ? 'poison' : 'physical' });
        if (!f.alive) return;
      }
    }
  }
  // reload
  const a = f.char.attack;
  if (f.ammo < a.ammo) {
    const sp = 1 + pow(f, 'atkSpeed');
    f.reloadT += DT * sp;
    if (f.reloadT >= a.reload) { f.reloadT = 0; f.ammo = Math.min(a.ammo, f.ammo + 1); }
  } else f.reloadT = 0;
  // regen
  const tile = tileAt(w, f.x, f.y);
  if (f.combatT > 3 && f.hp < f.maxHp && !w.cfg.mode.id.startsWith('duel') && !f.isBoss) {
    const rate = 0.13 * (f.gears.has('HEALTH') ? 1.5 : 1);
    if (w.tick % 15 === 0) healFighter(w, f, f, f.maxHp * rate * 0.25, true);
  }
  if (tile === T.HEAL && w.tick % 15 === 0) healFighter(w, f, f, f.maxHp * 0.025, true);
  if (tile === T.HAZARD && w.tick % 15 === 0 && !f.air) damageFighter(w, null, f, 140, { kind: 'env' });
  if (!f.alive) return;
  // gear shield recharge
  if (f.gearShieldMax > 0 && f.gearShield <= 0) {
    if (f.hp >= f.maxHp) { f.fullHpT += DT; if (f.fullHpT >= 5) { f.gearShield = f.gearShieldMax; f.fullHpT = 0; } } else f.fullHpT = 0;
  }
  // bush state
  const wasInBush = f.inBush;
  f.inBush = tile === T.BUSH && !f.air;
  if (f.inBush && !wasInBush && f.revealT <= 0) f.bushStayT = 0.5;
  if (!f.inBush || f.revealT > 0) { if (!f.inBush) f.bushStayT = 0; }
  else f.bushStayT += DT;
  if (isHidden(f)) f.ambushReady = f.ambushReady || f.char.passive.type === 'ambush';
  // hitstop: freeze briefly
  if (f.hitstop > 0) { f.hitstop--; return; }
  // casting
  updateCast(w, f);
  // movement
  const inp = f.input;
  let mx = 0, my = 0;
  if (f.air) {
    f.air.t += DT; const k = Math.min(1, f.air.t / f.air.T);
    f.x = f.air.sx + (f.air.tx - f.air.sx) * k; f.y = f.air.sy + (f.air.ty - f.air.sy) * k;
    if (k >= 1) f.air = null;
    f.moving = true;
  } else if (f.dash) {
    const d = f.dash; const step = Math.min(d.left, Math.hypot(d.vx, d.vy) * DT);
    const ux = d.vx / Math.hypot(d.vx, d.vy), uy = d.vy / Math.hypot(d.vx, d.vy);
    const r = moveCircle(w, f.x, f.y, f.radius, ux * step, uy * step);
    if (d.kb > 60) { const fx = f.x + ux * (f.radius + 8), fy = f.y + uy * (f.radius + 8); if (tileAt(w, fx, fy) === T.CRATE) damageTile(w, fx, fy, 99999); }
    f.x = r.x; f.y = r.y; d.left -= step; f.moving = true;
    if (d.dmg > 0) {
      for (const t of w.fighters) {
        if (!t.alive || t.team === f.team || d.hit.has(t.id)) continue;
        if ((t.x - f.x) ** 2 + (t.y - f.y) ** 2 < (d.r * 0.6 + t.radius) ** 2) {
          d.hit.add(t.id);
          damageFighter(w, f, t, d.dmg, { kind: d.ownerKind, kb: d.kb, dirX: ux, dirY: uy, status: d.status, ignoreShield: f.char.skill1.name === 'ガード崩し' });
          if (d.stop) { d.left = 0; break; }
        }
      }
      for (const s of w.structures) if (!s.dead && s.team !== f.team && !d.hit.has(-s.id) && (s.x - f.x) ** 2 + (s.y - f.y) ** 2 < (d.r * 0.6 + s.r) ** 2) { d.hit.add(-s.id); novaAt(w, f, s.x, s.y, 10, d.dmg, d.ownerKind, 0); }
    }
    if (d.left <= 0 || (r.hitX && r.hitY)) f.dash = null;
  } else if (canMove(f)) {
    mx = inp.mx; my = inp.my;
    const l = Math.hypot(mx, my);
    if (l > 1) { mx /= l; my /= l; }
    const sp = speedOf(w, f) * (f.lock > 0 && f.char.attack.pattern === 'charge' ? 0.8 : 1);
    if (l > 0.05) {
      const r = moveCircle(w, f.x, f.y, f.radius, mx * sp * DT, my * sp * DT);
      f.x = r.x; f.y = r.y; f.moving = true; f.lastMoveX = mx; f.lastMoveY = my;
      if (!f.casting && f.lock <= 0 && !inp.attack) f.facing = Math.atan2(my, mx);
    } else f.moving = false;
  } else f.moving = false;
  // knockback velocity
  if (Math.abs(f.kx) + Math.abs(f.ky) > 1) {
    const r = moveCircle(w, f.x, f.y, f.radius, f.kx * DT, f.ky * DT);
    f.x = r.x; f.y = r.y;
    if (r.hitX) f.kx *= -0.2; if (r.hitY) f.ky *= -0.2;
    f.kx *= 0.82; f.ky *= 0.82;
  } else { f.kx = 0; f.ky = 0; }
  // jump pad
  if (!f.air && tileAt(w, f.x, f.y) === T.JUMP && canMove(f)) {
    const ang = Math.hypot(f.lastMoveX, f.lastMoveY) > 0.1 ? Math.atan2(f.lastMoveY, f.lastMoveX) : f.facing;
    let tx = f.x + Math.cos(ang) * 5 * TILE, ty = f.y + Math.sin(ang) * 5 * TILE;
    for (let k = 0; k < 12; k++) { if (!moveCircle(w, tx, ty, f.radius, 0, 0).hitX && tileAt(w, tx, ty) !== T.WALL && tileAt(w, tx, ty) !== T.CRATE && tileAt(w, tx, ty) !== T.WATER) break; tx -= Math.cos(ang) * TILE * 0.4; ty -= Math.sin(ang) * TILE * 0.4; }
    f.air = { t: 0, T: 0.6, sx: f.x, sy: f.y, tx, ty };
  }
  // actions
  if (!canAct(f)) { f.charging = false; return; }
  const aimAng = Math.hypot(inp.aimX, inp.aimY) > 0.01 ? Math.atan2(inp.aimY, inp.aimX) : f.facing;
  if (inp.attack || f.charging) f.aim = aimAng;
  // dodge
  if (inp.dodge && !f.prevInput.dodge && f.dodgeCd <= 0 && !f.casting && !f.dash) {
    const ang = Math.hypot(mx, my) > 0.1 ? Math.atan2(my, mx) : f.facing;
    f.dash = { vx: Math.cos(ang) * 24 * TILE, vy: Math.sin(ang) * 24 * TILE, left: 2.2 * TILE, dmg: 0, r: 0, kb: 0, stop: false, hit: new Set(), ownerKind: 'skill' };
    f.invulnT = 0.18; f.dodgeCd = 3.5;
    w.events.push({ type: 'dodge', owner: f.id });
  }
  const ball = w.ball && w.ball.holder === f.id;
  if (!ball) {
    if (f.char.attack.pattern === 'charge') {
      if (inp.attack && f.ammo >= 1 && f.lock <= 0) { f.charging = true; f.chargeT += DT; }
      else if (f.charging && (!inp.attack || f.chargeT >= (f.char.attack.chargeMax ?? 1) * 1.6)) {
        f.charging = false;
        tryAttack(w, f, f.aim, Math.min(1, f.chargeT / (f.char.attack.chargeMax ?? 1)));
        f.chargeT = 0;
      }
    } else if (inp.attack) tryAttack(w, f, aimAng);
  }
  if (inp.skill1 && !f.prevInput.skill1) tryAbility(w, f, 1, aimAng, inp.aimDist);
  if (inp.skill2 && !f.prevInput.skill2) tryAbility(w, f, 2, aimAng, inp.aimDist);
  if (inp.ult && !f.prevInput.ult) tryAbility(w, f, 3, aimAng, inp.aimDist);
  if (f.statuses.get('invis')?.t ?? 0 > 0) { /* stays invisible until attack */ }
  void endInvis; void applyStatus;
}

export function respawnFighter(w: World, f: Fighter) {
  const p = w.rules.spawnPoint(w, f);
  f.x = p.x; f.y = p.y; f.alive = true; f.hp = f.maxHp; f.shield = 0; f.statuses.clear(); f.ammo = f.char.attack.ammo;
  f.spawnProtectT = 2; f.kx = f.ky = 0; f.dash = null; f.air = null; f.casting = null; f.frost = 0; f.combo = 0; f.revenge = 0; f.entropyT = 0;
  if (f.gearShieldMax) f.gearShield = f.gearShieldMax;
  w.events.push({ type: 'respawn', owner: f.id });
}
