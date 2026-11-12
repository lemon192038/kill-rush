import { Rng } from '../core/rng';
import { ECONOMY, GACHA, type GachaKind } from '../data/config';
import { CHARACTERS } from '../data/characters';
import { GEAR_BY_ID, type GearKey } from '../data/gears';
import { SKINS, SKIN_BY_ID, RARITIES, type Rarity, defaultSkinId } from '../data/skins';
import { BACKGROUNDS, ptRewardBackground } from '../data/backgrounds';
import type { SaveData } from './save';

export type TxResult = { ok: true; msg: string } | { ok: false; msg: string };

// ───── Gears ─────
export function buyGear(s: SaveData, gearId: string): TxResult {
  const g = GEAR_BY_ID.get(gearId);
  if (!g) return { ok: false, msg: '存在しないギアです。' };
  if (!s.unlockedChars.includes(g.charId)) return { ok: false, msg: 'キャラクターが未解放です。' };
  if (s.ownedGears.includes(gearId)) return { ok: false, msg: '購入済みです。' };
  if (s.coins < g.price) return { ok: false, msg: `コインが不足しています（${s.coins}/${g.price}）。` };
  s.coins -= g.price; s.ownedGears.push(gearId);
  return { ok: true, msg: `${g.name} を購入しました。` };
}
export function equipGear(s: SaveData, charId: number, key: GearKey): TxResult {
  const id = `${charId}:${key}`;
  if (!s.ownedGears.includes(id)) return { ok: false, msg: '未所持のギアです。' };
  const cur = s.equippedGears[charId] ?? [];
  if (cur.includes(key)) return { ok: false, msg: '装備中です。' };
  if (cur.length >= ECONOMY.maxEquippedGears) return { ok: false, msg: `同時装備は最大${ECONOMY.maxEquippedGears}つです。` };
  s.equippedGears[charId] = [...cur, key];
  return { ok: true, msg: '装備しました。' };
}
export function unequipGear(s: SaveData, charId: number, key: GearKey): TxResult {
  s.equippedGears[charId] = (s.equippedGears[charId] ?? []).filter(k => k !== key);
  return { ok: true, msg: '外しました。' };
}

// ───── Skins ─────
export function buySkin(s: SaveData, skinId: string): TxResult {
  const sk = SKIN_BY_ID.get(skinId);
  if (!sk) return { ok: false, msg: '存在しないスキンです。' };
  if (s.ownedSkins.includes(skinId)) return { ok: false, msg: '所持済みです。' };
  if (!s.unlockedChars.includes(sk.charId)) return { ok: false, msg: 'キャラクターが未解放です。' };
  if (s.credits < sk.price) return { ok: false, msg: `クレジットが不足しています（${s.credits}/${sk.price}）。` };
  s.credits -= sk.price; s.ownedSkins.push(skinId);
  return { ok: true, msg: `${sk.name} を購入しました。` };
}
export function equipSkin(s: SaveData, skinId: string): TxResult {
  const sk = SKIN_BY_ID.get(skinId);
  if (!sk || !s.ownedSkins.includes(skinId)) return { ok: false, msg: '未所持です。' };
  s.equippedSkin[sk.charId] = skinId; return { ok: true, msg: '装備しました。' };
}

// ───── Characters ─────
export function grantCharacter(s: SaveData, charId: number): { duplicate: boolean } {
  if (s.unlockedChars.includes(charId)) { s.charPoints += ECONOMY.duplicateCharPoints; return { duplicate: true }; }
  s.unlockedChars.push(charId);
  const sk = defaultSkinId(charId);
  if (!s.ownedSkins.includes(sk)) s.ownedSkins.push(sk);
  s.equippedSkin[charId] = sk;
  return { duplicate: false };
}
export function unlockWithPoints(s: SaveData, charId: number): TxResult {
  if (s.unlockedChars.includes(charId)) return { ok: false, msg: '解放済みです。' };
  if (s.charPoints < ECONOMY.charUnlockPoints) return { ok: false, msg: `キャラクターポイントが不足（${s.charPoints}/${ECONOMY.charUnlockPoints}）。` };
  s.charPoints -= ECONOMY.charUnlockPoints; grantCharacter(s, charId);
  return { ok: true, msg: '解放しました！' };
}

// ───── Gacha ─────
export interface GachaReward { type: 'character' | 'skin' | 'credits' | 'coins' | 'background' | 'charPoints'; id?: string | number; amount?: number; label: string; rarity?: Rarity | 'CHAR'; duplicate?: boolean }

