import { DT, TILE } from '../core/constants';
import { T } from '../data/maps';
import type { ModeId } from '../data/modes';
import { applyCubeStats } from './fighter';
import { canAct, damageFighter } from './combat';
import { collides } from './physics';
import { finishMatch } from './world';
import type { Fighter, HudInfo, ModeRules, Structure, World } from './types';
import { getChar } from '../data/characters';
import { atk, skill, ult, passive } from '../data/presets';
import type { CharacterDef } from '../data/types';

const fmt = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
const real = (w: World) => w.fighters.filter(f => f.cloneOf === null);
const alive = (w: World, team: number) => real(w).filter(f => f.alive && f.team === team);

function randomFloor(w: World, avoid: Fighter[] = [], minD = 5 * TILE): { x: number; y: number } {
  for (let k = 0; k < 200; k++) {
    const tx = w.rng.int(1, w.map.w - 2), ty = w.rng.int(1, w.map.h - 2);
    const t = w.map.tiles[ty * w.map.w + tx];
    if (t !== T.FLOOR && t !== T.BUSH) continue;
    const x = tx * TILE + TILE / 2, y = ty * TILE + TILE / 2;
    if (avoid.some(a => a.alive && (a.x - x) ** 2 + (a.y - y) ** 2 < minD * minD) && k < 150) continue;
    return { x, y };
  }
  return { x: w.map.w * TILE / 2, y: w.map.h * TILE / 2 };
}
function freeNear(w: World, x: number, y: number): { x: number; y: number } {
  for (let r = 0; r < 6; r++) for (let a = 0; a < 8; a++) {
    const px = x + Math.cos(a * Math.PI / 4) * r * TILE * 0.6, py = y + Math.sin(a * Math.PI / 4) * r * TILE * 0.6;
    if (!collides(w, px, py, 24)) return { x: px, y: py };
  }
  return { x, y };
}
function ringSpawn(w: World, f: Fighter): { x: number; y: number } {
  const teams = w.cfg.mode.teams;
  const idx = f.team;
  const a = (idx / teams) * Math.PI * 2 - Math.PI / 2;
  const R = Math.min(w.map.w, w.map.h) * TILE * (w.cfg.mode.powerCubes ? 0.43 : 0.38);
  const mates = real(w).filter(m => m.team === f.team);
  const k = mates.indexOf(f);
  return freeNear(w, w.map.w * TILE / 2 + Math.cos(a) * R + k * 40, w.map.h * TILE / 2 + Math.sin(a) * R);
}
/** team 0 bottom, team 1 top */
function baseSpawn(w: World, f: Fighter): { x: number; y: number } {
  const mates = real(w).filter(m => m.team === f.team);
  const k = Math.max(0, mates.indexOf(f));
  const cx = w.map.w * TILE / 2 + (k - (mates.length - 1) / 2) * TILE * 1.5;
  const y = f.team === 0 ? (w.map.h - 2.5) * TILE : 2.5 * TILE;
  return freeNear(w, cx, y);
}
function rankByScore(teams: number, score: (t: number) => number): number[] {
  return Array.from({ length: teams }, (_, i) => i).sort((a, b) => score(b) - score(a));
}
function teamKills(w: World, t: number) { return real(w).filter(f => f.team === t).reduce((a, f) => a + f.stats.kills, 0); }
function hpFrac(w: World, t: number) { const m = real(w).filter(f => f.team === t); return m.reduce((a, f) => a + (f.alive ? f.hp / f.maxHp : 0), 0) / Math.max(1, m.length); }

function timer(w: World): boolean { w.timeLeft = w.cfg.mode.duration - (w.time - ((w.modeState.roundStart as number) ?? 0)); return w.timeLeft <= 0; }

// ───────────── FREE FOR ALL ─────────────
const ffa: ModeRules = {
  objectiveName: 'キル',
  init() {},
  tick(w) {
    if (w.cfg.practice) { w.timeLeft = 999; return; }
    if (timer(w)) {
      const sc = (t: number) => { const f = real(w).find(x => x.team === t)!; return f.stats.kills * 1000 - f.stats.deaths * 10 + f.stats.damage / 100000; };
      finishMatch(w, rankByScore(w.cfg.mode.teams, sc), '時間切れ');
    }
  },
  onKill() {}, canRespawn: () => true,
  spawnPoint(w, f) { return f.stats.deaths === 0 ? ringSpawn(w, f) : randomFloor(w, real(w).filter(o => o.team !== f.team)); },
  hud(w) {
    const p = real(w).find(f => f.isPlayer)!;
    const sorted = real(w).slice().sort((a, b) => b.stats.kills - a.stats.kills);
    return { title: w.cfg.practice ? '練習場（ESCで終了）' : 'FREE FOR ALL', left: `${p.stats.kills} KILL`, right: `${sorted.indexOf(p) + 1}位 / ${sorted.length}`, center: w.cfg.practice ? 'PRACTICE' : fmt(w.timeLeft) };
  },
};

