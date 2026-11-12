import { describe, it, expect } from 'vitest';
import { defaultSave } from '../src/meta/save';
import { applyMatchRewards, champDelta } from '../src/meta/rewards';
import type { MatchResult, FighterStats } from '../src/sim/types';

const stats = (o: Partial<FighterStats> = {}): FighterStats => ({ kills: 2, deaths: 1, assists: 1, damage: 8000, taken: 5000, healing: 0, objective: 3, maxStreak: 2, streak: 0, maxCombo: 4, survival: 100, protect: 0, defense: 0, ...o });
const result = (outcome: 'win' | 'loss' | 'draw', s = stats()): MatchResult => ({
  winnerTeam: outcome === 'draw' ? null : outcome === 'win' ? 0 : 1, outcome, playerTeam: 0, placement: outcome === 'win' ? 1 : 2, totalTeams: 2, durationSec: 120, stats: s,
  perFighter: [{ id: 1, name: 'P', team: 0, charKey: 'SHADOW', stats: s, isPlayer: true }, { id: 2, name: 'C', team: 1, charKey: 'TITAN', stats: stats(), isPlayer: false }], mvpId: 1, modeScore: {}, reason: '',
});
const snapshot = (s: ReturnType<typeof defaultSave>) => JSON.stringify({ coins: s.coins, pt: s.pt, cum: s.cumulativePt, vr: s.victoryRights, mr: s.missionRights, chars: s.unlockedChars, skins: s.ownedSkins, credits: s.credits, charPt: s.charPt });

describe('normal match rewards', () => {
  it('win grants PT and one victory box right', () => {
    const s = defaultSave(); const vr = s.victoryRights;
    const r = applyMatchRewards(s, { matchId: 'a', mode: 'tdm', mapId: 'tdm-ruins', charId: 1, championship: false, result: result('win'), oppRating: 600 });
    expect(r?.kind).toBe('normal'); expect(s.pt).toBeGreaterThan(0); expect(s.victoryRights).toBe(vr + 1); expect(s.coins).toBe(0);
  });
  it('loss reduces PT and gives no box', () => {
    const s = defaultSave(); s.pt = 100; s.charPt[1] = 50; const vr = s.victoryRights;
    applyMatchRewards(s, { matchId: 'b', mode: 'tdm', mapId: 'x', charId: 1, championship: false, result: result('loss'), oppRating: 600 });
    expect(s.pt).toBeLessThan(100); expect(s.victoryRights).toBe(vr);
  });
  it('the same match id is never credited twice', () => {
    const s = defaultSave();
    const o = { matchId: 'dup', mode: 'tdm' as const, mapId: 'x', charId: 1, championship: false, result: result('win'), oppRating: 600 };
    applyMatchRewards(s, o); const after = snapshot(s); expect(applyMatchRewards(s, o)).toBeNull(); expect(snapshot(s)).toBe(after);
  });
  it('cumulative PT never decreases and grants PT backgrounds', () => {
    const s = defaultSave(); s.cumulativePt = 995; s.pt = 995;
    applyMatchRewards(s, { matchId: 'c', mode: 'tdm', mapId: 'x', charId: 1, championship: false, result: result('win'), oppRating: 600 });
    expect(s.ownedBackgrounds).toContain('pt-1000');
    const cum = s.cumulativePt; applyMatchRewards(s, { matchId: 'd', mode: 'tdm', mapId: 'x', charId: 1, championship: false, result: result('loss'), oppRating: 600 });
    expect(s.cumulativePt).toBe(cum); expect(s.ownedBackgrounds).toContain('pt-1000');
  });
  it('practice gives nothing', () => {
    const s = defaultSave(); const before = snapshot(s);
    expect(applyMatchRewards(s, { matchId: 'p', mode: 'ffa', mapId: 'x', charId: 1, championship: false, practice: true, result: result('win'), oppRating: 600 })).toBeNull();
    expect(snapshot(s)).toBe(before);
  });
});

describe('CHAMPIONSHIP reward isolation (must never grant normal rewards)', () => {
  for (const outcome of ['win', 'loss', 'draw'] as const) {
    for (const st of [stats(), stats({ kills: 25, assists: 15, damage: 90000, objective: 500 })]) {
      it(`${outcome} with kills=${st.kills}: no boxes/coins/PT/chars/skins`, () => {
        const s = defaultSave(); s.championship.current.rating = 500; s.pt = 300; s.cumulativePt = 300;
        const before = snapshot(s);
        const r = applyMatchRewards(s, { matchId: `ch-${outcome}-${st.kills}`, mode: 'gem', mapId: 'crystal-mine', charId: 1, championship: true, result: result(outcome, st), oppRating: 600 });
        expect(r?.kind).toBe('championship');
        expect(snapshot(s)).toBe(before);
        if (outcome === 'draw') expect(s.championship.current.rating).toBe(500);
        if (outcome === 'win') expect(s.championship.current.rating).toBeGreaterThan(500);
        if (outcome === 'loss') expect(s.championship.current.rating).toBeLessThan(500);
      });
    }
  }
  it('rating deltas stay in spec ranges', () => {
    for (let p = 0; p <= 1; p += 0.1) {
      const w = champDelta('win', p), l = champDelta('loss', p);
      expect(w).toBeGreaterThanOrEqual(60); expect(w).toBeLessThanOrEqual(100);
      expect(l).toBeGreaterThanOrEqual(-45); expect(l).toBeLessThanOrEqual(-15);
    }
    expect(champDelta('win', 0.5)).toBe(80); expect(champDelta('loss', 0.5)).toBe(-30); expect(champDelta('draw', 0.9)).toBe(0);
  });
  it('championship does not change the normal CPU skill model', () => {
    const s = defaultSave(); const r0 = s.skill.rating, g0 = s.skill.games;
    applyMatchRewards(s, { matchId: 'iso', mode: 'tdm', mapId: 'x', charId: 1, championship: true, result: result('win'), oppRating: 600 });
    expect(s.skill.rating).toBe(r0); expect(s.skill.games).toBe(g0);
  });
  it('rank background on reaching tier I, kept after demotion', () => {
    const s = defaultSave(); s.championship.current.rating = 990;
    applyMatchRewards(s, { matchId: 'up', mode: 'tdm', mapId: 'x', charId: 1, championship: true, result: result('win'), oppRating: 600 });
    expect(s.ownedBackgrounds).toContain('champ-1');
    for (let i = 0; i < 5; i++) applyMatchRewards(s, { matchId: 'dn' + i, mode: 'tdm', mapId: 'x', charId: 1, championship: true, result: result('loss'), oppRating: 600 });
    expect(s.championship.current.rating).toBeLessThan(999); expect(s.ownedBackgrounds).toContain('champ-1');
  });
});
