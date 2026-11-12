import { Rng } from '../core/rng';
import type { ModeId } from '../data/modes';
import type { FighterStats } from '../sim/types';
import { CPU_RANKS, RANK_BASE_DIST, RANK_RATING, makeProfile, rollPersonality, type CpuProfile, type CpuRank } from './profile';

/** Persistent skill model (separate from championship rating). */
export interface SkillRecord {
  rating: number; games: number; wins: number; losses: number; draws: number;
  recent: ('W' | 'L' | 'D')[]; streak: number; form: number; // EMA of (actual - expected)
  sum: { kills: number; deaths: number; assists: number; damage: number; taken: number; survival: number; contribution: number; maxCombo: number };
  byMode: Record<string, { g: number; w: number }>;
  vsCpu: { g: number; w: number; oppSum: number };
}
export interface CharSkill { rating: number; games: number; wins: number; losses: number; pt: number; sum: SkillRecord['sum'] }

export const SKILL_PRIOR = 550;
export const newSkill = (): SkillRecord => ({ rating: SKILL_PRIOR, games: 0, wins: 0, losses: 0, draws: 0, recent: [], streak: 0, form: 0, sum: { kills: 0, deaths: 0, assists: 0, damage: 0, taken: 0, survival: 0, contribution: 0, maxCombo: 0 }, byMode: {}, vsCpu: { g: 0, w: 0, oppSum: 0 } });
export const newCharSkill = (): CharSkill => ({ rating: SKILL_PRIOR, games: 0, wins: 0, losses: 0, pt: 0, sum: { kills: 0, deaths: 0, assists: 0, damage: 0, taken: 0, survival: 0, contribution: 0, maxCombo: 0 } });

/** Weighting (spec initial values). */
export const MM_WEIGHTS = { overall: 0.6, character: 0.25, recent: 0.15, charFloor: 250, charCeil: 200, sigma: 260, overallConfGames: 20, charConfGames: 10, targetCap: 2250 };

export function overallEstimate(s: SkillRecord): number {
  const conf = Math.min(1, s.games / MM_WEIGHTS.overallConfGames);
  return SKILL_PRIOR * (1 - conf) + s.rating * conf;
}
export function charEstimate(s: SkillRecord, c: CharSkill | undefined): number {
  const overall = overallEstimate(s);
  const fresh = overall - 150; // unfamiliar character starts a bit below overall
  if (!c || c.games === 0) return Math.max(overall - MM_WEIGHTS.charFloor, fresh);
  const conf = Math.min(1, c.games / MM_WEIGHTS.charConfGames);
  const ptBonus = Math.min(100, c.pt / 10);
  const est = fresh * (1 - conf) + (c.rating + ptBonus) * conf;
  // Floor/ceiling around overall: prevents smurfing with a new character and sudden spikes
  return Math.max(overall - MM_WEIGHTS.charFloor, Math.min(overall + MM_WEIGHTS.charCeil, est));
}
export function targetRating(s: SkillRecord, c: CharSkill | undefined): number {
  const overall = overallEstimate(s);
  const ch = charEstimate(s, c);
  const recent = overall + Math.max(-1, Math.min(1, s.form)) * 150;
  const t = MM_WEIGHTS.overall * overall + MM_WEIGHTS.character * ch + MM_WEIGHTS.recent * recent;
  return Math.max(overall - 200, Math.min(overall + 200, t));
}

/** Rank weights centred on the target rating, keeping some natural spread. */
export function rankWeights(rawTarget: number, mode?: ModeId): number[] {
  const target = Math.min(MM_WEIGHTS.targetCap, rawTarget); // prevents all-PRODIGY lobbies from win rate alone
  const sigma = MM_WEIGHTS.sigma * (mode && mode.startsWith('br') ? 1.25 : 1);
  return CPU_RANKS.map(r => {
    let wgt = Math.pow(RANK_BASE_DIST[r], 0.6) * Math.exp(-((RANK_RATING[r] - target) ** 2) / (2 * sigma * sigma));
    if (r === 'GENIUS' && target < 1500) wgt = 0;
    if (r === 'PRODIGY' && target < 1800) wgt = 0;
    return wgt;
  });
}
export function rankDistribution(target: number, mode?: ModeId): Record<CpuRank, number> {
  const ws = rankWeights(target, mode); const tot = ws.reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(CPU_RANKS.map((r, i) => [r, ws[i] / tot])) as Record<CpuRank, number>;
}
export function assignCpus(rng: Rng, count: number, target: number, mode?: ModeId): CpuProfile[] {
  const ws = rankWeights(target, mode);
  const out: CpuProfile[] = [];
  for (let i = 0; i < count; i++) out.push(makeProfile(rng, rng.weighted(CPU_RANKS, ws), rollPersonality(rng)));
  return out;
}
export function estimatedDifficulty(target: number): CpuRank {
  const d = rankDistribution(target);
  return CPU_RANKS.reduce((a, b) => (d[b] > d[a] ? b : a), 'ROOKIE' as CpuRank);
}