// ───────────── TEAM DEATHMATCH ─────────────
const tdm: ModeRules = {
  objectiveName: 'キル',
  init() {}, onKill(w) {
    for (const t of [0, 1]) if (teamKills(w, t) >= 20) finishMatch(w, t === 0 ? [0, 1] : [1, 0], '20キル達成');
  },
  tick(w) {
    if (timer(w)) {
      const a = teamKills(w, 0), b = teamKills(w, 1);
      if (a === b) finishMatch(w, [0, 1], '時間切れ（同点）', [0, 1]); else finishMatch(w, a > b ? [0, 1] : [1, 0], '時間切れ');
    }
  },
  canRespawn: () => true, spawnPoint: baseSpawn,
  hud(w) { const p = w.cfg.playerTeam; return { title: 'TEAM DEATHMATCH', left: `${teamKills(w, p)}`, right: `${teamKills(w, 1 - p)}`, center: fmt(w.timeLeft), teamScores: [teamKills(w, 0), teamKills(w, 1)], bars: [{ label: '20キルで勝利', value: teamKills(w, p) / 20, color: '#4fc3ff' }, { label: '敵', value: teamKills(w, 1 - p) / 20, color: '#ff4d6d' }] }; },
};

// ───────────── ROUND-BASED (DUEL / DEATHMATCH) ─────────────
function roundRules(title: string, need: number): ModeRules {
  const resetRound = (w: World) => {
    w.modeState.roundStart = w.time; w.modeState.between = 0;
    w.projectiles = []; w.zones = [];
    for (const f of real(w)) {
      const p = baseSpawn(w, f);
      Object.assign(f, { x: p.x, y: p.y, alive: true, hp: f.maxHp, shield: 0, ammo: f.char.attack.ammo, spawnProtectT: 1.5, kx: 0, ky: 0, dash: null, air: null, casting: null, frost: 0 });
      f.statuses.clear(); f.cd = [0, 0];
    }
    w.fighters = w.fighters.filter(f => f.cloneOf === null);
  };
  return {
    objectiveName: 'ラウンド',
    init(w) { w.modeState.wins = [0, 0]; w.modeState.round = 1; w.modeState.roundStart = 0; w.modeState.between = 0; w.modeState.score = { roundsA: 0, roundsB: 0 }; },
    onKill() {}, canRespawn: () => false, spawnPoint: baseSpawn,
    tick(w) {
      const st = w.modeState as { wins: number[]; round: number; between: number; roundStart: number };
      if (st.between > 0) { st.between -= DT; if (st.between <= 0) { st.round++; resetRound(w); w.events.push({ type: 'announce', text: `ROUND ${st.round}`, big: true }); } return; }
      const a = alive(w, 0).length, b = alive(w, 1).length;
      let winner: number | null = -1;
      if (a === 0 && b === 0) winner = null;
      else if (a === 0) winner = 1; else if (b === 0) winner = 0;
      else if (timer(w)) {
        // time out: survivors count, then remaining HP ratio
        if (a !== b) winner = a > b ? 0 : 1;
        else { const ha = hpFrac(w, 0), hb = hpFrac(w, 1); winner = Math.abs(ha - hb) < 0.001 ? null : ha > hb ? 0 : 1; }
      }
      if (winner === -1) return;
      if (winner !== null) st.wins[winner]++;
      (w.modeState.score as Record<string, number>).roundsA = st.wins[0]; (w.modeState.score as Record<string, number>).roundsB = st.wins[1];
      w.events.push({ type: 'announce', text: winner === null ? 'ROUND DRAW' : winner === w.cfg.playerTeam ? 'ROUND WIN' : 'ROUND LOST', color: winner === w.cfg.playerTeam ? '#ffd23f' : '#ff4d6d', big: true });
      if (st.wins[0] >= need || st.wins[1] >= need) { finishMatch(w, st.wins[0] > st.wins[1] ? [0, 1] : [1, 0], `${st.wins[0]}-${st.wins[1]}`); return; }
      if (st.round >= need * 2 + 1) { // safety: too many draws
        if (st.wins[0] === st.wins[1]) finishMatch(w, [0, 1], '引き分け', [0, 1]); else finishMatch(w, st.wins[0] > st.wins[1] ? [0, 1] : [1, 0], `${st.wins[0]}-${st.wins[1]}`);
        return;
      }
      st.between = 2.5;
    },
    hud(w) { const st = w.modeState as { wins: number[]; round: number }; const p = w.cfg.playerTeam; return { title: title, left: `${st.wins[p]}`, right: `${st.wins[1 - p]}`, center: `R${st.round}  ${fmt(w.timeLeft)}`, teamScores: st.wins }; },
  };
}

