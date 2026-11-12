import { hashStr, Rng } from '../core/rng';
import type { MatchResult } from '../sim/types';
import type { SaveData } from './save';

export interface MissionDef { id: string; text: string; goal: number; key: 'matches' | 'wins' | 'damage' | 'kills' | 'assists' | 'healing' | 'objective'; reward: { missionRights: number; credits: number } }
const POOL: Omit<MissionDef, 'id'>[] = [
  { text: '通常対戦を3回プレイ', goal: 3, key: 'matches', reward: { missionRights: 1, credits: 50 } },
  { text: '通常対戦で2回勝利', goal: 2, key: 'wins', reward: { missionRights: 1, credits: 80 } },
  { text: '合計30,000ダメージを与える', goal: 30000, key: 'damage', reward: { missionRights: 1, credits: 60 } },
  { text: '合計10キル', goal: 10, key: 'kills', reward: { missionRights: 1, credits: 60 } },
  { text: '合計8アシスト', goal: 8, key: 'assists', reward: { missionRights: 1, credits: 60 } },
  { text: '味方を合計5,000回復', goal: 5000, key: 'healing', reward: { missionRights: 1, credits: 70 } },
  { text: 'モード目標に貢献（目標値100）', goal: 100, key: 'objective', reward: { missionRights: 1, credits: 70 } },
];
export function today(): string { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
export function dailyMissions(day = today()): MissionDef[] {
  const rng = new Rng(hashStr(day));
  return rng.shuffle(POOL.slice()).slice(0, 4).map((m, i) => ({ ...m, id: `${day}#${i}` }));
}
export function ensureDay(s: SaveData) { const d = today(); if (s.missions.day !== d) s.missions = { day: d, progress: {}, claimed: [] }; }
/** Missions progress only from normal (non-championship, non-practice) matches. */
export function trackMissions(s: SaveData, r: MatchResult) {
  ensureDay(s);
  const p = s.missions.progress;
  const add = (k: string, v: number) => { p[k] = (p[k] ?? 0) + v; };
  add('matches', 1); if (r.outcome === 'win') add('wins', 1);
  add('damage', r.stats.damage); add('kills', r.stats.kills); add('assists', r.stats.assists); add('healing', r.stats.healing); add('objective', r.stats.objective);
}
export function claimMission(s: SaveData, id: string): boolean {
  ensureDay(s);
  const m = dailyMissions(s.missions.day).find(x => x.id === id);
  if (!m || s.missions.claimed.includes(id) || (s.missions.progress[m.key] ?? 0) < m.goal) return false;
  s.missions.claimed.push(id); s.missionRights += m.reward.missionRights; s.credits += m.reward.credits;
  return true;
}
