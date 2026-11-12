import { describe, it, expect } from 'vitest';
import { defaultSave } from '../src/meta/save';
import { buyGear, equipGear, buySkin, openGacha, canOpen } from '../src/meta/economy';
import { Rng } from '../src/core/rng';

describe('gears', () => {
  it('requires 1000 coins, prevents double purchase', () => {
    const s = defaultSave();
    expect(buyGear(s, '1:DAMAGE').ok).toBe(false);
    s.coins = 2500;
    expect(buyGear(s, '1:DAMAGE').ok).toBe(true); expect(s.coins).toBe(1500);
    expect(buyGear(s, '1:DAMAGE').ok).toBe(false); expect(s.coins).toBe(1500);
    expect(buyGear(s, '2:DAMAGE').ok).toBe(false); // locked character
  });
  it('max 2 equipped and must be owned', () => {
    const s = defaultSave(); s.coins = 5000;
    expect(equipGear(s, 1, 'SPEED').ok).toBe(false);
    for (const k of ['SPEED', 'SHIELD', 'VISION'] as const) buyGear(s, `1:${k}`);
    expect(equipGear(s, 1, 'SPEED').ok).toBe(true); expect(equipGear(s, 1, 'SHIELD').ok).toBe(true); expect(equipGear(s, 1, 'VISION').ok).toBe(false);
    expect(equipGear(s, 1, 'SPEED').ok).toBe(false);
    expect(s.equippedGears[1]).toEqual(['SPEED', 'SHIELD']);
  });
});
describe('skins', () => {
  it('purchase deducts credits once', () => {
    const s = defaultSave(); s.credits = 1500;
    expect(buySkin(s, '1-1').ok).toBe(true); expect(s.credits).toBe(500);
    expect(buySkin(s, '1-1').ok).toBe(false); expect(s.credits).toBe(500);
    expect(buySkin(s, '1-6').ok).toBe(false);
  });
});
describe('gacha', () => {
  it('victory box consumes rights and yields coins ~90% of the time', () => {
    const s = defaultSave(); s.victoryRights = 1000; const rng = new Rng(42);
    let coinHits = 0;
    for (let i = 0; i < 100; i++) { const r = openGacha(s, 'VICTORY', 10, rng); coinHits += r.rewards.filter(x => x.type === 'coins').length; }
    expect(s.victoryRights).toBe(0);
    expect(coinHits / 1000).toBeGreaterThan(0.85); expect(coinHits / 1000).toBeLessThan(0.95);
    expect(s.coins).toBe(coinHits * 10);
  });
  it('cannot open without rights; free box has cooldown', () => {
    const s = defaultSave(); s.victoryRights = 0;
    expect(openGacha(s, 'VICTORY', 1, new Rng(1)).ok).toBe(false);
    expect(openGacha(s, 'FREE', 1, new Rng(1), 1e12).ok).toBe(true);
    expect(canOpen(s, 'FREE', 1, 1e12 + 1000).ok).toBe(false);
    expect(canOpen(s, 'FREE', 1, 1e12 + 25 * 3600e3).ok).toBe(true);
  });
  it('pity guarantees a character, duplicates convert to character points', () => {
    const s = defaultSave(); s.credits = 1e7;
    const r = openGacha(s, 'CHARACTER', 10, new Rng(3));
    expect(r.rewards.some(x => x.type === 'character')).toBe(true);
    const all = defaultSave(); all.unlockedChars = Array.from({ length: 200 }, (_, i) => i + 1); all.credits = 1e7;
    openGacha(all, 'CHARACTER', 10, new Rng(5)); expect(all.charPoints).toBeGreaterThan(0);
  });
  it('gacha never awards championship backgrounds', () => {
    const s = defaultSave(); s.credits = 1e8;
    for (let i = 0; i < 50; i++) openGacha(s, 'SEASON', 10, new Rng(i));
    expect(s.ownedBackgrounds.some(b => b.startsWith('champ-'))).toBe(false);
  });
});