// ───────────── BOSS HUNT ─────────────
export const BOSS_CHAR: CharacterDef = {
  ...getChar(31), id: 999, key: 'GORGON', name: 'GORGON', hp: 48000, speedClass: 'SLOW', color: '#8b0000',
  attack: { ...atk.grenade(1.3), name: '溶岩弾', count: 3, spreadDeg: 40, pattern: 'spread', explodeRadius: 1.2 },
  skill1: { ...skill.quake(1.4), cooldown: 7 }, skill2: { ...skill.bombard(1.2), cooldown: 9 }, ult: ult.meteor(1.5), ultCharge: 9000,
  passive: passive('lowHpDefense', 0.2, 0.3), status: 'complete',
};
const boss: ModeRules = {
  objectiveName: 'ボスダメージ',
  init(w) {
    const b = real(w).find(f => f.team === 1);
    if (b) { b.char = BOSS_CHAR; b.isBoss = true; b.radius = 46; b.maxHp = b.baseMaxHp = b.hp = BOSS_CHAR.hp; b.ammo = 3; b.name = 'GORGON'; const c = { x: w.map.w * TILE / 2, y: w.map.h * TILE / 2 }; b.x = c.x; b.y = c.y; }
    w.modeState.score = {};
  },
  onKill(w, v) { if (v.isBoss) finishMatch(w, [0, 1], 'ボス討伐'); },
  tick(w) {
    const b = real(w).find(f => f.isBoss);
    if (b) { // enrage below 50%
      if (b.hp < b.maxHp * 0.5 && !w.modeState.enraged) { w.modeState.enraged = true; b.statuses.set('dmgUp', { t: 999, power: 0.3, src: b.id }); w.events.push({ type: 'announce', text: 'GORGON 激昂！', color: '#ff4d6d', big: true }); }
      for (const f of real(w)) if (f.team === 0) f.stats.objective = f.stats.damage;
    }
    if (timer(w)) finishMatch(w, [1, 0], '時間切れ');
  },
  canRespawn: (_w, f) => !f.isBoss,
  spawnPoint(w, f) { return f.isBoss ? { x: w.map.w * TILE / 2, y: w.map.h * TILE / 2 } : freeNear(w, w.map.w * TILE / 2 + (real(w).indexOf(f) - 1) * TILE * 1.5, (w.map.h - 2.5) * TILE); },
  hud(w) { const b = real(w).find(f => f.isBoss); return { title: 'BOSS HUNT', left: '討伐せよ', right: '', center: fmt(w.timeLeft), bars: b ? [{ label: 'GORGON', value: b.hp / b.maxHp, color: '#ff4d6d' }] : [] }; },
};

