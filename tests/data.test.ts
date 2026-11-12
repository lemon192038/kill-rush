import { describe, it, expect } from 'vitest';
import { CHARACTERS } from '../src/data/characters';
import { SKINS, THEMES, validateSkins, RARITIES } from '../src/data/skins';
import { GEARS } from '../src/data/gears';
import { validateData } from '../src/data/validate';
import { BACKGROUNDS } from '../src/data/backgrounds';
import { GACHA } from '../src/data/config';
import { MODES } from '../src/data/modes';
import { loadMap, MAPS, T } from '../src/data/maps';

describe('data integrity', () => {
  it('200 characters with unique ids/keys and full kits', () => {
    expect(CHARACTERS).toHaveLength(200);
    expect(new Set(CHARACTERS.map(c => c.id)).size).toBe(200);
    expect(new Set(CHARACTERS.map(c => c.key)).size).toBe(200);
    for (const c of CHARACTERS) { expect(c.skill1.ops.length).toBeGreaterThan(0); expect(c.skill2.ops.length).toBeGreaterThan(0); expect(c.ult.ops.length).toBeGreaterThan(0); expect(c.passive.desc.length).toBeGreaterThan(0); }
  });
  it('6 hand-tuned complete characters, others marked prototype', () => {
    const done = CHARACTERS.filter(c => c.status === 'complete').map(c => c.key).sort();
    expect(done).toEqual(['AETHER', 'BLAZE', 'FROST', 'SHADOW', 'TITAN', 'VOLT']);
  });
  it('initial stats match spec for the 6 starters', () => {
    const by = (k: string) => CHARACTERS.find(c => c.key === k)!;
    expect(by('SHADOW').hp).toBe(3000); expect(by('SHADOW').attack.damage).toBe(350); expect(by('SHADOW').attack.count).toBe(2);
    expect(by('TITAN').hp).toBe(6000); expect(by('TITAN').attack.damage).toBe(700);
    expect(by('FROST').hp).toBe(3500); expect(Math.round(by('FROST').attack.damage)).toBe(450);
    expect(by('VOLT').hp).toBe(3200); expect(by('VOLT').attack.damage).toBe(250); expect(by('VOLT').attack.count).toBe(3);
    expect(by('BLAZE').hp).toBe(4200); expect(by('BLAZE').attack.count).toBe(3);
    expect(by('AETHER').hp).toBe(3800); expect(by('AETHER').attack.damage).toBe(400);
  });
  it('every prototype kit composition is unique', () => {
    const sig = (c: typeof CHARACTERS[number]) => `${c.attack.name}|${c.skill1.name}|${c.skill2.name}|${c.ult.name}|${c.passive.type}`;
    expect(new Set(CHARACTERS.map(sig)).size).toBe(200);
  });
  it('validators report no issues', () => {
    expect(validateSkins()).toEqual([]);
    expect(validateData()).toEqual([]);
  });
  it('1400 skins, 7 rarities each, >=467 themes, max 3 uses per theme', () => {
    expect(SKINS.length).toBe(1400);
    expect(THEMES.length).toBeGreaterThanOrEqual(467);
    const use = new Map<number, number>(); for (const s of SKINS) use.set(s.themeId, (use.get(s.themeId) ?? 0) + 1);
    expect(Math.max(...use.values())).toBeLessThanOrEqual(3);
    expect(use.size).toBeGreaterThanOrEqual(467);
    for (const c of CHARACTERS) expect(new Set(SKINS.filter(s => s.charId === c.id).map(s => s.rarity)).size).toBe(RARITIES.length);
  });
  it('skins carry no stat fields (no performance difference)', () => {
    for (const s of SKINS) for (const k of ['hp', 'damage', 'speed', 'stats', 'power']) expect(k in s).toBe(false);
  });
  it('1400 gears at 1000 coins (6 common + 1 unique per character)', () => {
    expect(GEARS).toHaveLength(1400);
    expect(new Set(GEARS.map(g => g.id)).size).toBe(1400);
    expect(GEARS.every(g => g.price === 1000)).toBe(true);
  });
  it('championship backgrounds are never in gacha', () => {
    expect(BACKGROUNDS.filter(b => b.category === 'championship').every(b => !b.gacha)).toBe(true);
    expect(BACKGROUNDS.filter(b => b.category === 'collection')).toHaveLength(24);
  });
  it('8 gacha kinds', () => { expect(GACHA.map(g => g.kind)).toEqual(['VICTORY', 'MISSION', 'CHARACTER', 'SKIN', 'LEGENDARY', 'EVENT', 'SEASON', 'FREE']); });
  it('modes reference existing maps; 12 team maps + 4 soccer maps', () => {
    for (const m of MODES) for (const id of m.maps) expect(MAPS.some(x => x.id === id)).toBe(true);
    const team = ['gem', 'deathmatch', 'vault', 'territory'].flatMap(id => MODES.find(m => m.id === id)!.maps);
    expect(new Set(team).size).toBe(12);
    expect(MODES.find(m => m.id === 'goal')!.maps).toHaveLength(4);
  });
  it('all maps generate with walkable floor and bushes', () => {
    for (const m of MAPS) { const d = loadMap(m.id); const n = (t: number) => d.tiles.filter(x => x === t).length; expect(n(T.FLOOR)).toBeGreaterThan(50); if (m.kind !== 'soccer') expect(n(T.BUSH)).toBeGreaterThan(0); }
  });
});