/** Mode-aware contribution score (not just kills; kill farming has diminishing returns). */
export function contribution(mode: ModeId, s: FighterStats): number {
  const kills = 1.2 * Math.min(s.kills, 5) + 0.4 * Math.max(0, s.kills - 5);
  let obj = 0;
  switch (mode) {
    case 'gem': obj = s.objective * 1.2; break;
    case 'vault': obj = s.objective / 1500; break;
    case 'territory': obj = s.objective / 8; break;
    case 'goal': obj = s.objective / 4; break;
    case 'br-solo': case 'br-duo': case 'br-trio': case 'br-mega': obj = s.objective * 0.8 + s.survival / 40; break;
    case 'boss': obj = s.objective / 3000; break;
    default: obj = 0;
  }
  return kills + s.assists * 0.8 + s.damage / 1200 + s.healing / 1000 + s.protect / 1200 + obj + s.defense / 25 + s.survival / 120 - s.deaths * 0.5;
}

export interface RatingUpdate { before: number; after: number; delta: number; expected: number; actual: number }
export function updateSkill(s: SkillRecord, c: CharSkill, mode: ModeId, outcome: 'win' | 'loss' | 'draw', stats: FighterStats, oppRating: number, perfIndex: number): { overall: RatingUpdate; char: RatingUpdate } {
  const res = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
  const actual = res * 0.65 + Math.max(0, Math.min(1, perfIndex)) * 0.35;
  const upd = (rating: number, games: number, Kmax: number, Kmin: number, conf: number): RatingUpdate => {
    const expected = 1 / (1 + Math.pow(10, (oppRating - rating) / 400));
    const K = Kmax - (Kmax - Kmin) * Math.min(1, games / conf);
    let delta = K * (actual - expected);
    if (Math.abs(s.streak) >= 3) delta *= 0.8; // damp streak spikes
    delta = Math.max(-40, Math.min(40, delta));
    return { before: rating, after: Math.max(0, rating + delta), delta, expected, actual };
  };
  const o = upd(s.rating, s.games, 60, 24, 30);
  const ch = upd(c.rating, c.games, 70, 28, 15);
  s.rating = o.after; c.rating = ch.after;
  s.form = s.form * 0.8 + (actual - o.expected) * 2 * 0.2;
  s.games++; c.games++;
  if (outcome === 'win') { s.wins++; c.wins++; s.streak = s.streak >= 0 ? s.streak + 1 : 1; }
  else if (outcome === 'loss') { s.losses++; c.losses++; s.streak = s.streak <= 0 ? s.streak - 1 : -1; }
  else { s.draws++; s.streak = 0; }
  s.recent.push(outcome === 'win' ? 'W' : outcome === 'loss' ? 'L' : 'D'); if (s.recent.length > 20) s.recent.shift();
  const cs = contribution(mode, stats);
  for (const sum of [s.sum, c.sum]) { sum.kills += stats.kills; sum.deaths += stats.deaths; sum.assists += stats.assists; sum.damage += stats.damage; sum.taken += stats.taken; sum.survival += stats.survival; sum.contribution += cs; sum.maxCombo = Math.max(sum.maxCombo, stats.maxCombo); }
  const bm = (s.byMode[mode] ??= { g: 0, w: 0 }); bm.g++; if (outcome === 'win') bm.w++;
  s.vsCpu.g++; if (outcome === 'win') s.vsCpu.w++; s.vsCpu.oppSum += oppRating;
  return { overall: o, char: ch };
}
