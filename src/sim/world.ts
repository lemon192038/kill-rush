import { DT, TILE } from '../core/constants';
import { Rng } from '../core/rng';
import { getChar } from '../data/characters';
import { loadMap, T } from '../data/maps';
import { TICK_RATE } from '../core/constants';
import { setCloneFactory, updateProjectiles, updateStructures, updateZones } from './abilities';
import { createFighter, isHidden, respawnFighter, updateFighter } from './fighter';
import { rulesFor } from './modes';
import type { Fighter, MatchConfig, MatchResult, World } from './types';
import { updateBrain, updateCloneBrain } from '../ai/brain';
import { has } from './combat';

export function createWorld(cfg: MatchConfig): World {
  const map = loadMap(cfg.mapId);
  const w: World = {
    cfg, rng: new Rng(cfg.seed), map, time: 0, tick: 0, fighters: [], projectiles: [], zones: [], structures: [], tempWalls: [], pickups: [],
    ball: null, events: [], feed: [], scheduled: [], nextId: 1, timeLeft: cfg.mode.duration, over: null, overT: 0, modeState: {},
    visibility: [], revealZones: [], storm: null, paused: false, ultZoomT: 0,
    rules: rulesFor(cfg.mode.id),
  };
  for (const r of cfg.roster) {
    const f = createFighter(w, getChar(r.charId), r.team, { skinId: r.skinId, name: r.name, title: r.title, bg: r.bg, isPlayer: r.isPlayer, cpu: r.cpu, gears: r.gears });
    f.revealedFor = new Array(cfg.mode.teams).fill(0);
    w.fighters.push(f);
  }
  w.rules.init(w);
  for (const f of w.fighters) if (f.x === 0 && f.y === 0) { const p = w.rules.spawnPoint(w, f); f.x = p.x; f.y = p.y; f.facing = f.aim = Math.atan2(w.map.h * TILE / 2 - f.y, w.map.w * TILE / 2 - f.x); }
  computeVisibility(w);
  return w;
}

setCloneFactory((w, f) => {
  const c = createFighter(w, f.char, f.team, { skinId: f.skinId, name: f.name, title: f.title, bg: f.bg, isPlayer: false, cpu: null, gears: [] });
  c.revealedFor = new Array(w.cfg.mode.teams).fill(0);
  c.spawnProtectT = 0; c.ult = 0; c.facing = f.facing;
  return c;
});

export function teamCount(w: World) { return w.cfg.mode.teams; }

export function computeVisibility(w: World) {
  const teams = teamCount(w);
  if (w.visibility.length !== teams) w.visibility = Array.from({ length: teams }, () => new Uint8Array(0));
  for (let t = 0; t < teams; t++) {
    if (w.visibility[t].length !== w.fighters.length) w.visibility[t] = new Uint8Array(w.fighters.length);
    const vis = w.visibility[t];
    for (let i = 0; i < w.fighters.length; i++) {
      const f = w.fighters[i];
      if (!f.alive) { vis[i] = 0; continue; }
      if (f.team === t) { vis[i] = 1; continue; }
      vis[i] = isVisibleTo(w, f, t) ? 1 : 0;
    }
  }
}

export function isVisibleTo(w: World, f: Fighter, team: number): boolean {
  const invis = has(f, 'invis');
  if (!isHidden(f)) return true;
  if (!invis && (f.revealedFor[team] ?? 0) > 0) return true;
  for (const z of w.revealZones) if (z.team === team && !invis && (f.x - z.x) ** 2 + (f.y - z.y) ** 2 < (z.r + f.radius) ** 2) return true;
  const near = invis ? TILE * 1.1 : TILE * 2;
  const sameBush = TILE * 3;
  for (const v of w.fighters) {
    if (!v.alive || v.team !== team) continue;
    const d2 = (v.x - f.x) ** 2 + (v.y - f.y) ** 2;
    if (d2 < near * near) return true;
    if (!invis && v.inBush && f.inBush && d2 < sameBush * sameBush && sameBushCluster(w, v, f)) return true;
  }
  return false;
}

function sameBushCluster(w: World, a: Fighter, b: Fighter): boolean {
  // walk straight line; all tiles must be bush
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (TILE / 2));
  for (let i = 0; i <= n; i++) {
    const x = a.x + ((b.x - a.x) * i) / Math.max(1, n), y = a.y + ((b.y - a.y) * i) / Math.max(1, n);
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (w.map.tiles[ty * w.map.w + tx] !== T.BUSH) return false;
  }
  return true;
}

