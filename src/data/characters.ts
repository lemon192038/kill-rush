import { hashStr, Rng } from '../core/rng';
import type { SpeedClass } from '../core/constants';
import { ab, atk, passive, skill, ult, type AtkKey } from './presets';
import { ROSTER, categoryOf, CATEGORY_INFO } from './roster';
import { SIGS } from './sigs';
import type { AbilityDef, AttackDef, Category, CharacterDef, PassiveType, Role } from './types';

const CAT: Record<Category, { hp: [number, number]; speeds: SpeedClass[]; role: Role; type: string; dmg: number; strong: string; weak: string; weakness: string; tactics: string; diff: [number, number] }> = {
  A: { hp: [2800, 3400], speeds: ['VERY_FAST', 'FAST'], role: 'ASSASSIN', type: '近接奇襲', dmg: 1.0, strong: '遠距離アタッカー・サポート', weak: '重装甲・範囲制圧', weakness: 'HPが低く、接近前に集中砲火を受けると脆い。', tactics: '草むらと転移で側面を取り、低HPの敵を一気に仕留める。', diff: [3, 5] },
  B: { hp: [5200, 6500], speeds: ['SLOW', 'VERY_SLOW', 'NORMAL'], role: 'TANK', type: '重装制圧', dmg: 1.05, strong: '近接アサシン・格闘', weak: '長距離狙撃・減速', weakness: '移動が遅く、距離を取られると攻撃が届かない。', tactics: '前線で壁となり、範囲攻撃で密集した敵をまとめて崩す。', diff: [1, 3] },
  C: { hp: [2900, 3600], speeds: ['NORMAL', 'FAST'], role: 'MARKSMAN', type: '遠距離射撃', dmg: 1.0, strong: '鈍足タンク', weak: 'アサシン・突進', weakness: '接近されると逃げ手段が限られる。', tactics: '射程の端を維持し、障害物を盾に削り続ける。', diff: [2, 4] },
  D: { hp: [3900, 4700], speeds: ['FAST', 'NORMAL'], role: 'FIGHTER', type: '近接格闘', dmg: 1.0, strong: 'マークスマン・サポート', weak: 'ノックバック・減速', weakness: 'リーチが短く、引き撃ちに弱い。', tactics: '突進スキルで距離を詰め、コンボを繋げて火力を最大化する。', diff: [2, 4] },
  E: { hp: [3200, 3900], speeds: ['NORMAL', 'FAST'], role: 'CONTROLLER', type: '特殊妨害', dmg: 0.95, strong: '集団戦・単調な相手', weak: '高機動アサシン', weakness: '単体火力が控えめで、読まれると脆い。', tactics: '妨害と位置操作で有利な状況を作り、味方と仕留める。', diff: [3, 5] },
  F: { hp: [4200, 5200], speeds: ['NORMAL', 'SLOW'], role: 'SUPPORT', type: '防御支援', dmg: 0.9, strong: '持久戦・チーム戦', weak: '高火力バースト', weakness: '単独では決定力に欠ける。', tactics: '味方の近くで守りと回復を回し、反撃の機会を作る。', diff: [1, 3] },
  G: { hp: [3600, 4600], speeds: ['NORMAL', 'FAST'], role: 'SPECIALIST', type: '特殊高難度', dmg: 1.05, strong: '状況次第で全般', weak: '状況次第で全般', weakness: '条件を満たせないと性能を発揮できない。', tactics: '固有条件を理解し、発動タイミングを見極める。', diff: [4, 5] },
};

const PALETTE = ['#a259ff', '#ff6b35', '#2ec4ff', '#ff3b5c', '#3cf2a6', '#ffd23f', '#ff4fd8', '#7cff4f', '#4f7cff', '#ff9f1c', '#00e0c6', '#e84855', '#b5ff3c', '#c77dff', '#48cae4'];

function scaleAttack(a: AttackDef, m: number): AttackDef { return { ...a, damage: Math.round(a.damage * m) }; }

