import { ECONOMY } from '../data/config';
import type { ModeId } from '../data/modes';
import { BAND_NAMES, champRank } from '../data/backgrounds';
import { contribution, newCharSkill, updateSkill } from '../ai/matchmaking';
import type { MatchResult } from '../sim/types';
import type { SaveData } from './save';
import { grantPtBackgrounds } from './economy';

export interface NormalRewardSummary { kind: 'normal'; ptDelta: number; charPtDelta: number; victoryRight: number; newBackgrounds: string[]; ratingDelta: number; charRatingDelta: number }
export interface ChampRewardSummary { kind: 'championship'; ratingBefore: number; ratingAfter: number; delta: number; rankBefore: string; rankAfter: string; newBackgrounds: string[]; contribution: number }

export function perfIndex(mode: ModeId, r: MatchResult): number {
  const mine = r.perFighter.find(f => f.isPlayer);
  if (!mine) return 0.5;
  const all = r.perFighter.map(f => contribution(mode, f.stats));
  const avg = all.reduce((a, b) => a + b, 0) / Math.max(1, all.length);
  const me = contribution(mode, mine.stats);
  return Math.max(0, Math.min(1, 0.5 + (me - avg) / (2 * Math.max(2, Math.abs(avg)))));
}

/** Normal match rewards. MUST NOT be called for championship matches. Idempotent via matchId. */
export function applyNormalRewards(s: SaveData, matchId: string, mode: ModeId, mapId: string, charId: number, r: MatchResult, oppRating: number): NormalRewardSummary | null {
  if (s.processedMatches.includes(matchId)) return null;
  s.processedMatches.push(matchId);
  const E = ECONOMY.normalPt;
  let ptDelta = r.outcome === 'win' ? E.win + (r.placement === 1 && r.totalTeams > 2 ? E.firstPlaceBonus : 0) : r.outcome === 'loss' ? E.loss : E.draw;
  const charPt = s.charPt[charId] ?? 0;
  if (ptDelta < 0) ptDelta = -Math.min(-ptDelta, charPt); // character PT cannot go negative
  s.charPt[charId] = charPt + ptDelta;
  s.pt = Math.max(0, s.pt + ptDelta);
  if (ptDelta > 0) s.cumulativePt += ptDelta; // cumulative never decreases
  let victoryRight = 0;
  if (r.outcome === 'win') { s.victoryRights += 1; victoryRight = 1; }
  const newBackgrounds = grantPtBackgrounds(s);
  // skill model update (normal matches only)
  const cs = (s.charSkill[charId] ??= newCharSkill());
  const up = updateSkill(s.skill, cs, mode, r.outcome, r.stats, oppRating, perfIndex(mode, r));
  cs.pt = s.charPt[charId];
  s.stats.matches++; if (r.outcome === 'win') s.stats.wins++;
  const bm = (s.stats.byMode[mode] ??= { g: 0, w: 0 }); bm.g++; if (r.outcome === 'win') bm.w++;
  s.history.unshift({ t: Date.now(), mode, map: mapId, char: charId, outcome: r.outcome, kills: r.stats.kills, deaths: r.stats.deaths, ptDelta, champ: false });
  if (s.history.length > 50) s.history.length = 50;
  s.profile.xp += 20 + r.stats.kills * 2 + (r.outcome === 'win' ? 20 : 0);
  while (s.profile.xp >= levelXp(s.profile.level)) { s.profile.xp -= levelXp(s.profile.level); s.profile.level++; }
  return { kind: 'normal', ptDelta, charPtDelta: ptDelta, victoryRight, newBackgrounds, ratingDelta: up.overall.delta, charRatingDelta: up.char.delta };
}
export const levelXp = (lv: number) => 100 + lv * 25;

/** Championship rating change: win +60..+100 (avg +80), loss -15..-45 (avg -30), draw 0. */
export function champDelta(outcome: 'win' | 'loss' | 'draw', perf: number): number {
  const p = Math.max(0, Math.min(1, perf));
  if (outcome === 'win') return Math.round(60 + 40 * p);
  if (outcome === 'loss') return -Math.round(45 - 30 * p);
  return 0;
}

/**
 * Championship result. Completely separate from normal rewards:
 * no victory box, no coins, no normal PT, no characters, no skins.
 */
export function applyChampionshipResult(s: SaveData, matchId: string, mode: ModeId, mapId: string, charId: number, r: MatchResult): ChampRewardSummary | null {
  if (s.processedMatches.includes(matchId)) return null;
  s.processedMatches.push(matchId);
  const c = s.championship.current;
  const perf = perfIndex(mode, r);
  const before = c.rating;
  const delta = champDelta(r.outcome, perf);
  c.rating = Math.max(0, c.rating + delta);
  if (r.outcome === 'win') { c.wins++; c.streak = c.streak >= 0 ? c.streak + 1 : 1; c.bestStreak = Math.max(c.bestStreak, c.streak); }
  else if (r.outcome === 'loss') { c.losses++; c.streak = c.streak <= 0 ? c.streak - 1 : -1; }
  else { c.draws++; }
  c.peak = Math.max(c.peak, c.rating);
  const newBackgrounds: string[] = [];
  const rk = champRank(c.rating);
  if (rk.index > c.peakIndex || !s.ownedBackgrounds.includes(`champ-${rk.band}`)) {
    // background for band on reaching tier I; stars on II/III (re-reaching in new seasons adds stars, max 7)
    for (let i = c.peakIndex; i <= rk.index; i++) {
      const band = Math.floor(i / 3), lvl = i % 3;
      const id = `champ-${band}`;
      if (!s.ownedBackgrounds.includes(id)) { s.ownedBackgrounds.push(id); newBackgrounds.push(`${BAND_NAMES[band]}の紋章`); }
      if (lvl > 0 && i > c.peakIndex) c.stars[band] = Math.min(7, (c.stars[band] ?? 0) + 1);
    }
    c.peakIndex = Math.max(c.peakIndex, rk.index);
  }
  c.history.unshift({ t: Date.now(), mode, map: mapId, result: r.outcome, delta, rating: c.rating });
  if (c.history.length > 50) c.history.length = 50;
  s.history.unshift({ t: Date.now(), mode, map: mapId, char: charId, outcome: r.outcome, kills: r.stats.kills, deaths: r.stats.deaths, ptDelta: 0, champ: true });
  if (s.history.length > 50) s.history.length = 50;
  return { kind: 'championship', ratingBefore: before, ratingAfter: c.rating, delta, rankBefore: champRank(before).name, rankAfter: rk.name, newBackgrounds, contribution: perf };
}

/** Single entry point used by the game loop. Championship path never touches normal rewards. */
export function applyMatchRewards(s: SaveData, o: { matchId: string; mode: ModeId; mapId: string; charId: number; championship: boolean; practice?: boolean; result: MatchResult; oppRating: number }): NormalRewardSummary | ChampRewardSummary | null {
  if (o.practice) return null;
  if (o.championship) return applyChampionshipResult(s, o.matchId, o.mode, o.mapId, o.charId, o.result);
  return applyNormalRewards(s, o.matchId, o.mode, o.mapId, o.charId, o.result, o.oppRating);
}