export function stepWorld(w: World) {
  if (w.paused) return;
  if (w.over) { w.overT += DT; return; }
  w.tick++; w.time = w.tick / TICK_RATE;
  // scheduled actions
  if (w.scheduled.length) {
    const due = w.scheduled.filter(s => s.at <= w.tick);
    if (due.length) { w.scheduled = w.scheduled.filter(s => s.at > w.tick); for (const s of due) s.run(); }
  }
  for (const f of w.fighters) {
    if (!f.alive) continue;
    if (f.cpu) updateBrain(w, f);
    else if (f.cloneOf !== null) updateCloneBrain(w, f);
  }
  for (const f of w.fighters) updateFighter(w, f);
  updateProjectiles(w, DT);
  updateZones(w, DT);
  updateStructures(w, DT);
  for (const tw of w.tempWalls) {
    tw.t -= DT;
    if (tw.t <= 0) for (const i of tw.tiles) if (w.map.tiles[i] === T.CRATE) w.map.tiles[i] = T.FLOOR;
  }
  w.tempWalls = w.tempWalls.filter(t => t.t > 0);
  for (const z of w.revealZones) z.t -= DT;
  w.revealZones = w.revealZones.filter(z => z.t > 0);
  w.ultZoomT = Math.max(0, w.ultZoomT - DT);
  w.rules.tick(w);
  // respawns
  for (const f of w.fighters) {
    if (f.alive || f.cloneOf !== null) continue;
    if (f.respawnT > 0) { f.respawnT -= DT; if (f.respawnT <= 0 && w.rules.canRespawn(w, f)) respawnFighter(w, f); }
  }
  if (w.tick % 120 === 0) w.fighters = w.fighters.filter(f => f.cloneOf === null || f.alive);
  computeVisibility(w);
  for (const f of w.fighters) f.prevInput = { ...f.input };
}

export function mvpScore(f: Fighter): number {
  const s = f.stats;
  return s.kills * 3 + s.assists * 1.5 - s.deaths * 1 + s.damage / 1500 + s.healing / 1200 + s.objective / 800 + s.protect / 1500;
}

/** Finish match. ranking: array of team ids from best to worst. */
export function finishMatch(w: World, ranking: number[], reason: string, drawTeams: number[] = []) {
  if (w.over) return;
  const pt = w.cfg.playerTeam;
  const placement = ranking.indexOf(pt) + 1;
  const total = ranking.length;
  let outcome: MatchResult['outcome'];
  if (drawTeams.includes(pt)) outcome = 'draw';
  else if (total <= 2) outcome = placement === 1 ? 'win' : 'loss';
  else {
    const winCut = w.cfg.mode.id === 'ffa' ? 2 : Math.max(1, Math.round(total * 0.4));
    const lossCut = w.cfg.mode.id === 'ffa' ? 4 : total - Math.max(1, Math.round(total * 0.4));
    outcome = placement <= winCut ? 'win' : placement > lossCut ? 'loss' : 'draw';
  }
  const real = w.fighters.filter(f => f.cloneOf === null && !f.isBoss);
  const mvp = real.reduce((a, b) => (mvpScore(b) > mvpScore(a) ? b : a), real[0]);
  const player = w.fighters.find(f => f.isPlayer) ?? real[0];
  w.over = {
    winnerTeam: drawTeams.length >= 2 && drawTeams.includes(ranking[0]) ? null : ranking[0], outcome, playerTeam: pt, placement, totalTeams: total,
    durationSec: w.time, stats: { ...player.stats }, mvpId: mvp.id, modeScore: (w.modeState.score as Record<string, number>) ?? {}, reason,
    perFighter: real.map(f => ({ id: f.id, name: f.name, team: f.team, charKey: f.char.key, stats: { ...f.stats }, isPlayer: f.isPlayer, cpuRank: f.cpu?.rank })),
  };
  w.events.push({ type: 'announce', text: outcome === 'win' ? 'VICTORY' : outcome === 'loss' ? 'DEFEAT' : 'DRAW', big: true, color: outcome === 'win' ? '#ffd23f' : outcome === 'loss' ? '#ff4d6d' : '#cccccc' });
}
