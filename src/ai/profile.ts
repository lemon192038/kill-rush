import { Rng } from '../core/rng';

export const CPU_RANKS = ['ROOKIE', 'CASUAL', 'NORMAL', 'ADVANCED', 'EXPERT', 'MASTER', 'GENIUS', 'PRODIGY'] as const;
export type CpuRank = typeof CPU_RANKS[number];
/** Base lottery distribution (spec). */
export const RANK_BASE_DIST: Record<CpuRank, number> = { ROOKIE: 20, CASUAL: 25, NORMAL: 25, ADVANCED: 15, EXPERT: 9, MASTER: 4, GENIUS: 1.5, PRODIGY: 0.5 };
/** Representative skill rating for each rank (same scale as player skill rating). */
export const RANK_RATING: Record<CpuRank, number> = { ROOKIE: 300, CASUAL: 600, NORMAL: 900, ADVANCED: 1200, EXPERT: 1500, MASTER: 1800, GENIUS: 2100, PRODIGY: 2400 };
/** Base ability level (0..1) per rank. */
const RANK_LEVEL: Record<CpuRank, number> = { ROOKIE: 0.18, CASUAL: 0.3, NORMAL: 0.42, ADVANCED: 0.55, EXPERT: 0.67, MASTER: 0.78, GENIUS: 0.88, PRODIGY: 0.93 };

export const PERSONALITIES = ['BEGINNER', 'STEADY', 'AGGRESSIVE', 'ASSASSIN', 'SNIPER', 'DEFENDER', 'COMBO MASTER', 'TRICKSTER', 'TACTICIAN', 'GENIUS', 'BERSERKER', 'DUELIST', 'CHAOTIC', 'VETERAN', 'CLUTCH', 'HUNTER', 'COUNTER', 'ENGINEER', 'FALSE ELITE', 'PRODIGY'] as const;
export type Personality = typeof PERSONALITIES[number];

export interface AbilityStats {
  control: number;   // 操作技術: aim precision, strafing, dodging execution
  judgment: number;  // 判断力: target/skill choice quality
  reaction: number;  // 反応速度
  reading: number;   // 読み合い: lead prediction from observed movement, dodge anticipation of visible telegraphs
  combo: number;     // コンボ技術
  tactics: number;   // 戦術理解: objectives, bushes, retreat, memory
  stability: number; // 安定性: low variance, fewer blunders
}
export const ABILITY_KEYS: (keyof AbilityStats)[] = ['control', 'judgment', 'reaction', 'reading', 'combo', 'tactics', 'stability'];
export const ABILITY_JP: Record<keyof AbilityStats, string> = { control: '操作技術', judgment: '判断力', reaction: '反応速度', reading: '読み合い', combo: 'コンボ技術', tactics: '戦術理解', stability: '安定性' };

