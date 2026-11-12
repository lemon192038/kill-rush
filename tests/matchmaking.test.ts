import { describe, it, expect } from 'vitest';
import { newSkill, newCharSkill, targetRating, rankDistribution, assignCpus, updateSkill, charEstimate, overallEstimate } from '../src/ai/matchmaking';
import { Rng } from '../src/core/rng';
import { CPU_RANKS, makeProfile, PERSONALITIES, RANK_RATING } from '../src/ai/profile';
import type { FighterStats } from '../src/sim/types';
import { buildMatch } from '../src/meta/match';
import { defaultSave } from '../src/meta/save';

const st: FighterStats = { kills: 3, deaths: 2, assists: 1, damage: 9000, taken: 7000, healing: 0, objective: 0, maxStreak: 2, streak: 0, maxCombo: 3, survival: 120, protect: 0, defense: 0 };
const mean = (d: Record<string, number>) => CPU_RANKS.reduce((a, r, i) => a + d[r] * i, 0);

function expert() { const s = newSkill(); s.rating = 1900; s.games = 200; s.wins = 140; s.losses = 60; return s; }

describe('player-skill-based CPU assignment', () => {
  it('beginners get ROOKIE-NORMAL, experts get higher ranks', () => {
    const b = rankDistribution(targetRating(newSkill(), undefined));
    const e = rankDistribution(targetRating(expert(), newCharSkill()));
    expect(b.ROOKIE + b.CASUAL + b.NORMAL).toBeGreaterThan(0.85);
    expect(mean(e)).toBeGreaterThan(mean(b) + 2);
    expect(e.GENIUS + e.PRODIGY).toBeGreaterThan(0);
    expect(b.GENIUS + b.PRODIGY).toBe(0);
  });
  it('character mastery shifts assignment, but an expert on a new character is floored', () => {
    const s = expert();
    const mastered = { ...newCharSkill(), rating: 2100, games: 80, pt: 800 };
    const tNew = targetRating(s, undefined), tMain = targetRating(s, mastered);
    expect(tMain).toBeGreaterThan(tNew);
    expect(tNew).toBeGreaterThanOrEqual(overallEstimate(s) - 200); // no smurf hole
    expect(charEstimate(s, undefined)).toBeGreaterThanOrEqual(overallEstimate(s) - 250);
  });
  it('few games => prior dominates (no extreme assignment from a lucky streak)', () => {
    const s = newSkill(); s.rating = 2400; s.games = 3; s.wins = 3; s.form = 1;
    const d = rankDistribution(targetRating(s, undefined));
    expect(d.GENIUS + d.PRODIGY).toBe(0);
    expect(d.MASTER).toBeLessThan(0.05);
  });
  it('high win-rate does not produce all-max CPUs; spread remains', () => {
    const s = expert(); s.rating = 2600; s.games = 500;
    const d = rankDistribution(targetRating(s, { ...newCharSkill(), rating: 2600, games: 200 }));
    expect(d.PRODIGY).toBeLessThan(0.5);
    expect(Object.values(d).filter(v => v > 0.05).length).toBeGreaterThanOrEqual(3);
  });
  it('rating updates are bounded and damped (no sudden jumps)', () => {
    const s = newSkill(), c = newCharSkill();
    for (let i = 0; i < 6; i++) { const u = updateSkill(s, c, 'tdm', 'win', st, 900, 0.9); expect(Math.abs(u.overall.delta)).toBeLessThanOrEqual(40); }
    expect(s.rating).toBeLessThan(550 + 6 * 40 + 1);
    expect(s.recent).toHaveLength(6); expect(s.streak).toBe(6);
  });
  it('per-character records are separate', () => {
    const s = defaultSave(); s.charSkill[1] = { ...newCharSkill(), rating: 1500, games: 40 };
    s.selectedChar = 1; const a = buildMatch(s, 'tdm', { seed: 1 }).target;
    s.selectedChar = 62; const b = buildMatch(s, 'tdm', { seed: 1 }).target;
    expect(a).not.toBe(b);
  });
  it('assignment uses existing 8 ranks x 20 personalities, independent', () => {
    const cpus = assignCpus(new Rng(9), 400, 900);
    expect(new Set(cpus.map(c => c.personality)).size).toBe(PERSONALITIES.length);
    expect(new Set(cpus.map(c => c.rank)).size).toBeGreaterThanOrEqual(4);
  });
  it('higher ranks raise ability stats, not HP/damage; personalities create weaknesses', () => {
    const rng = new Rng(1);
    const lo = makeProfile(rng, 'ROOKIE', 'STEADY'), hi = makeProfile(rng, 'GENIUS', 'STEADY');
    expect(hi.stats.control).toBeGreaterThan(lo.stats.control);
    expect('hp' in hi).toBe(false);
    const be = makeProfile(new Rng(2), 'MASTER', 'BEGINNER'), vet = makeProfile(new Rng(2), 'MASTER', 'VETERAN');
    expect(be.stats.combo).toBeLessThan(vet.stats.combo);
    expect(RANK_RATING.PRODIGY).toBeGreaterThan(RANK_RATING.ROOKIE);
  });
  it('match records CPU assignment and championship rating is not used', () => {
    const s = defaultSave(); s.championship.current.rating = 8000;
    const m = buildMatch(s, 'ffa', { seed: 4 });
    expect(m.target).toBeLessThan(900);
    expect(s.cpuAssignments[0].ranks).toHaveLength(5);
  });
});