function complete(): Record<string, Partial<CharacterDef>> {
  return {
    SHADOW: {
      hp: 3000, speedClass: 'VERY_FAST', attack: atk.slash2(1), skill1: skill.blinkStrike(1), skill2: { ...skill.invis(1), name: '短時間透明化', desc: '2.5秒間透明化し移動速度が上がる。攻撃で解除。', ops: [{ op: 'invis', duration: 2.5 }, { op: 'buff', status: { kind: 'haste', duration: 2.5, power: 0.15 } }] },
      ult: ult.shadowBarrage(1), passive: passive('backstab', 0.3), ultCharge: 3600, difficulty: 3, color: '#8b5cf6',
      combo: '透明化で接近 → 背後から二連斬り → 瞬間移動斬りで追撃。', tactics: '透明化で背後を取り、背後攻撃ボーナスで低HPの射手を狩る。',
    },
    TITAN: {
      hp: 6000, speedClass: 'SLOW', attack: atk.bigSword(1), skill1: skill.slam(1), skill2: skill.shieldSelf(1), ult: ult.bigQuake(1),
      passive: passive('lowHpDefense', 0.3, 0.4), ultCharge: 4400, difficulty: 1, color: '#f97316',
      combo: '防御壁で接近 → 地面叩きつけで減速 → 巨大剣で追撃 → 大地震で一網打尽。', tactics: '前線を押し上げ、密集した敵に大地震を叩き込む。',
    },
    FROST: {
      hp: 3500, speedClass: 'NORMAL', attack: { ...atk.rifle(450 / 480), name: '氷弾', element: 'ice', radius: 10, speed: 14 }, skill1: skill.iceLance(1), skill2: skill.frostField(1), ult: ult.iceNova(1),
      passive: passive('frostStacks', 4), ultCharge: 3800, difficulty: 2, color: '#38bdf8',
      combo: '氷弾×3で冷気蓄積 → 凍結 → 氷の槍で追撃。', tactics: '凍結フィールドで退路を塞ぎ、氷蓄積で凍結を狙う。',
    },
    VOLT: {
      hp: 3200, speedClass: 'FAST', attack: atk.burst3(1), skill1: skill.pierceShot(1), skill2: skill.backstep(1), ult: ult.bulletStorm(1),
      passive: passive('hitStreakAtkSpeed', 0.06, 5), ultCharge: 4000, difficulty: 2, color: '#facc15',
      combo: '連射弾を当て続け加速 → 貫通弾で止め → 接近されたら後退射撃。', tactics: '連続命中で攻撃速度を最大まで上げ、弾幕で押し切る。',
    },
    BLAZE: {
      hp: 4200, speedClass: 'FAST', attack: { ...atk.fist3(1), element: 'fire' }, skill1: skill.dashPunch(1), skill2: skill.uppercut(1), ult: ult.flameCombo(1),
      passive: passive('comboDamage', 0.05, 8), ultCharge: 3800, difficulty: 3, color: '#ef4444',
      combo: '突進パンチ → 拳三連撃 → 打ち上げ → 拳三連撃 → 炎の連続コンボ。', tactics: '打ち上げで拘束してコンボを継続し、火力を上げ続ける。',
    },
    AETHER: {
      hp: 3800, speedClass: 'NORMAL', attack: atk.orb(1), skill1: skill.healWave(1), skill2: skill.reflectBarrier(1), ult: ult.sanctuary(1),
      passive: passive('healCharge', 0.6), ultCharge: 4200, difficulty: 2, color: '#fde68a',
      combo: '反射バリアで射撃を返す → 回復波で立て直す → 範囲回復と強化で逆転。', tactics: '味方の後方から光弾で援護し、回復で必殺を回す。',
    },
  };
}

function parseSig(sig: string) {
  const [a, s1, s2, u, pas] = sig.split(',');
  const [ptype, p1, p2] = pas.split(':');
  return { a: a as AtkKey, s1, s2, u, ptype: ptype as PassiveType, p1: Number(p1), p2: p2 !== undefined ? Number(p2) : undefined };
}

function vary(ab0: AbilityDef, rng: Rng): AbilityDef {
  return { ...ab0, cooldown: Math.round(ab0.cooldown * rng.range(0.92, 1.08) * 10) / 10 };
}

function build(): CharacterDef[] {
  const done = complete();
  return ROSTER.map(([id, key, mechanic, sigKey]) => {
    const category = categoryOf(id);
    const C = CAT[category];
    const rng = new Rng(hashStr(key) ^ id);
    const base: CharacterDef = {
      id, key, name: key, category, combatType: C.type, role: C.role, mechanic,
      hp: Math.round(rng.range(C.hp[0], C.hp[1]) / 100) * 100,
      speedClass: rng.pick(C.speeds),
      attack: atk.rifle(1), skill1: skill.haste(1), skill2: skill.haste(1), ult: ult.meteor(1),
      ultCharge: Math.round(rng.range(3600, 4600) / 100) * 100,
      passive: passive('ambush', 0.2),
      combo: '', strongVs: C.strong, weakVs: C.weak, weakness: C.weakness,
      difficulty: rng.int(C.diff[0], C.diff[1]) as CharacterDef['difficulty'],
      tactics: C.tactics, color: PALETTE[id % PALETTE.length], status: 'prototype',
    };
    const hand = done[key];
    if (hand) {
      return { ...base, ...hand, status: 'complete' } as CharacterDef;
    }
    const sig = SIGS[sigKey];
    if (!sig) throw new Error(`Missing sig for ${key}`);
    const p = parseSig(sig);
    const d = C.dmg * rng.range(0.92, 1.08);
    const s1f = skill[p.s1], s2f = skill[p.s2], uf = ult[p.u];
    if (!atk[p.a] || !s1f || !s2f || !uf) throw new Error(`Bad sig for ${key}: ${sig}`);
    const attack = scaleAttack(atk[p.a](1), d);
    const s1 = vary(s1f(d), rng), s2 = vary(s2f(d), rng), u = uf(d);
    return {
      ...base, attack, skill1: s1, skill2: s2, ult: u,
      passive: passive(p.ptype, p.p1, p.p2),
      combo: `${s1.name} → ${attack.name} → ${s2.name} → ${u.name}`,
      note: `固有メカニクス「${mechanic}」をプリセット構成で表現した試作キット。専用モーション・専用演出は未実装。`,
    };
  });
}

export const CHARACTERS: CharacterDef[] = build();
export const CHAR_BY_ID = new Map(CHARACTERS.map(c => [c.id, c]));
export const CHAR_BY_KEY = new Map(CHARACTERS.map(c => [c.key, c]));
export const STARTER_IDS = [1, 31, 61, 62, 91, 151];
export function getChar(id: number): CharacterDef { const c = CHAR_BY_ID.get(id); if (!c) throw new Error('char ' + id); return c; }
export { CATEGORY_INFO, ab };
