import { CHARACTERS } from './characters';
import type { CharacterDef, PassiveType } from './types';

export type GearKey = 'DAMAGE' | 'HEALTH' | 'VISION' | 'SHIELD' | 'SPEED' | 'COOLDOWN' | 'UNIQUE';
export interface GearDef { id: string; charId: number; key: GearKey; name: string; desc: string; price: number }

export const COMMON_GEARS: { key: Exclude<GearKey, 'UNIQUE'>; name: string; desc: string }[] = [
  { key: 'DAMAGE', name: 'DAMAGE', desc: 'HP50%以下で与ダメージ15%上昇。' },
  { key: 'HEALTH', name: 'HEALTH', desc: '非戦闘時のHP回復効率50%上昇。' },
  { key: 'VISION', name: 'VISION', desc: '敵にダメージを与えると、その敵の潜伏状態を2秒間発見できる（特殊な透明化は無効化しない）。' },
  { key: 'SHIELD', name: 'SHIELD', desc: '最大HP15%相当の追加シールド。消失後、HP満タンを5秒維持すると再充填。' },
  { key: 'SPEED', name: 'SPEED', desc: '草むら内の移動速度15%上昇。' },
  { key: 'COOLDOWN', name: 'SKILL COOLDOWN', desc: 'スキル1・2のクールタイム15%短縮（必殺ゲージには影響しない）。' },
];

/** Unique gear: amplifies the character's signature passive. Multiplier applied to passive p1 in combat. */
export const UNIQUE_GEAR_MULT = 1.4;
const UNIQUE_NAMES: Partial<Record<string, [string, string]>> = {
  SHADOW: ['SHADOW EDGE', '背後攻撃の追加ダメージを40%強化。'],
  TITAN: ['TITAN CORE', '低HP時の防御強化効果を40%強化。'],
  FROST: ['GLACIER HEART', '凍結に必要な氷蓄積数を1減らす。'],
  VOLT: ['OVERCLOCK', '連続命中時の攻撃速度上昇効果を40%強化。'],
  BLAZE: ['FLAME CHAIN', 'コンボ継続時間を40%延長し、1hitあたりの強化も40%上昇。'],
  AETHER: ['RADIANT GRACE', '回復量が20%上昇する。'],
};
const TYPE_LABEL: Record<PassiveType, string> = {
  backstab: '背後攻撃ボーナス', lowHpDefense: '低HP時軽減', frostStacks: '凍結蓄積', hitStreakAtkSpeed: '連続命中加速', comboDamage: 'コンボ強化',
  healCharge: '回復ゲージ変換', poisonOnHit: '毒ダメージ', bleedOnHit: '出血ダメージ', burnOnHit: '燃焼ダメージ', executeBonus: '低HP敵ボーナス',
  revengeStack: '報復蓄積率', frontArmor: '前面軽減', movingArmor: '移動中軽減', stillAccuracy: '静止時ボーナス', lifesteal: '吸血率',
  ambush: '奇襲ボーナス', chainHit: '連鎖ダメージ', slowOnHit: '減速効果', speedOnKill: '撃破時加速', shieldOnSkill: 'スキル時シールド',
  ultChargeBonus: '必殺ゲージ増加', bushPower: '草むら内ボーナス', markOnHit: 'マーク効果', thorns: '反射ダメージ', rangeScaling: '遠距離ボーナス',
  closeScaling: '近距離ボーナス', cooldownOnHit: 'CD短縮量', entropy: '時間経過強化', allyAura: '味方軽減オーラ', dodgeChance: '回避率',
};

export function uniqueGearFor(c: CharacterDef): { name: string; desc: string } {
  const n = UNIQUE_NAMES[c.key];
  if (n) return { name: n[0], desc: n[1] };
  return { name: `${c.key} SIGIL`, desc: `固有パッシブ「${c.passive.name}」の${TYPE_LABEL[c.passive.type]}を40%強化する（上限あり）。` };
}

export const GEARS: GearDef[] = CHARACTERS.flatMap(c => [
  ...COMMON_GEARS.map(g => ({ id: `${c.id}:${g.key}`, charId: c.id, key: g.key, name: g.name, desc: g.desc, price: 1000 })),
  { id: `${c.id}:UNIQUE`, charId: c.id, key: 'UNIQUE' as const, ...uniqueGearFor(c), price: 1000 },
]);
export const GEAR_BY_ID = new Map(GEARS.map(g => [g.id, g]));
export function gearsFor(charId: number): GearDef[] { return GEARS.filter(g => g.charId === charId); }
