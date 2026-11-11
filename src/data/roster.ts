import type { Category } from './types';

/**
 * Master roster: [id, KEY, signature mechanic (JP), signature archetype key].
 * The archetype key selects the signature ability/passive builder in kits.ts.
 * IDs 081-090 were not defined in the original spec roster; they were newly designed (see PROJECT_STATUS.md).
 */
export type RosterRow = [number, string, string, string];

export const ROSTER: RosterRow[] = [
  // A: 暗殺・奇襲
  [1, 'SHADOW', '背後追加ダメージ', 'backstab'], [2, 'PHANTOM', '透明化・残像', 'invisClone'], [3, 'REAPER', '鎖鎌引き寄せ', 'chainPull'],
  [4, 'VIPER', '毒', 'poison'], [5, 'RIFT', '空間転移', 'warp'], [6, 'NIGHTFALL', '暗闇強化', 'bushPower'],
  [7, 'RAVEN', '空中奇襲', 'dive'], [8, 'SILENCE', 'スキル妨害', 'silence'], [9, 'GHOST', '回避', 'dodge'],
  [10, 'SCARLET', '追跡マーク', 'mark'], [11, 'FANG', '連続命中追撃', 'followup'], [12, 'WRAITH', '敵残像利用', 'afterimage'],
  [13, 'VEIL', '煙幕', 'smoke'], [14, 'KRAIT', '曲線奇襲', 'curve'], [15, 'NOCTIS', '暗所射程変化', 'darkRange'],
  [16, 'RAZOR', '連続斬撃', 'slash'], [17, 'KAGE', '分身', 'clone'], [18, 'DUSK', '視界妨害', 'blind'],
  [19, 'HOLLOW', '被弾消失', 'vanish'], [20, 'JACKAL', '弱った敵追跡', 'execute'], [21, 'SPECTER', '壁際高速移動', 'wallSpeed'],
  [22, 'ONYX', '奇襲防御貫通', 'pierceArmor'], [23, 'TALON', '飛び込み', 'leap'], [24, 'BLINK', '連続転移', 'multiBlink'],
  [25, 'MANTIS', '多段斬撃', 'multiSlash'], [26, 'FABLE', '背後幻影', 'backIllusion'], [27, 'VANTA', '非視認時潜伏', 'unseen'],
  [28, 'CRIMSON', '出血', 'bleed'], [29, 'STALKER', 'マーキング', 'markHunt'], [30, 'ECLIPSE', '光と影切替', 'lightShadow'],
  // B: 重火力・破壊
  [31, 'TITAN', '低HP防御上昇', 'lowHpDef'], [32, 'RAGNAR', '被弾反撃蓄積', 'revenge'], [33, 'NOVA', '爆発連鎖', 'explodeChain'],
  [34, 'COLOSSUS', '広範囲攻撃', 'wide'], [35, 'BASTION', '防壁', 'wall'], [36, 'CANNON', 'チャージ砲撃', 'chargeShot'],
  [37, 'DOZER', '障害物破壊突進', 'breakDash'], [38, 'WARLORD', '広範囲武器', 'wideWeapon'], [39, 'BRUTUS', 'ノックバック', 'knockback'],
  [40, 'GOLIATH', '地震', 'quake'], [41, 'IRONCLAD', '段階装甲', 'armorStage'], [42, 'MAGMA', '溶岩設置', 'lava'],
  [43, 'TREMOR', '地面揺らし', 'tremor'], [44, 'BULLDOZER', '押し出し', 'push'], [45, 'ANVIL', 'ハンマー落下', 'hammerDrop'],
  [46, 'FURNACE', '熱蓄積放出', 'heat'], [47, 'CYCLOPS', '単発砲撃', 'bigShot'], [48, 'BEHEMOTH', '移動中防御', 'movingArmor'],
  [49, 'DREADNOUGHT', '前方軽減', 'frontArmor'], [50, 'BLAST', '爆風制圧', 'blast'], [51, 'HAMMER', '連続叩きつけ', 'multiSlam'],
  [52, 'PYRE', '炎設置', 'fireZone'], [53, 'GRAVITY', '重力圧縮', 'gravity'], [54, 'FORTRESS', '要塞化', 'fortress'],
  [55, 'RUPTURE', '地面亀裂', 'fissure'], [56, 'WARHEAD', '周囲爆発', 'selfExplode'], [57, 'KRAKEN', '触手', 'tentacle'],
  [58, 'MONOLITH', '巨大防壁', 'bigWall'], [59, 'OVERKILL', 'チャージ量で範囲変化', 'chargeArea'], [60, 'APOCALYPSE', '連続爆撃', 'bombard'],
  // C: 遠距離・精密攻撃
  [61, 'VOLT', '連続命中で攻撃速度上昇', 'atkStreak'], [62, 'FROST', '氷蓄積凍結', 'frost'], [63, 'PHOTON', '高速光弾', 'fastShot'],
  [64, 'ECHO', '音波反射', 'bounce'], [65, 'SCOPE', '長距離狙撃', 'snipe'], [66, 'RAIL', '貫通チャージ弾', 'rail'],
  [67, 'ORACLE', '移動先予測射撃', 'predict'], [68, 'COMET', '拡散弾', 'spread'], [69, 'ARROW', '誘導矢', 'homing'],
  [70, 'LASER', '持続レーザー', 'beam'], [71, 'PULSE', '範囲弾', 'pulse'], [72, 'BOREAL', '氷結弾', 'iceShot'],
  [73, 'STORM', '連鎖雷撃', 'chain'], [74, 'SNIPER', '静止時精度上昇', 'stillAcc'], [75, 'ARTEMIS', '曲射弾', 'lob'],
  [76, 'HAWK', '追尾マーキング', 'markHoming'], [77, 'NEBULA', '拡散星雲弾', 'nebula'], [78, 'QUASAR', '時間差爆発', 'delayBlast'],
  [79, 'FLARE', '炎弾幕', 'flameBarrage'], [80, 'ZEROPOINT', '減速領域', 'slowZone'],
  [81, 'VECTOR', '弾道折り返し（新規考案）', 'boomerang'], [82, 'HALO', '光輪射撃（新規考案）', 'halo'], [83, 'MORTAR', '迫撃砲（新規考案）', 'mortar'],
  [84, 'DRIFT', '浮遊機雷（新規考案）', 'mine'], [85, 'PRISM', '分光弾（新規考案）', 'prism'], [86, 'GALE', '風圧弾（新規考案）', 'gale'],
  [87, 'SPARK', '跳弾電撃（新規考案）', 'sparkBounce'], [88, 'TRACER', '弾跡追撃（新規考案）', 'tracer'], [89, 'APEX', '距離比例火力（新規考案）', 'rangeScale'],
  [90, 'CINDER', '残り火弾（新規考案）', 'ember'],
  // D: 格闘・コンボ
  [91, 'BLAZE', 'コンボ火力上昇', 'comboFire'], [92, 'DRAGON', '炎連撃', 'dragonFire'], [93, 'RYUJI', '方向変化連撃', 'dirCombo'],
  [94, 'STRIKER', 'タイミング威力変化', 'timing'], [95, 'MONK', '気力連続技', 'chi'], [96, 'KNUCKLE', '拳コンボ', 'fistCombo'],
  [97, 'TEMPO', 'リズム入力強化', 'rhythm'], [98, 'BREAKER', 'ガード崩し', 'guardBreak'], [99, 'COMBO', '攻撃順変化', 'comboOrder'],
  [100, 'PHOENIX', 'コンボ後再突進', 'rush'], [101, 'TIGER', '爪撃', 'claw'], [102, 'VIPERFIST', '毒拳', 'poisonFist'],
  [103, 'RONIN', '居合切替', 'iai'], [104, 'BERSERK', '攻撃継続強化', 'berserk'], [105, 'KICKER', '打ち上げ', 'launch'],
  [106, 'CYBORG', '機械腕連撃', 'mechArm'], [107, 'FALCON', '飛び込み', 'falconDive'], [108, 'SPARTAN', '盾槍', 'shieldSpear'],
  [109, 'GONG', '衝撃波', 'shockwave'], [110, 'DANCER', '移動攻撃連動', 'dance'], [111, 'SHOCKER', '電撃拳', 'shockFist'],
  [112, 'MAULER', '掴み', 'grab'], [113, 'KENSHI', '刀コンボ', 'katana'], [114, 'JACK', 'フェイント', 'feint'],
  [115, 'RUSHER', '突進連撃', 'rushCombo'], [116, 'PANTHER', '方向転換攻撃', 'pivot'], [117, 'CHIMERA', 'モーション切替', 'morph'],
  [118, 'VORTEX', '回転攻撃', 'spin'], [119, 'GLADIATOR', '武器連撃', 'weaponCombo'], [120, 'INFERNO', 'コンボ終端炎', 'finisherFire'],
  // E: トリッキー・特殊戦闘
  [121, 'MIRAGE', '幻影', 'illusion'], [122, 'ORBIT', '重力引き寄せ', 'orbitPull'], [123, 'MAGNET', '磁力', 'magnet'],
  [124, 'ZERO', '時間減速', 'timeSlow'], [125, 'PIXEL', '攻撃分裂', 'split'], [126, 'TRICKSTER', '偽攻撃判定', 'fakeShot'],
  [127, 'PUPPET', '人形操作', 'puppet'], [128, 'PORTAL', 'ワープ', 'portal'], [129, 'GAMBIT', '条件付き攻撃変化', 'gambit'],
  [130, 'GLITCH', '位置攪乱', 'glitch'], [131, 'JESTER', '不規則軌道', 'erratic'], [132, 'ALCHEMY', '物質変化', 'alchemy'],
  [133, 'TWIN', '分身交換', 'swap'], [134, 'PARADOX', '遅延攻撃', 'delayed'], [135, 'CLOCKWORK', 'タイミング操作', 'clock'],
  [136, 'ROULETTE', '効果抽選', 'roulette'], [137, 'MIRROR', '反射鏡', 'mirror'], [138, 'WEB', '移動罠', 'web'],
  [139, 'SHIFTER', '属性切替', 'elementSwap'], [140, 'DREAMER', '幻覚領域', 'dreamZone'], [141, 'INK', '視界妨害', 'ink'],
  [142, 'SWARM', '小型ユニット', 'swarm'], [143, 'VORTEXIA', '竜巻', 'tornado'], [144, 'PHASE', '当たり判定変化', 'phase'],
  [145, 'LUCID', '敵幻影', 'enemyIllusion'], [146, 'HEX', '呪い', 'curse'], [147, 'FORTUNE', '条件付き幸運変化', 'fortune'],
  [148, 'DOPPELGANGER', '敵模倣', 'mimic'], [149, 'SINGULARITY', 'ブラックホール', 'blackhole'], [150, 'MAZE', '迷路障害物', 'maze'],
  // F: 防御・反撃
  [151, 'AETHER', '回復・反射', 'aether'], [152, 'GUARDIAN', '味方防壁', 'allyWall'], [153, 'PALADIN', '防御反撃', 'paladin'],
  [154, 'REFLECTOR', '飛び道具反射', 'reflect'], [155, 'SENTINEL', '自動迎撃', 'sentry'], [156, 'ANCHOR', 'ノックバック軽減', 'anchor'],
  [157, 'MIRRORGUARD', '攻撃記録返却', 'recordReturn'], [158, 'MEDIC', '回復', 'medic'], [159, 'AEGIS', '範囲バリア', 'aegis'],
  [160, 'COUNTER', 'タイミング反撃', 'counter'], [161, 'BULWARK', '防御範囲拡張', 'bulwark'], [162, 'SANCTUS', '回復領域', 'healZone'],
  [163, 'RETRIBUTION', '被ダメージ反撃変換', 'retribution'], [164, 'WARDEN', '区域防衛', 'warden'], [165, 'BISHOP', '味方防御付与', 'bishop'],
  [166, 'BARRIER', '弾幕遮断', 'barrier'], [167, 'VIGIL', '味方攻撃肩代わり', 'vigil'], [168, 'REBOUND', 'ノックバック反撃', 'rebound'],
  [169, 'BULWARK-X', '多層装甲', 'layered'], [170, 'LIFELINE', '連携回復', 'lifeline'],
  // G: 特殊・高難度
  [171, 'JUDGE', '条件付き高威力', 'judge'], [172, 'EMPEROR', '戦場支配', 'emperor'], [173, 'CHAOS', '技性質変化', 'chaos'],
  [174, 'REQUIEM', '拍子で攻撃変化', 'requiem'], [175, 'OMEGA', '多段階必殺', 'omega'], [176, 'APOCRYPHA', '攻撃条件変更', 'apocrypha'],
  [177, 'ENTROPY', '時間経過で変化', 'entropy'], [178, 'GENESIS', '攻撃装置生成', 'genesis'], [179, 'VOID', '弾吸収', 'void'],
  [180, 'SERAPH', '空中広域攻撃', 'seraph'], [181, 'LEVIATHAN', '水流', 'water'], [182, 'ATLAS', '地形変化', 'terrain'],
  [183, 'PROMETHEUS', '炎分配', 'fireShare'], [184, 'HYPERION', '光蓄積', 'lightStore'], [185, 'NEMESIS', '特定敵対抗', 'nemesis'],
  [186, 'CHRONOS', '時間差攻撃', 'chrono'], [187, 'ASTRA', '星配置で変化', 'stars'], [188, 'DEUS', '必殺形態選択', 'deus'],
  [189, 'ABYSS', '深淵領域', 'abyss'], [190, 'INFINITY', '段階強化', 'infinity'], [191, 'ETERNITY', '能力切替', 'eternity'],
  [192, 'PARAGON', 'コンボ結果変化', 'paragon'], [193, 'ARCHON', '領域ルール変更', 'archon'], [194, 'OBLIVION', '敵設置物消去', 'oblivion'],
  [195, 'DIVINITY', '攻防切替', 'divinity'], [196, 'ASTRAL', '星界移動攻撃', 'astral'], [197, 'CALAMITY', '災害連携', 'calamity'],
  [198, 'OVERLORD', '行動制限領域', 'overlord'], [199, 'ABSOLUTE', '攻防極端切替', 'absolute'], [200, 'ENDGAME', '条件付き特殊必殺', 'endgame'],
];

export function categoryOf(id: number): Category {
  if (id <= 30) return 'A';
  if (id <= 60) return 'B';
  if (id <= 90) return 'C';
  if (id <= 120) return 'D';
  if (id <= 150) return 'E';
  if (id <= 170) return 'F';
  return 'G';
}

export const CATEGORY_INFO: Record<Category, { name: string; jp: string; color: string }> = {
  A: { name: 'ASSASSIN', jp: '暗殺・奇襲', color: '#a259ff' },
  B: { name: 'HEAVY', jp: '重火力・破壊', color: '#ff6b35' },
  C: { name: 'RANGED', jp: '遠距離・精密攻撃', color: '#2ec4ff' },
  D: { name: 'BRAWLER', jp: '格闘・コンボ', color: '#ff3b5c' },
  E: { name: 'TRICKSTER', jp: 'トリッキー・特殊戦闘', color: '#3cf2a6' },
  F: { name: 'GUARD', jp: '防御・反撃', color: '#ffd23f' },
  G: { name: 'MYTHIC', jp: '特殊・高難度', color: '#ff4fd8' },
};