export function canOpen(s: SaveData, kind: GachaKind, count: number, now = Date.now()): TxResult {
  const g = GACHA.find(x => x.kind === kind)!;
  if (count > 1 && !g.allowTen) return { ok: false, msg: '10連はできません。' };
  switch (g.cost.type) {
    case 'victoryRight': return s.victoryRights >= count ? { ok: true, msg: '' } : { ok: false, msg: 'ヴィクトリーボックス権が足りません（通常対戦で勝利すると獲得）。' };
    case 'missionRight': return s.missionRights >= count ? { ok: true, msg: '' } : { ok: false, msg: 'ミッションボックス権が足りません。' };
    case 'credits': return s.credits >= g.cost.amount * count ? { ok: true, msg: '' } : { ok: false, msg: 'クレジットが足りません。' };
    case 'free': return now - s.lastFreeBox >= (g.freeIntervalHours ?? 24) * 3600e3 ? { ok: true, msg: '' } : { ok: false, msg: `次の無料開封まで ${Math.ceil(((g.freeIntervalHours ?? 24) * 3600e3 - (now - s.lastFreeBox)) / 60000)} 分` };
  }
}

export function openGacha(s: SaveData, kind: GachaKind, count: number, rng: Rng, now = Date.now()): { ok: boolean; msg: string; rewards: GachaReward[] } {
  const chk = canOpen(s, kind, count, now);
  if (!chk.ok) return { ok: false, msg: chk.msg, rewards: [] };
  const g = GACHA.find(x => x.kind === kind)!;
  if (g.cost.type === 'victoryRight') s.victoryRights -= count;
  else if (g.cost.type === 'missionRight') s.missionRights -= count;
  else if (g.cost.type === 'credits') s.credits -= g.cost.amount * count;
  else s.lastFreeBox = now;
  const rewards: GachaReward[] = [];
  for (let i = 0; i < count; i++) {
    // VICTORY: independent coin roll (high probability)
    if (kind === 'VICTORY' && rng.chance(ECONOMY.victoryBox.coinChance)) { s.coins += ECONOMY.victoryBox.coinAmount; rewards.push({ type: 'coins', amount: ECONOMY.victoryBox.coinAmount, label: `🪙 コイン ×${ECONOMY.victoryBox.coinAmount}` }); }
    const pity = (s.gachaPity[kind] ?? 0) + 1;
    let cat = rng.weighted(['character', 'skin', 'credits', 'background'] as const, [g.weights.character, g.weights.skin, g.weights.credits, g.weights.background]);
    if (pity >= g.pity) cat = 'character';
    if (cat === 'character') {
      s.gachaPity[kind] = 0;
      const c = rng.pick(CHARACTERS);
      const { duplicate } = grantCharacter(s, c.id);
      rewards.push({ type: 'character', id: c.id, label: duplicate ? `${c.key}（重複→キャラポイント+${ECONOMY.duplicateCharPoints}）` : `NEW! ${c.key}`, rarity: 'CHAR', duplicate });
      continue;
    }
    s.gachaPity[kind] = pity;
    if (cat === 'skin') {
      const rar = rng.weighted(RARITIES, RARITIES.map(r => g.skinRarityWeights[r] ?? 0));
      let pool = SKINS.filter(x => x.gacha && x.rarity === rar);
      if (!pool.length) pool = SKINS.filter(x => x.gacha && x.rarity === 'UNCOMMON'); // COMMON = default skins (not in gacha)
      const sk = rng.pick(pool);
      if (s.ownedSkins.includes(sk.id)) { const cr = ECONOMY.duplicateSkinCredits[sk.rarity]; s.credits += cr; rewards.push({ type: 'credits', amount: cr, label: `${sk.name}（重複→クレジット+${cr}）`, rarity: sk.rarity, duplicate: true }); }
      else { s.ownedSkins.push(sk.id); rewards.push({ type: 'skin', id: sk.id, label: `${sk.name}${s.unlockedChars.includes(sk.charId) ? '' : '（キャラ未解放）'}`, rarity: sk.rarity }); }
    } else if (cat === 'background') {
      const pool = BACKGROUNDS.filter(b => b.gacha && b.category === 'collection'); // championship backgrounds are never in gacha
      const b = rng.pick(pool);
      if (s.ownedBackgrounds.includes(b.id)) { s.credits += 60; rewards.push({ type: 'credits', amount: 60, label: `背景「${b.name}」（重複→クレジット+60）`, duplicate: true }); }
      else { s.ownedBackgrounds.push(b.id); rewards.push({ type: 'background', id: b.id, label: `背景「${b.name}」` }); }
    } else {
      const amt = rng.int(g.creditRange[0], g.creditRange[1]);
      s.credits += amt; rewards.push({ type: 'credits', amount: amt, label: `💳 クレジット ×${amt}` });
    }
  }
  return { ok: true, msg: '', rewards };
}

// ───── PT backgrounds ─────
export function grantPtBackgrounds(s: SaveData): string[] {
  const got: string[] = [];
  const n = Math.floor(s.cumulativePt / 1000);
  for (let i = 1; i <= n; i++) { const b = ptRewardBackground(i); if (!s.ownedBackgrounds.includes(b.id)) { s.ownedBackgrounds.push(b.id); got.push(b.name); } }
  return got;
}