// ───────────── BATTLE ROYALE ─────────────
const br: ModeRules = {
  objectiveName: '⚡',
  init(w) {
    const n = w.cfg.mode.id === 'br-mega' ? 34 : 20;
    for (let i = 0; i < n; i++) {
      const p = randomFloor(w, [], 0);
      w.structures.push({ id: w.nextId++, kind: 'box', team: -1, owner: -1, x: p.x, y: p.y, r: 26, hp: 6000, maxHp: 6000, t: 0, dead: false });
    }
    const S = Math.max(w.map.w, w.map.h) * TILE;
    w.storm = { cx: w.map.w * TILE / 2, cy: w.map.h * TILE / 2, r: S * 0.75, targetR: 2 * TILE, dps: 300 };
    w.modeState.elim = [] as number[];
    const teamSize = w.cfg.mode.teamSize;
    for (const f of real(w)) { f.lives = teamSize > 1 ? 1 : 0; f.spawnProtectT = 3; }
  },
  onStructureDestroyed(w, s) { if (s.kind === 'box') w.pickups.push({ id: w.nextId++, kind: 'cube', x: s.x, y: s.y, t: 9999, vx: 0, vy: 0 }); },
  onKill(w, _v, killer) {
    if (killer && killer.cloneOf === null) { killer.cubes++; applyCubeStats(killer); w.events.push({ type: 'pickup', owner: killer.id, kind: 'cube' }); }
  },
  canRespawn(w, f) {
    if (w.cfg.mode.teamSize === 1 || f.lives <= 0) return false;
    if (alive(w, f.team).length === 0) return false;
    f.lives--; return true;
  },
  spawnPoint(w, f) {
    if (f.stats.deaths > 0) { const mate = alive(w, f.team)[0]; if (mate) return freeNear(w, mate.x, mate.y); }
    return ringSpawn(w, f);
  },
  tick(w) {
    timer(w);
    const s = w.storm!;
    const k = Math.min(1, w.time / (w.cfg.mode.duration * 0.85));
    const S0 = Math.max(w.map.w, w.map.h) * TILE * 0.75;
    s.r = S0 + (s.targetR - S0) * k;
    s.dps = 300 + k * 900;
    if (w.tick % 15 === 0) for (const f of real(w)) if (f.alive && (f.x - s.cx) ** 2 + (f.y - s.cy) ** 2 > s.r * s.r) damageFighter(w, null, f, s.dps * 0.25, { kind: 'env' });
    // pickups
    for (const p of w.pickups) {
      if (p.t <= 0) continue;
      for (const f of real(w)) if (f.alive && (f.x - p.x) ** 2 + (f.y - p.y) ** 2 < (f.radius + 16) ** 2) { p.t = 0; f.cubes++; applyCubeStats(f); f.stats.objective++; w.events.push({ type: 'pickup', owner: f.id, kind: 'cube' }); break; }
    }
    w.pickups = w.pickups.filter(p => p.t > 0);
    // eliminations
    const elim = w.modeState.elim as number[];
    for (let t = 0; t < w.cfg.mode.teams; t++) {
      if (elim.includes(t)) continue;
      const m = real(w).filter(f => f.team === t);
      const out = m.every(f => !f.alive && (f.lives <= 0 || alive(w, t).length === 0));
      if (out) { elim.push(t); if (t === w.cfg.playerTeam && !w.over) w.events.push({ type: 'announce', text: `${w.cfg.mode.teams - elim.length + 1}位`, big: true }); }
    }
    const remaining = Array.from({ length: w.cfg.mode.teams }, (_, i) => i).filter(t => !elim.includes(t));
    const playerOut = elim.includes(w.cfg.playerTeam);
    if (remaining.length <= 1 || playerOut || w.timeLeft <= -30) {
      // Ranking: remaining teams by alive hp, then eliminated in reverse order
      const rem = remaining.sort((a, b) => hpFrac(w, b) - hpFrac(w, a));
      if (playerOut && remaining.length > 1) {
        // player's placement determined; rest of order simulated by current state
        finishMatch(w, [...rem, ...elim.slice().reverse()], `${rem.length + elim.slice().reverse().indexOf(w.cfg.playerTeam) + 1}位で脱落`);
      } else finishMatch(w, [...rem, ...elim.slice().reverse()], remaining.length <= 1 ? '最後の生存者' : '時間切れ');
    }
  },
  hud(w) {
    const elim = (w.modeState.elim as number[]) ?? [];
    const p = real(w).find(f => f.isPlayer)!;
    return { title: w.cfg.mode.name, left: `⚡ ${p.cubes}`, right: `残り ${w.cfg.mode.teams - elim.length} ${w.cfg.mode.teamSize > 1 ? 'チーム' : '人'}`, center: fmt(Math.max(0, w.timeLeft)) };
  },
};

