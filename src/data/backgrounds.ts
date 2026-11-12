export type BgCategory = 'collection' | 'ptReward' | 'championship' | 'event' | 'special';
export interface BackgroundDef { id: string; name: string; category: BgCategory; css: string; gacha: boolean; unlockPt?: number; band?: number }

const COLL: [string, string][] = [
  ['ネオン街路', 'linear-gradient(135deg,#1a0033,#ff2fd6 60%,#2ef7ff)'], ['古代遺跡の夕暮れ', 'linear-gradient(160deg,#3b1d0a,#d97706 55%,#fde68a)'],
  ['深緑の森', 'linear-gradient(160deg,#052e16,#16a34a 60%,#bbf7d0)'], ['灼熱火山', 'radial-gradient(circle at 70% 80%,#fb923c,#7f1d1d 55%,#1c0606)'],
  ['氷河の夜明け', 'linear-gradient(180deg,#0c4a6e,#7dd3fc 60%,#f0f9ff)'], ['宇宙ステーション', 'radial-gradient(circle at 30% 30%,#6366f1,#0f0a1f 70%)'],
  ['桜吹雪', 'linear-gradient(135deg,#fbcfe8,#f472b6 50%,#831843)'], ['砂漠の蜃気楼', 'linear-gradient(180deg,#fde68a,#d6a35c 50%,#7c2d12)'],
  ['電脳グリッド', 'repeating-linear-gradient(90deg,#0f172a 0 18px,#0ea5e9 18px 20px),#0f172a'], ['深海神殿', 'radial-gradient(circle at 50% 0%,#22d3ee,#1e3a8a 50%,#020617)'],
  ['黄金闘技場', 'linear-gradient(135deg,#78350f,#fbbf24 50%,#fef3c7)'], ['紫電の嵐', 'linear-gradient(135deg,#2e1065,#7c3aed 45%,#fef08a 50%,#2e1065 55%)'],
  ['毒沼', 'radial-gradient(circle at 40% 60%,#a3e635,#1a2e05 70%)'], ['月光の城', 'linear-gradient(180deg,#1e1b4b,#475569 60%,#e2e8f0)'],
  ['アーケード', 'repeating-conic-gradient(#1e1b4b 0 25%,#312e81 0 50%) 0 0/40px 40px'], ['朱の鳥居', 'linear-gradient(180deg,#450a0a,#dc2626 50%,#fbbf24)'],
  ['極光', 'linear-gradient(160deg,#022c22,#10b981 40%,#a78bfa 70%,#0f172a)'], ['スチーム工場', 'linear-gradient(135deg,#292524,#b45309 60%,#fde68a)'],
  ['キャンディランド', 'linear-gradient(135deg,#a7f3d0,#f9a8d4 50%,#c4b5fd)'], ['星雲', 'radial-gradient(circle at 60% 40%,#f0abfc,#8b5cf6 30%,#0f0a1f 70%)'],
  ['廃都', 'linear-gradient(180deg,#1f2937,#4b5563 60%,#9ca3af)'], ['雷雲の頂', 'linear-gradient(180deg,#0f172a,#1e40af 60%,#93c5fd)'],
  ['水晶洞窟', 'radial-gradient(circle at 50% 50%,#67e8f9,#164e63 60%,#082f49)'], ['不死鳥の炎', 'radial-gradient(circle at 50% 100%,#fde047,#f97316 35%,#450a0a 75%)'],
];
const PT_NAMES = ['ブロンズアリーナ', 'シルバー', 'ゴールド', 'プラチナ', 'ダイヤモンド', 'エリート', 'マスター', 'レジェンド', 'チャンピオン', 'インモータル'];
const PT_CSS = ['#b45309', '#9ca3af', '#fbbf24', '#67e8f9', '#60a5fa', '#a78bfa', '#f472b6', '#f97316', '#ef4444', '#fde047'];
export const BAND_NAMES = ['初心者', '見習い', '中級者', '上級者', '精鋭', '熟練', '伝説', 'プロ', 'キング'];
const BAND_CSS = ['#64748b', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f97316', '#ef4444', '#fbbf24'];

/** Normal-PT cumulative reward background for any threshold (extensible every 1000 PT). */
export function ptRewardBackground(n: number): BackgroundDef {
  const i = n - 1;
  const name = i < PT_NAMES.length ? PT_NAMES[i] : `インモータル+${i - PT_NAMES.length + 1}`;
  const col = PT_CSS[Math.min(i, PT_CSS.length - 1)];
  return { id: `pt-${n * 1000}`, name, category: 'ptReward', unlockPt: n * 1000, gacha: false, css: `radial-gradient(circle at 50% 30%,${col},#0b0b14 75%)` };
}

export const BACKGROUNDS: BackgroundDef[] = [
  ...COLL.map(([name, css], i) => ({ id: `col-${i + 1}`, name, css, category: 'collection' as const, gacha: true })),
  ...Array.from({ length: 10 }, (_, i) => ptRewardBackground(i + 1)),
  ...BAND_NAMES.map((name, b) => ({ id: `champ-${b}`, name: `${name}の紋章`, band: b, category: 'championship' as const, gacha: false, css: `conic-gradient(from 200deg at 50% 50%,${BAND_CSS[b]},#0b0b14,${BAND_CSS[b]})` })),
  { id: 'event-launch', name: 'ローンチ記念', category: 'event', gacha: false, css: 'linear-gradient(135deg,#ff2fd6,#fbbf24,#2ef7ff)' },
  { id: 'special-founder', name: '創設者', category: 'special', gacha: false, css: 'linear-gradient(135deg,#0b0b14,#fbbf24 50%,#0b0b14)' },
];
export const BG_BY_ID = new Map(BACKGROUNDS.map(b => [b.id, b]));
export function getBackground(id: string): BackgroundDef | undefined {
  const m = /^pt-(\d+)$/.exec(id);
  if (m) return ptRewardBackground(Number(m[1]) / 1000);
  return BG_BY_ID.get(id);
}
export const DEFAULT_BG = 'col-1';

export const TITLES = ['ルーキー', '草むらの影', '一撃必殺', '鉄壁', '弾幕職人', 'コンボ中毒', '逆転の鬼', '静かな狙撃手', '戦場の支配者', 'チームの盾', '金庫破り', 'ジェムコレクター', 'ゴールゲッター', '王者', '不死身', '狩人'];

/** Championship ranks: 27 tiers of 333 pt. */
export function champRank(rating: number): { band: number; level: number; index: number; name: string } {
  const index = Math.min(26, Math.max(0, Math.floor(rating / 333)));
  const band = Math.floor(index / 3), level = index % 3;
  return { band, level, index, name: `${BAND_NAMES[band]}${['I', 'II', 'III'][level]}` };
}
export function champRankRange(index: number): [number, number] { return [index * 333, index === 26 ? Infinity : index * 333 + 332]; }