/** Behaviour weights per personality. All 0..1 unless noted. */
export interface Behaviour {
  aggression: number; preferredRange: number; // fraction of attack range (0.3 close .. 1 max)
  lowHpFocus: number; retreatHp: number; bushUse: number; skillUse: number; comboFocus: number;
  feint: number; randomness: number; objective: number; teamwork: number; counter: number; deploy: number; adaptive: number; clutch: number;
  /** stat multipliers applied on top of rank (strengths/weaknesses) */
  mod: Partial<AbilityStats>;
}
export const BEHAVIOURS: Record<Personality, Behaviour> = {
  BEGINNER: { aggression: 0.5, preferredRange: 0.6, lowHpFocus: 0.1, retreatHp: 0.15, bushUse: 0.1, skillUse: 0.25, comboFocus: 0, feint: 0, randomness: 0.5, objective: 0.4, teamwork: 0.2, counter: 0.1, deploy: 0.2, adaptive: 0, clutch: 0, mod: { control: 0.7, judgment: 0.7, combo: 0.3, stability: 0.6 } },
  STEADY: { aggression: 0.4, preferredRange: 0.85, lowHpFocus: 0.3, retreatHp: 0.45, bushUse: 0.3, skillUse: 0.6, comboFocus: 0.3, feint: 0.1, randomness: 0.1, objective: 0.6, teamwork: 0.6, counter: 0.4, deploy: 0.5, adaptive: 0.2, clutch: 0.2, mod: { stability: 1.2, combo: 0.85 } },
  AGGRESSIVE: { aggression: 0.95, preferredRange: 0.4, lowHpFocus: 0.4, retreatHp: 0.2, bushUse: 0.2, skillUse: 0.8, comboFocus: 0.5, feint: 0.1, randomness: 0.2, objective: 0.4, teamwork: 0.4, counter: 0.2, deploy: 0.3, adaptive: 0.2, clutch: 0.3, mod: { control: 1.05, stability: 0.85 } },
  ASSASSIN: { aggression: 0.8, preferredRange: 0.35, lowHpFocus: 0.95, retreatHp: 0.35, bushUse: 0.9, skillUse: 0.7, comboFocus: 0.6, feint: 0.3, randomness: 0.15, objective: 0.3, teamwork: 0.3, counter: 0.2, deploy: 0.3, adaptive: 0.3, clutch: 0.4, mod: { tactics: 1.1, judgment: 1.05 } },
  SNIPER: { aggression: 0.35, preferredRange: 1.0, lowHpFocus: 0.5, retreatHp: 0.5, bushUse: 0.6, skillUse: 0.5, comboFocus: 0.2, feint: 0.1, randomness: 0.1, objective: 0.4, teamwork: 0.4, counter: 0.3, deploy: 0.4, adaptive: 0.3, clutch: 0.3, mod: { control: 1.15, reading: 1.1, reaction: 0.9 } },
  DEFENDER: { aggression: 0.3, preferredRange: 0.7, lowHpFocus: 0.3, retreatHp: 0.5, bushUse: 0.4, skillUse: 0.7, comboFocus: 0.3, feint: 0, randomness: 0.1, objective: 0.9, teamwork: 0.9, counter: 0.8, deploy: 0.7, adaptive: 0.3, clutch: 0.4, mod: { stability: 1.15, control: 0.95 } },
  'COMBO MASTER': { aggression: 0.7, preferredRange: 0.5, lowHpFocus: 0.4, retreatHp: 0.35, bushUse: 0.3, skillUse: 0.9, comboFocus: 1, feint: 0.2, randomness: 0.1, objective: 0.4, teamwork: 0.4, counter: 0.3, deploy: 0.4, adaptive: 0.3, clutch: 0.3, mod: { combo: 1.25, tactics: 0.9 } },
  TRICKSTER: { aggression: 0.6, preferredRange: 0.6, lowHpFocus: 0.4, retreatHp: 0.35, bushUse: 0.8, skillUse: 0.7, comboFocus: 0.3, feint: 0.9, randomness: 0.4, objective: 0.4, teamwork: 0.4, counter: 0.3, deploy: 0.6, adaptive: 0.4, clutch: 0.3, mod: { reading: 1.1, stability: 0.85 } },
  TACTICIAN: { aggression: 0.5, preferredRange: 0.7, lowHpFocus: 0.6, retreatHp: 0.45, bushUse: 0.6, skillUse: 0.7, comboFocus: 0.4, feint: 0.2, randomness: 0.05, objective: 1, teamwork: 0.9, counter: 0.5, deploy: 0.6, adaptive: 0.6, clutch: 0.5, mod: { tactics: 1.25, judgment: 1.15, control: 0.9 } },
  GENIUS: { aggression: 0.6, preferredRange: 0.7, lowHpFocus: 0.6, retreatHp: 0.4, bushUse: 0.6, skillUse: 0.8, comboFocus: 0.6, feint: 0.4, randomness: 0.05, objective: 0.8, teamwork: 0.7, counter: 0.6, deploy: 0.6, adaptive: 1, clutch: 0.6, mod: { reading: 1.2, judgment: 1.15, stability: 0.9 } },
  BERSERKER: { aggression: 1, preferredRange: 0.3, lowHpFocus: 0.2, retreatHp: 0.0, bushUse: 0.1, skillUse: 0.8, comboFocus: 0.4, feint: 0, randomness: 0.25, objective: 0.2, teamwork: 0.2, counter: 0.1, deploy: 0.2, adaptive: 0.1, clutch: 0.5, mod: { control: 1.05, judgment: 0.75, tactics: 0.7 } },
  DUELIST: { aggression: 0.7, preferredRange: 0.65, lowHpFocus: 0.3, retreatHp: 0.3, bushUse: 0.3, skillUse: 0.8, comboFocus: 0.6, feint: 0.4, randomness: 0.1, objective: 0.3, teamwork: 0.2, counter: 0.6, deploy: 0.3, adaptive: 0.5, clutch: 0.5, mod: { control: 1.15, reading: 1.15, tactics: 0.8 } },
  CHAOTIC: { aggression: 0.7, preferredRange: 0.6, lowHpFocus: 0.3, retreatHp: 0.25, bushUse: 0.4, skillUse: 0.7, comboFocus: 0.3, feint: 0.5, randomness: 0.9, objective: 0.3, teamwork: 0.2, counter: 0.3, deploy: 0.4, adaptive: 0.1, clutch: 0.3, mod: { stability: 0.6 } },
  VETERAN: { aggression: 0.55, preferredRange: 0.75, lowHpFocus: 0.6, retreatHp: 0.4, bushUse: 0.6, skillUse: 0.85, comboFocus: 0.6, feint: 0.3, randomness: 0.05, objective: 0.7, teamwork: 0.7, counter: 0.6, deploy: 0.6, adaptive: 0.4, clutch: 0.4, mod: { combo: 1.15, judgment: 1.1, reaction: 0.9 } },
  CLUTCH: { aggression: 0.5, preferredRange: 0.7, lowHpFocus: 0.5, retreatHp: 0.3, bushUse: 0.4, skillUse: 0.7, comboFocus: 0.4, feint: 0.2, randomness: 0.1, objective: 0.6, teamwork: 0.6, counter: 0.5, deploy: 0.4, adaptive: 0.3, clutch: 1, mod: { stability: 0.9 } },
  HUNTER: { aggression: 0.8, preferredRange: 0.6, lowHpFocus: 0.8, retreatHp: 0.3, bushUse: 0.4, skillUse: 0.7, comboFocus: 0.4, feint: 0.1, randomness: 0.1, objective: 0.3, teamwork: 0.3, counter: 0.3, deploy: 0.3, adaptive: 0.3, clutch: 0.3, mod: { tactics: 1.15, reaction: 1.05 } },
  COUNTER: { aggression: 0.35, preferredRange: 0.7, lowHpFocus: 0.4, retreatHp: 0.35, bushUse: 0.5, skillUse: 0.6, comboFocus: 0.4, feint: 0.1, randomness: 0.05, objective: 0.5, teamwork: 0.5, counter: 1, deploy: 0.4, adaptive: 0.4, clutch: 0.4, mod: { reaction: 1.15, reading: 1.1, control: 0.95 } },
  ENGINEER: { aggression: 0.4, preferredRange: 0.8, lowHpFocus: 0.3, retreatHp: 0.45, bushUse: 0.4, skillUse: 0.9, comboFocus: 0.3, feint: 0.1, randomness: 0.1, objective: 0.8, teamwork: 0.6, counter: 0.4, deploy: 1, adaptive: 0.3, clutch: 0.3, mod: { tactics: 1.1, control: 0.9 } },
  'FALSE ELITE': { aggression: 0.6, preferredRange: 0.7, lowHpFocus: 0.3, retreatHp: 0.35, bushUse: 0.3, skillUse: 0.4, comboFocus: 0.1, feint: 0, randomness: 0.1, objective: 0.5, teamwork: 0.4, counter: 0.2, deploy: 0.3, adaptive: 0, clutch: 0.2, mod: { control: 1.1, combo: 0.6, reading: 0.7, tactics: 0.8 } },
  PRODIGY: { aggression: 0.65, preferredRange: 0.7, lowHpFocus: 0.6, retreatHp: 0.4, bushUse: 0.6, skillUse: 0.85, comboFocus: 0.6, feint: 0.3, randomness: 0.05, objective: 0.8, teamwork: 0.7, counter: 0.6, deploy: 0.6, adaptive: 1, clutch: 0.6, mod: { reading: 1.1, stability: 0.95 } },
};
export const PERSONALITY_JP: Record<Personality, string> = {
  BEGINNER: 'ミスが多くコンボを使わない', STEADY: '安全距離を保つ堅実派', AGGRESSIVE: '接近して連続攻撃', ASSASSIN: '低HPの敵を奇襲', SNIPER: '距離を取って射撃',
  DEFENDER: '防御と反撃', 'COMBO MASTER': 'コンボ重視', TRICKSTER: 'フェイント多用', TACTICIAN: '戦況判断に優れる', GENIUS: '敵の傾向に適応',
  BERSERKER: '攻撃最優先', DUELIST: '1対1に特化', CHAOTIC: '不規則な行動', VETERAN: '技の理解が深い', CLUTCH: '不利な状況で集中',
  HUNTER: '敵を追跡', COUNTER: '反撃重視', ENGINEER: '罠・設置物を活用', 'FALSE ELITE': '基本動作中心', PRODIGY: '戦闘中に学習',
};

export interface CpuProfile { rank: CpuRank; personality: Personality; stats: AbilityStats; rating: number }

/** Build a CPU profile: rank and personality are independent. Individual variance per stat. */
export function makeProfile(rng: Rng, rank: CpuRank, personality: Personality): CpuProfile {
  const base = RANK_LEVEL[rank];
  const mod = BEHAVIOURS[personality].mod;
  const stats = {} as AbilityStats;
  for (const k of ABILITY_KEYS) {
    const v = base * (mod[k] ?? 1) + rng.gauss() * 0.05;
    stats[k] = Math.max(0.05, Math.min(0.97, v));
  }
  return { rank, personality, stats, rating: RANK_RATING[rank] };
}
export function rollPersonality(rng: Rng): Personality { return rng.pick(PERSONALITIES); }
export function rollRankBase(rng: Rng): CpuRank { return rng.weighted(CPU_RANKS, CPU_RANKS.map(r => RANK_BASE_DIST[r])); }