// ───────────── GEM HUNT ─────────────
const gem: ModeRules = {
  objectiveName: 'ジェム',
  init(w) { w.modeState.spawnT = 3; w.modeState.count = 0; w.modeState.countTeam = -1; w.modeState.score = { gemsA: 0, gemsB: 0 }; },
  onKill(w, v) {
    if (v.gems > 0) {
      for (let i = 0; i < v.gems; i++) { const a = w.rng.next() * Math.PI * 2, sp = w.rng.range(60, 160); w.pickups.push({ id: w.nextId++, kind: 'gem', x: v.x, y: v.y, t: 15, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp }); }
      v.gems = 0;
    }
  },
  tick(w) {
    const st = w.modeState as { spawnT: number; count: number; countTeam: number; score: Record<string, number> };
    const cx = w.map.w * TILE / 2, cy = w.map.h * TILE / 2;
    st.spawnT -= DT;
    if (st.spawnT <= 0) { st.spawnT = 7; const a = w.rng.next() * Math.PI * 2; w.pickups.push({ id: w.nextId++, kind: 'gem', x: cx, y: cy, t: 9999, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110 }); }
    for (const p of w.pickups) {
      if (p.vx || p.vy) { const nx = p.x + p.vx * DT, ny = p.y + p.vy * DT; if (!collides(w, nx, ny, 8)) { p.x = nx; p.y = ny; } else { p.vx = p.vy = 0; } p.vx *= 0.9; p.vy *= 0.9; if (Math.abs(p.vx) + Math.abs(p.vy) < 5) p.vx = p.vy = 0; }
      if (p.t < 9999) p.t -= DT;
      if (p.t <= 0) continue;
      for (const f of real(w)) if (f.alive && (f.x - p.x) ** 2 + (f.y - p.y) ** 2 < (f.radius + 14) ** 2) { p.t = 0; f.gems++; f.stats.objective++; w.events.push({ type: 'pickup', owner: f.id, kind: 'gem' }); break; }
    }
    w.pickups = w.pickups.filter(p => p.t > 0);
    const g = [0, 1].map(t => real(w).filter(f => f.team === t).reduce((a, f) => a + f.gems, 0));
    st.score.gemsA = g[0]; st.score.gemsB = g[1];
    const lead = g[0] >= 10 && g[0] > g[1] ? 0 : g[1] >= 10 && g[1] > g[0] ? 1 : -1;
    if (lead !== st.countTeam) { st.countTeam = lead; st.count = 15; if (lead >= 0) w.events.push({ type: 'announce', text: lead === w.cfg.playerTeam ? 'カウントダウン開始！守り切れ！' : '敵がカウントダウン中！', color: lead === w.cfg.playerTeam ? '#4fc3ff' : '#ff4d6d' }); }
    if (lead >= 0) { st.count -= DT; if (st.count <= 0) { finishMatch(w, lead === 0 ? [0, 1] : [1, 0], 'ジェム防衛成功'); return; } }
    if (timer(w)) { if (g[0] === g[1]) finishMatch(w, [0, 1], '時間切れ（同数）', [0, 1]); else finishMatch(w, g[0] > g[1] ? [0, 1] : [1, 0], '時間切れ'); }
  },
  canRespawn: () => true, spawnPoint: baseSpawn,
  hud(w) {
    const st = w.modeState as { count: number; countTeam: number; score: Record<string, number> };
    const p = w.cfg.playerTeam; const g = [st.score.gemsA, st.score.gemsB];
    return { title: 'GEM HUNT', left: `💎${g[p]}`, right: `💎${g[1 - p]}`, center: st.countTeam >= 0 ? `${st.countTeam === p ? '防衛' : '阻止'} ${Math.ceil(st.count)}` : fmt(w.timeLeft), teamScores: g };
  },
};

// ───────────── VAULT BREAK ─────────────
const vault: ModeRules = {
  objectiveName: '金庫ダメージ',
  init(w) {
    const cx = w.map.w * TILE / 2;
    for (const t of [0, 1]) {
      const y = t === 0 ? (w.map.h - 4.5) * TILE : 4.5 * TILE;
      // clear tiles around vault
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const tx = Math.floor(cx / TILE) + dx, ty = Math.floor(y / TILE) + dy; w.map.tiles[ty * w.map.w + tx] = T.FLOOR; }
      w.structures.push({ id: w.nextId++, kind: 'vault', team: t, owner: -1, x: cx, y, r: 40, hp: 30000, maxHp: 30000, t: 0, dead: false });
    }
    w.modeState.score = { vaultA: 100, vaultB: 100 };
  },
  onKill() {},
  onStructureDestroyed(w, s) { if (s.kind === 'vault') finishMatch(w, s.team === 0 ? [1, 0] : [0, 1], '金庫破壊'); },
  tick(w) {
    const v = [0, 1].map(t => w.structures.find(s => s.kind === 'vault' && s.team === t)!);
    const sc = w.modeState.score as Record<string, number>; sc.vaultA = Math.round(v[0].hp / v[0].maxHp * 100); sc.vaultB = Math.round(v[1].hp / v[1].maxHp * 100);
    // defenders near own vault accrue defense contribution
    if (w.tick % 30 === 0) for (const f of real(w)) { const own = v[f.team]; if (f.alive && (f.x - own.x) ** 2 + (f.y - own.y) ** 2 < (4 * TILE) ** 2) f.stats.defense += 1; }
    if (timer(w)) {
      const a = v[0].hp / v[0].maxHp, b = v[1].hp / v[1].maxHp;
      if (Math.abs(a - b) < 1e-6) finishMatch(w, [0, 1], '時間切れ（同率）', [0, 1]); else finishMatch(w, a > b ? [0, 1] : [1, 0], '時間切れ');
    }
  },
  canRespawn: () => true, spawnPoint: baseSpawn,
  hud(w) { const v = [0, 1].map(t => w.structures.find(s => s.kind === 'vault' && s.team === t)!); const p = w.cfg.playerTeam; return { title: 'VAULT BREAK', left: '', right: '', center: fmt(w.timeLeft), bars: [{ label: '味方金庫', value: v[p].hp / v[p].maxHp, color: '#4fc3ff' }, { label: '敵金庫', value: v[1 - p].hp / v[1 - p].maxHp, color: '#ff4d6d' }] }; },
};

