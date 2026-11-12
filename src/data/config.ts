/** Central tuning file for economy, rewards and gacha. All numbers are adjustable initial values. */
export const ECONOMY = {
  gearPrice: 1000,                // coins per gear
  maxEquippedGears: 2,
  victoryBox: { coinChance: 0.9, coinAmount: 10 },
  charUnlockPoints: 1000,         // character points needed to unlock a chosen character
  duplicateCharPoints: 250,       // character points granted for duplicate character draw
  duplicateSkinCredits: { COMMON: 50, UNCOMMON: 100, RARE: 200, 'SUPER RARE': 400, 'HYPER RARE': 800, MYTHIC: 1500, LEGENDARY: 2500 } as Record<string, number>,
  normalPt: { win: 10, winRankBonusPerTier: 0, loss: -5, draw: 0, firstPlaceBonus: 4 },
};

export const SKIN_PRICES: Record<string, number> = {
  COMMON: 500, UNCOMMON: 1000, RARE: 2000, 'SUPER RARE': 4000, 'HYPER RARE': 8000, MYTHIC: 15000, LEGENDARY: 25000,
};

export type GachaKind = 'VICTORY' | 'MISSION' | 'CHARACTER' | 'SKIN' | 'LEGENDARY' | 'EVENT' | 'SEASON' | 'FREE';
export interface GachaConfig {
  kind: GachaKind; name: string; desc: string;
  cost: { type: 'victoryRight' | 'missionRight' | 'credits' | 'free'; amount: number };
  /** reward category weights */
  weights: { character: number; skin: number; credits: number; background: number };
  creditRange: [number, number];
  skinRarityWeights: Record<string, number>;
  pity: number; // guaranteed character within N draws
  allowTen: boolean;
  freeIntervalHours?: number;
}
const RW = { COMMON: 40, UNCOMMON: 25, RARE: 16, 'SUPER RARE': 9, 'HYPER RARE': 5, MYTHIC: 3, LEGENDARY: 2 };
export const GACHA: GachaConfig[] = [
  { kind: 'VICTORY', name: 'VICTORY BOX', desc: '通常対戦の勝利で1回開封可能。コインが高確率で出る。', cost: { type: 'victoryRight', amount: 1 }, weights: { character: 4, skin: 10, credits: 76, background: 10 }, creditRange: [20, 80], skinRarityWeights: RW, pity: 60, allowTen: true },
  { kind: 'MISSION', name: 'MISSION BOX', desc: 'ミッション達成で獲得する権利で開封。', cost: { type: 'missionRight', amount: 1 }, weights: { character: 6, skin: 20, credits: 64, background: 10 }, creditRange: [40, 120], skinRarityWeights: RW, pity: 40, allowTen: true },
  { kind: 'CHARACTER', name: 'CHARACTER BOX', desc: 'キャラクター排出率アップ。', cost: { type: 'credits', amount: 600 }, weights: { character: 40, skin: 15, credits: 40, background: 5 }, creditRange: [30, 100], skinRarityWeights: RW, pity: 10, allowTen: true },
  { kind: 'SKIN', name: 'SKIN BOX', desc: 'スキン排出率アップ。', cost: { type: 'credits', amount: 500 }, weights: { character: 5, skin: 60, credits: 30, background: 5 }, creditRange: [30, 100], skinRarityWeights: RW, pity: 30, allowTen: true },
  { kind: 'LEGENDARY', name: 'LEGENDARY BOX', desc: '高レアリティスキン・キャラクターの排出率が高い。', cost: { type: 'credits', amount: 2500 }, weights: { character: 30, skin: 50, credits: 15, background: 5 }, creditRange: [200, 600], skinRarityWeights: { COMMON: 0, UNCOMMON: 0, RARE: 10, 'SUPER RARE': 25, 'HYPER RARE': 30, MYTHIC: 22, LEGENDARY: 13 }, pity: 8, allowTen: true },
  { kind: 'EVENT', name: 'EVENT BOX', desc: 'イベント期間用ボックス（現在は常設テスト版）。', cost: { type: 'credits', amount: 800 }, weights: { character: 15, skin: 35, credits: 35, background: 15 }, creditRange: [50, 150], skinRarityWeights: RW, pity: 20, allowTen: true },
  { kind: 'SEASON', name: 'SEASON BOX', desc: 'シーズン用ボックス（通常コレクション背景も排出）。', cost: { type: 'credits', amount: 800 }, weights: { character: 15, skin: 30, credits: 35, background: 20 }, creditRange: [50, 150], skinRarityWeights: RW, pity: 20, allowTen: true },
  { kind: 'FREE', name: 'FREE BOX', desc: '24時間ごとに無料で1回開封できる。', cost: { type: 'free', amount: 0 }, weights: { character: 3, skin: 12, credits: 80, background: 5 }, creditRange: [20, 60], skinRarityWeights: RW, pity: 9999, allowTen: false, freeIntervalHours: 24 },
];

export const SAVE_VERSION = 3;

/** ⚡ power cube movement multiplier cap (HP/attack/heal use the uncapped 1.1^n). Adjustable. */
export const CUBE_SPEED_CAP = 1.5;
