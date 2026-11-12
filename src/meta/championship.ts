import { Rng } from '../core/rng';
import { CHAMPIONSHIP_MODES, getMode, type ModeId } from '../data/modes';
import { CHARACTERS } from '../data/characters';
import { champRank } from '../data/backgrounds';
import { makeProfile, rollPersonality, CPU_RANKS, type CpuProfile, type CpuRank } from '../ai/profile';

/** Rating-based CPU rank for championship (uses championship rating only, never normal skill rating). */
export function champCpuRank(rng: Rng, rating: number): CpuRank {
  const band = champRank(rating).band; // 0..8
  const center = Math.min(7, Math.round(band * 0.8));
  const idx = Math.max(0, Math.min(7, center + rng.int(-1, 1)));
  return CPU_RANKS[idx];
}

/** Uniform mode pick, then map pick, avoiding the most recent maps. */
export function pickModeAndMap(rng: Rng, recentMaps: string[]): { mode: ModeId; map: string } {
  const mode = rng.pick(CHAMPIONSHIP_MODES);
  const maps = getMode(mode).maps;
  const fresh = maps.filter(m => !recentMaps.slice(0, 2).includes(m));
  return { mode, map: rng.pick(fresh.length ? fresh : maps) };
}

export interface DraftState {
  mode: ModeId; map: string; phase: 'ban' | 'pick' | 'done'; turn: number; timer: number;
  bans: number[]; picks: { team: number; slot: number; charId: number | null; isPlayer: boolean; cpu?: CpuProfile }[];
  order: { team: number; slot: number }[]; banOrder: number[]; // team per ban turn
}
export const BAN_TIME = 15, PICK_TIME = 20;

export function newDraft(rng: Rng, mode: ModeId, map: string, rating: number): DraftState {
  const picks: DraftState['picks'] = [];
  for (const team of [0, 1]) for (let slot = 0; slot < 3; slot++) {
    const isPlayer = team === 0 && slot === 0;
    picks.push({ team, slot, charId: null, isPlayer, cpu: isPlayer ? undefined : makeProfile(rng, champCpuRank(rng, rating), rollPersonality(rng)) });
  }
  // 1-2-2-1 snake pick order
  const order = [{ team: 0, slot: 0 }, { team: 1, slot: 0 }, { team: 1, slot: 1 }, { team: 0, slot: 1 }, { team: 0, slot: 2 }, { team: 1, slot: 2 }];
  return { mode, map, phase: 'ban', turn: 0, timer: BAN_TIME, bans: [], picks, order, banOrder: [0, 1, 0, 1] };
}
export function available(d: DraftState, pool: number[]): number[] {
  const taken = new Set([...d.bans, ...d.picks.map(p => p.charId).filter((x): x is number => x !== null)]);
  return pool.filter(id => !taken.has(id));
}
/** CPU choice: prefers complete kits & role diversity. */
export function cpuChoose(rng: Rng, d: DraftState, pool: number[], forBan: boolean): number {
  const av = available(d, pool);
  const complete = av.filter(id => CHARACTERS[id - 1].status === 'complete');
  if (forBan) return rng.pick(complete.length ? complete : av);
  return rng.pick(complete.length && rng.chance(0.6) ? complete : av);
}
export function draftBan(d: DraftState, charId: number): boolean {
  if (d.phase !== 'ban' || d.bans.includes(charId)) return false;
  d.bans.push(charId); d.turn++; d.timer = BAN_TIME;
  if (d.bans.length >= 4) { d.phase = 'pick'; d.turn = 0; d.timer = PICK_TIME; }
  return true;
}
export function draftPick(d: DraftState, charId: number, pool: number[]): boolean {
  if (d.phase !== 'pick') return false;
  if (!available(d, pool).includes(charId)) return false;
  const o = d.order[d.turn]; const p = d.picks.find(x => x.team === o.team && x.slot === o.slot)!;
  if (p.charId !== null) return false; // no changes after locking
  p.charId = charId; d.turn++; d.timer = PICK_TIME;
  if (d.turn >= d.order.length) d.phase = 'done';
  return true;
}
export function currentActor(d: DraftState): { team: number; isPlayer: boolean } {
  if (d.phase === 'ban') return { team: d.banOrder[d.turn], isPlayer: d.banOrder[d.turn] === 0 && d.turn === 0 };
  if (d.phase === 'pick') { const o = d.order[d.turn]; const p = d.picks.find(x => x.team === o.team && x.slot === o.slot)!; return { team: o.team, isPlayer: p.isPlayer }; }
  return { team: -1, isPlayer: false };
}