// ───────────── TERRITORY ─────────────
export function territoryZones(w: World) { return [{ x: w.map.w * TILE * 0.27, y: w.map.h * TILE / 2, r: 2.3 * TILE }, { x: w.map.w * TILE * 0.73, y: w.map.h * TILE / 2, r: 2.3 * TILE }]; }
const territory: ModeRules = {
  objectiveName: '占領',
  init(w) {
    for (const z of territoryZones(w)) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const tx = Math.floor(z.x / TILE) + dx, ty = Math.floor(z.y / TILE) + dy; const i = ty * w.map.w + tx; if (w.map.tiles[i] === T.WALL || w.map.tiles[i] === T.WATER || w.map.tiles[i] === T.CRATE) w.map.tiles[i] = T.FLOOR; }
    w.modeState.cap = [0, 0]; w.modeState.owner = [-1, -1]; w.modeState.score = { capA: 0, capB: 0 };
  },
  onKill() {},
  tick(w) {
    const st = w.modeState as { cap: number[]; owner: number[]; score: Record<string, number> };
    territoryZones(w).forEach((z, zi) => {
      const inside = [0, 1].map(t => alive(w, t).filter(f => (f.x - z.x) ** 2 + (f.y - z.y) ** 2 < z.r * z.r));
      if (inside[0].length && inside[1].length) { st.owner[zi] = -2; return; } // contested
      for (const t of [0, 1]) if (inside[t].length) {
        const rate = 1.0 * (1 + 0.5 * (inside[t].length - 1));
        st.cap[t] = Math.min(100, st.cap[t] + rate * DT);
        st.owner[zi] = t;
        for (const f of inside[t]) f.stats.objective += rate * DT;
      }
      if (!inside[0].length && !inside[1].length) st.owner[zi] = -1;
    });
    st.score.capA = Math.floor(st.cap[0]); st.score.capB = Math.floor(st.cap[1]);
    for (const t of [0, 1]) if (st.cap[t] >= 100) { finishMatch(w, t === 0 ? [0, 1] : [1, 0], '100%占領'); return; }
    if (timer(w)) { const a = Math.floor(st.cap[0]), b = Math.floor(st.cap[1]); if (a === b) finishMatch(w, [0, 1], '時間切れ（同率）', [0, 1]); else finishMatch(w, a > b ? [0, 1] : [1, 0], '時間切れ'); }
  },
  canRespawn: () => true, spawnPoint: baseSpawn,
  hud(w) { const st = w.modeState as { cap: number[] }; const p = w.cfg.playerTeam; return { title: 'TERRITORY BATTLE', left: `${Math.floor(st.cap[p])}%`, right: `${Math.floor(st.cap[1 - p])}%`, center: fmt(w.timeLeft), bars: [{ label: '味方占領率', value: st.cap[p] / 100, color: '#4fc3ff' }, { label: '敵占領率', value: st.cap[1 - p] / 100, color: '#ff4d6d' }] }; },
};

