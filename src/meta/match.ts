import { Rng } from '../core/rng';
import { CHARACTERS, getChar } from '../data/characters';
import { getMode, type ModeId } from '../data/modes';
import { defaultSkinId, skinsFor } from '../data/skins';
import { BACKGROUNDS, TITLES } from '../data/backgrounds';
import type { GearKey } from '../data/gears';
import { assignCpus, targetRating } from '../ai/matchmaking';
import { makeProfile, rollPersonality, type CpuProfile } from '../ai/profile';
import type { MatchConfig } from '../sim/types';
import type { SaveData } from './save';

const NAME_A = ['Kai', 'Mio', 'Ren', 'Yuna', 'Sora', 'Haru', 'Nico', 'Rio', 'Aki', 'Luna', 'Taro', 'Emi', 'Jin', 'Noa', 'Ryo', 'Sena', 'Toma', 'Lia', 'Zen', 'Momo', 'Vex', 'Dax', 'Ivy', 'Rex', 'Nyx', 'Ash', 'Bo', 'Cy', 'Fen', 'Gus'];
const NAME_B = ['', '_X', '99', 'Pro', 'ZZ', '7', 'Rush', 'Jr', '_K', 'Ace', '01', 'GG', 'xD', '_ttv', '42', 'Kun'];
export function cpuName(rng: Rng): string { return rng.pick(NAME_A) + rng.pick(NAME_B); }

export interface BuiltMatch { cfg: MatchConfig; target: number; oppRating: number; matchId: string }

/** Chars a CPU may use: complete kits are favoured so matches feel polished, prototypes appear too. */
function cpuCharPool(rng: Rng, exclude: Set<number>): number {
  const complete = CHARACTERS.filter(c => c.status === 'complete' && !exclude.has(c.id));
  const any = CHARACTERS.filter(c => !exclude.has(c.id));
  return (rng.chance(0.55) && complete.length ? rng.pick(complete) : rng.pick(any)).id;
}
function cpuSkin(rng: Rng, charId: number): string { const s = skinsFor(charId); return rng.chance(0.6) ? defaultSkinId(charId) : rng.pick(s).id; }
function cpuGears(rng: Rng): GearKey[] { const all: GearKey[] = ['DAMAGE', 'HEALTH', 'VISION', 'SHIELD', 'SPEED', 'COOLDOWN', 'UNIQUE']; return rng.chance(0.5) ? rng.shuffle(all.slice()).slice(0, rng.int(0, 2)) : []; }

export function buildMatch(s: SaveData, modeId: ModeId, opts: { mapId?: string; seed?: number; championship?: boolean; practice?: boolean; picks?: { team: number; charId: number; isPlayer: boolean; cpu?: CpuProfile }[] } = {}): BuiltMatch {
  const mode = getMode(modeId);
  const seed = opts.seed ?? ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  const rng = new Rng(seed);
  const mapId = opts.mapId ?? rng.pick(mode.maps);
  const charId = s.selectedChar;
  const target = targetRating(s.skill, s.charSkill[charId]);
  const roster: MatchConfig['roster'] = [];
  const used = new Set<number>([charId]);
  const playerTeam = 0;
  const gearsOf = (c: number) => (s.equippedGears[c] ?? []).filter(g => s.ownedGears.includes(`${c}:${g}`));
  if (opts.picks) {
    for (const p of opts.picks) {
      if (p.isPlayer) roster.push({ charId: p.charId, skinId: s.equippedSkin[p.charId] ?? defaultSkinId(p.charId), name: s.profile.name, title: s.profile.title, bg: s.profile.bg, team: p.team, isPlayer: true, cpu: null, gears: gearsOf(p.charId) });
      else roster.push({ charId: p.charId, skinId: cpuSkin(rng, p.charId), name: cpuName(rng), title: rng.pick(TITLES), bg: rng.pick(BACKGROUNDS.filter(b => b.category === 'collection')).id, team: p.team, isPlayer: false, cpu: p.cpu ?? makeProfile(rng, 'NORMAL', rollPersonality(rng)), gears: cpuGears(rng) });
    }
  } else {
    const total = mode.teams * mode.teamSize;
    const cpus = assignCpus(rng, total - 1, opts.practice ? 300 : target, modeId);
    roster.push({ charId, skinId: s.equippedSkin[charId] ?? defaultSkinId(charId), name: s.profile.name, title: s.profile.title, bg: s.profile.bg, team: playerTeam, isPlayer: true, cpu: null, gears: gearsOf(charId) });
    let ci = 0;
    for (let t = 0; t < mode.teams; t++) for (let k = 0; k < mode.teamSize; k++) {
      if (t === playerTeam && k === 0) continue;
      const cid = modeId === 'boss' && t === 1 ? 31 : cpuCharPool(rng, used); used.add(cid);
      roster.push({ charId: cid, skinId: cpuSkin(rng, cid), name: cpuName(rng), title: rng.pick(TITLES), bg: rng.pick(BACKGROUNDS.filter(b => b.category === 'collection')).id, team: t, isPlayer: false, cpu: cpus[ci++], gears: cpuGears(rng) });
    }
    if (modeId === 'boss') { const boss = roster.find(r => r.team === 1); if (boss && boss.cpu) boss.cpu = makeProfile(rng, 'EXPERT', 'BERSERKER'); }
  }
  const enemies = roster.filter(r => r.team !== playerTeam && r.cpu);
  const oppRating = enemies.length ? enemies.reduce((a, r) => a + (r.cpu?.rating ?? 900), 0) / enemies.length : 900;
  const matchId = `${seed.toString(36)}-${Date.now().toString(36)}`;
  if (!opts.championship && !opts.practice) {
    s.cpuAssignments.unshift({ t: Date.now(), mode: modeId, char: charId, target: Math.round(target), ranks: roster.filter(r => r.cpu).map(r => r.cpu!.rank) });
    if (s.cpuAssignments.length > 30) s.cpuAssignments.length = 30;
  }
  void getChar;
  return { cfg: { mode, mapId, seed, playerTeam, roster, championship: !!opts.championship, practice: opts.practice }, target, oppRating, matchId };
}
