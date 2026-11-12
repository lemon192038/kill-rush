import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { defaultSave, wrap, unwrap, migrate, SaveManager } from '../src/meta/save';

describe('save system', () => {
  it('round-trips with checksum', () => {
    const s = defaultSave(); s.coins = 1234; s.charPt[5] = 77;
    const r = unwrap(wrap(s)); expect(r.corrupt).toBe(false); expect(r.data!.coins).toBe(1234); expect(r.data!.charPt[5]).toBe(77);
  });
  it('detects corruption', () => {
    const w = wrap(defaultSave()).replace('"coins\\":0', '"coins\\":99999');
    expect(unwrap(w).corrupt).toBe(true);
    expect(unwrap('not json').corrupt).toBe(true);
  });
  it('migrates older saves and sanitises values', () => {
    const m = migrate({ version: 1, coins: -50, pt: 'x', unlockedChars: [1, 1, 999], equippedGears: { 1: ['SPEED', 'SPEED', 'SHIELD', 'VISION'] } });
    expect(m.coins).toBe(0); expect(m.pt).toBe(0); expect(m.unlockedChars).toEqual([1]); expect(m.equippedGears[1]).toEqual(['SPEED', 'SHIELD']);
    expect(m.skill.rating).toBeGreaterThan(0); expect(m.settings.keys.up).toBe('KeyW');
  });
  it('persists to IndexedDB and reloads (simulated reload)', async () => {
    const a = new SaveManager(); await a.load(); a.data.coins = 4242; a.data.skill.rating = 1111; a.data.charSkill[1] = { rating: 999, games: 3, wins: 2, losses: 1, pt: 20, sum: a.data.skill.sum };
    await a.flush();
    const b = new SaveManager(); await b.load();
    expect(b.data.coins).toBe(4242); expect(b.data.skill.rating).toBe(1111); expect(b.data.charSkill[1].rating).toBe(999);
  });
  it('export / import code', async () => {
    const a = new SaveManager(); await a.load(); a.data.credits = 777;
    const code = a.exportString();
    const b = new SaveManager(); await b.load(); b.data.credits = 1; expect(b.importString(code)).toBe(true); expect(b.data.credits).toBe(777);
    expect(b.importString('garbage')).toBe(false);
  });
});