// ───────────── KILL & GOAL ─────────────
export const BALL_R = 14;
function resetBall(w: World) {
  w.ball = { x: w.map.w * TILE / 2, y: w.map.h * TILE / 2, vx: 0, vy: 0, holder: null, noPickT: 1.0, lastTeam: -1, lastTouch: -1 };
}
export function kickBall(w: World, f: Fighter, ang: number, speedTiles: number) {
  const b = w.ball; if (!b || b.holder !== f.id) return;
  b.holder = null; b.vx = Math.cos(ang) * speedTiles * TILE; b.vy = Math.sin(ang) * speedTiles * TILE; b.noPickT = 0.35; b.lastTeam = f.team; b.lastTouch = f.id;
  b.x = f.x + Math.cos(ang) * (f.radius + BALL_R + 2); b.y = f.y + Math.sin(ang) * (f.radius + BALL_R + 2);
  if (collides(w, b.x, b.y, BALL_R, t => t === T.WALL || t === T.CRATE)) { b.x = f.x; b.y = f.y; }
  w.events.push({ type: 'shot', owner: f.id, x: f.x, y: f.y, pattern: 'kick', kind: 'attack' });
}
const goalMode: ModeRules = {
  objectiveName: 'ゴール貢献',
  init(w) { resetBall(w); w.modeState.goals = [0, 0]; w.modeState.pause = 0; w.modeState.overtime = false; w.modeState.score = { goalsA: 0, goalsB: 0 }; w.modeState.shootT = new Map<number, number>(); },
  onKill(w, v) { if (w.ball && w.ball.holder === v.id) { w.ball.holder = null; w.ball.noPickT = 0.3; } },
  tick(w) {
    const st = w.modeState as { goals: number[]; pause: number; overtime: boolean; score: Record<string, number>; prevHp?: Map<number, number>; shootT: Map<number, number> };
    const b = w.ball!;
    if (st.pause > 0) {
      st.pause -= DT;
      if (st.pause <= 0) { resetBall(w); for (const f of real(w)) { const p = baseSpawn(w, f); f.x = p.x; f.y = p.y; f.alive = true; f.hp = f.maxHp; f.statuses.clear(); f.kx = f.ky = 0; } w.events.push({ type: 'announce', text: st.overtime ? 'OVERTIME — 先取で勝利' : 'KICK OFF', big: true }); }
      return;
    }
    const prev = st.prevHp ?? new Map<number, number>();
    // holder
    if (b.holder !== null) {
      const h = real(w).find(f => f.id === b.holder);
      if (!h || !h.alive) b.holder = null;
      else {
        const lost = (prev.get(h.id) ?? h.hp) - h.hp;
        if (!canAct(h) || (lost > 0 && w.rng.next() < Math.min(0.85, 0.2 + lost / 1500))) {
          b.holder = null; b.noPickT = 0.4; const a = w.rng.next() * Math.PI * 2; b.vx = Math.cos(a) * 160; b.vy = Math.sin(a) * 160;
        } else {
          const ang = h.moving ? Math.atan2(h.lastMoveY, h.lastMoveX) : h.aim;
          b.x = h.x + Math.cos(ang) * (h.radius + BALL_R - 4); b.y = h.y + Math.sin(ang) * (h.radius + BALL_R - 4); b.vx = b.vy = 0;
          // shoot: attack press (hold to power up, release to shoot) ; pass: pass button
          const held = st.shootT.get(h.id) ?? 0;
          if (h.input.attack) st.shootT.set(h.id, held + DT);
          else if (held > 0) {
            st.shootT.set(h.id, 0);
            const power = 13 + Math.min(1, held / 0.6) * 9; // 13..22 tiles/s
            const aim = Math.hypot(h.input.aimX, h.input.aimY) > 0.01 ? Math.atan2(h.input.aimY, h.input.aimX) : (h.team === 0 ? -Math.PI / 2 : Math.PI / 2);
            kickBall(w, h, aim, power);
          }
          if (h.input.pass && !h.prevInput.pass && b.holder === h.id) {
            const aim = Math.hypot(h.input.aimX, h.input.aimY) > 0.01 ? Math.atan2(h.input.aimY, h.input.aimX) : h.facing;
            let best: Fighter | null = null, bs = -Infinity;
            for (const m of alive(w, h.team)) if (m.id !== h.id) { const a = Math.atan2(m.y - h.y, m.x - h.x); let da = Math.abs(a - aim); if (da > Math.PI) da = 2 * Math.PI - da; const s = -da * 3 - Math.hypot(m.x - h.x, m.y - h.y) / TILE * 0.1; if (s > bs) { bs = s; best = m; } }
            const ang = best ? Math.atan2(best.y - h.y, best.x - h.x) : aim;
            const dist = best ? Math.hypot(best.x - h.x, best.y - h.y) / TILE : 6;
            kickBall(w, h, ang, Math.min(16, 7 + dist * 0.9));
          }
        }
      }
    }
    if (b.holder === null) {
      b.noPickT -= DT;
      const nx = b.x + b.vx * DT, ny = b.y + b.vy * DT;
      const solid = (t: number) => t === T.WALL || t === T.CRATE;
      const hx = collides(w, nx, b.y, BALL_R, solid), hy = collides(w, b.x, ny, BALL_R, solid);
      if (hx) b.vx = -b.vx * 0.75; else b.x = nx;
      if (hy) b.vy = -b.vy * 0.75; else b.y = ny;
      b.vx *= 0.985; b.vy *= 0.985;
      if (Math.hypot(b.vx, b.vy) < 8) b.vx = b.vy = 0;
      // projectiles nudge the ball
      for (const p of w.projectiles) if (!p.dead && !p.lob && (p.x - b.x) ** 2 + (p.y - b.y) ** 2 < (BALL_R + p.r) ** 2) { b.vx += p.vx * 0.25; b.vy += p.vy * 0.25; if (!p.spec.pierce) p.dead = true; }
      // pickup
      if (b.noPickT <= 0) for (const f of real(w)) if (f.alive && canAct(f) && (f.x - b.x) ** 2 + (f.y - b.y) ** 2 < (f.radius + BALL_R + 4) ** 2) { b.holder = f.id; b.lastTeam = f.team; b.lastTouch = f.id; f.stats.objective += 1; w.events.push({ type: 'pickup', owner: f.id, kind: 'ball' }); break; }
      // goal detection: ball center inside goal tile
      const tx = Math.floor(b.x / TILE), ty = Math.floor(b.y / TILE);
      const tile = tx >= 0 && ty >= 0 && tx < w.map.w && ty < w.map.h ? w.map.tiles[ty * w.map.w + tx] : 0;
      if (tile === T.GOAL0 || tile === T.GOAL1 || b.y < TILE * 0.6 || b.y > (w.map.h - 0.6) * TILE) {
        const scoringTeam = tile === T.GOAL1 || b.y < TILE ? 0 : 1; // GOAL1 is top goal (team 1 defends) => team 0 scores
        st.goals[scoringTeam]++;
        st.score.goalsA = st.goals[0]; st.score.goalsB = st.goals[1];
        const scorer = real(w).find(f => f.id === b.lastTouch);
        if (scorer && scorer.team === scoringTeam) scorer.stats.objective += 30;
        w.events.push({ type: 'goal', team: scoringTeam, scorer: b.lastTouch });
        w.events.push({ type: 'announce', text: 'GOAL!!', big: true, color: scoringTeam === w.cfg.playerTeam ? '#4fc3ff' : '#ff4d6d' });
        b.vx = b.vy = 0; b.x = -9999; b.holder = null;
        if (st.goals[scoringTeam] >= 2 || st.overtime) { finishMatch(w, scoringTeam === 0 ? [0, 1] : [1, 0], st.overtime ? '延長戦ゴール' : '2点先取'); return; }
        st.pause = 3; return;
      }
    }
    const m = new Map<number, number>(); for (const f of real(w)) m.set(f.id, f.hp); st.prevHp = m;
    if (timer(w)) {
      if (st.goals[0] !== st.goals[1]) { finishMatch(w, st.goals[0] > st.goals[1] ? [0, 1] : [1, 0], '時間切れ'); return; }
      if (!st.overtime) { st.overtime = true; w.modeState.roundStart = w.time - (w.cfg.mode.duration - 90); st.pause = 2.5; w.events.push({ type: 'announce', text: '同点！延長戦へ', big: true }); return; }
      finishMatch(w, [0, 1], '延長戦も決着せず', [0, 1]);
    }
  },
  canRespawn: () => true, spawnPoint: baseSpawn,
  hud(w) { const st = w.modeState as { goals: number[]; overtime: boolean }; const p = w.cfg.playerTeam; return { title: 'KILL & GOAL', left: `${st.goals[p]}`, right: `${st.goals[1 - p]}`, center: (st.overtime ? 'OT ' : '') + fmt(w.timeLeft), teamScores: st.goals }; },
};

const RULES: Record<ModeId, () => ModeRules> = {
  ffa: () => ffa, tdm: () => tdm, duel: () => roundRules('DUEL', 2), boss: () => boss,
  'br-solo': () => br, 'br-duo': () => br, 'br-trio': () => br, 'br-mega': () => br,
  gem: () => gem, deathmatch: () => roundRules('DEATHMATCH', 2), vault: () => vault, territory: () => territory, goal: () => goalMode,
};
export function rulesFor(id: ModeId): ModeRules { return RULES[id](); }
export type { HudInfo, Structure };
