import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld, computeVisibility } from '../src/sim/world';
import { buildMatch } from '../src/meta/match';
import { defaultSave } from '../src/meta/save';
import { T } from '../src/data/maps';
import { TILE } from '../src/core/constants';
import { damageFighter } from '../src/sim/combat';
import { tryAttack, tryAbility } from '../src/sim/abilities';
import { applyCubeStats } from '../src/sim/fighter';
import type { World, Fighter } from '../src/sim/types';
import { autoplay } from './helpers';

function sandbox(mode: 'ffa' | 'tdm' = 'ffa', seed = 3): World {
  const s = defaultSave();
  const m = buildMatch(s, mode, { seed, practice: mode === 'ffa' });
  for (const r of m.cfg.roster) r.cpu = null;
  const w = createWorld(m.cfg);
  // park everyone far apart
  w.fighters.forEach((f, i) => { const p = freeTile(w, i * 7 + 3); f.x = p.x; f.y = p.y; f.spawnProtectT = 0; });
  return w;
}
function freeTile(w: World, skip: number) { let n = 0; for (let i = 0; i < w.map.tiles.length; i++) if (w.map.tiles[i] === T.FLOOR && n++ >= skip * 9) return { x: (i % w.map.w) * TILE + 32, y: Math.floor(i / w.map.w) * TILE + 32 }; return { x: 100, y: 100 }; }
function bushTile(w: World) { for (let y = 2; y < w.map.h - 2; y++) for (let x = 2; x < w.map.w - 2; x++) { const i = y * w.map.w + x; if ([0, 1, -1].every(d => w.map.tiles[i + d] === T.BUSH)) return { x: x * TILE + 32, y: y * TILE + 32 }; } throw new Error('no bush'); }
const idx = (w: World, f: Fighter) => w.fighters.indexOf(f);
const run = (w: World, n: number) => { for (let i = 0; i < n; i++) { stepWorld(w); w.events.length = 0; } };

describe('bush stealth', () => {
  it('hidden from distant enemies, visible to allies/self; proximity reveals', () => {
    const w = sandbox(); const [a, b] = w.fighters; const bush = bushTile(w);
    a.x = bush.x; a.y = bush.y; b.x = bush.x + 6 * TILE; b.y = bush.y;
    run(w, 2);
    if (b.inBush) { b.x = bush.x; b.y = bush.y + 7 * TILE; run(w, 2); }
    expect(a.inBush).toBe(true);
    expect(w.visibility[b.team][idx(w, a)]).toBe(0);
    expect(w.visibility[a.team][idx(w, a)]).toBe(1);
    b.x = a.x + TILE * 1.5; b.y = a.y; run(w, 1);
    expect(w.visibility[b.team][idx(w, a)]).toBe(1);
  });
  it('attacking reveals for 1.5s, then re-hides 0.5s after while staying in bush', () => {
    const w = sandbox(); const [a, b] = w.fighters; const bush = bushTile(w);
    a.x = bush.x; a.y = bush.y; b.x = a.x + 9 * TILE; b.y = a.y; run(w, 2);
    expect(w.visibility[b.team][idx(w, a)]).toBe(0);
    expect(tryAttack(w, a, 0)).toBe(true); run(w, 1);
    expect(w.visibility[b.team][idx(w, a)]).toBe(1);
    run(w, Math.round(1.4 * 60)); expect(w.visibility[b.team][idx(w, a)]).toBe(1);
    run(w, Math.round(0.2 * 60)); expect(w.visibility[b.team][idx(w, a)]).toBe(1); // revealed timer over but 0.5s re-hide wait
    run(w, Math.round(0.5 * 60)); expect(w.visibility[b.team][idx(w, a)]).toBe(0);
  });
  it('taking damage reveals; area reveal zone exposes hidden enemies', () => {
    const w = sandbox(); const [a, b] = w.fighters; const bush = bushTile(w);
    a.x = bush.x; a.y = bush.y; b.x = a.x + 9 * TILE; b.y = a.y; run(w, 2);
    damageFighter(w, b, a, 100, { kind: 'attack' }); computeVisibility(w);
    expect(w.visibility[b.team][idx(w, a)]).toBe(1);
    run(w, 120); expect(w.visibility[b.team][idx(w, a)]).toBe(0);
    w.revealZones.push({ team: b.team, x: a.x, y: a.y, r: 100, t: 1 }); computeVisibility(w);
    expect(w.visibility[b.team][idx(w, a)]).toBe(1);
  });
  it('VISION gear reveals the damaged enemy for 2s', () => {
    const w = sandbox(); const [a, b] = w.fighters; const bush = bushTile(w);
    b.gears.add('VISION'); a.x = bush.x; a.y = bush.y; b.x = a.x + 9 * TILE; b.y = a.y; run(w, 2);
    damageFighter(w, b, a, 10, { kind: 'dot' }); run(w, 70);
    expect(w.visibility[b.team][idx(w, a)]).toBe(1);
    run(w, 80); expect(w.visibility[b.team][idx(w, a)]).toBe(0);
  });
});

describe('combat rules', () => {
  it('ammo is consumed and reloads automatically; no attack at 0 ammo but skills still work', () => {
    const w = sandbox(); const a = w.fighters[0];
    for (let i = 0; i < 3; i++) { expect(tryAttack(w, a, 0)).toBe(true); a.lock = 0; }
    expect(a.ammo).toBe(0); expect(tryAttack(w, a, 0)).toBe(false);
    expect(tryAbility(w, a, 1, 0, 0)).toBe(true);
    run(w, Math.ceil(a.char.attack.reload * 60) + 30); expect(a.ammo).toBeGreaterThanOrEqual(1);
  });
  it('backstab passive (SHADOW) deals more from behind', () => {
    const w = sandbox(); const a = w.fighters[0], b = w.fighters[1]; expect(a.char.key).toBe('SHADOW');
    b.x = a.x + 50; b.y = a.y; b.facing = 0; // facing away from a (a is at -x)
    const back = damageFighter(w, a, b, 1000, { kind: 'attack' });
    b.hp = b.maxHp; b.facing = Math.PI; b.shield = 0;
    const front = damageFighter(w, a, b, 1000, { kind: 'attack' });
    expect(back).toBeGreaterThan(front);
  });
  it('⚡ multiplies HP/attack by 1.1^n', () => {
    const w = sandbox(); const a = w.fighters[0], b = w.fighters[1]; b.char = { ...b.char, passive: { ...b.char.passive, type: 'ambush' } };
    const base = damageFighter(w, a, b, 1000, { kind: 'dot' }); b.hp = b.maxHp;
    a.cubes = 3; applyCubeStats(a);
    expect(a.maxHp).toBe(Math.round(a.baseMaxHp * 1.331));
    const boosted = damageFighter(w, a, b, 1000, { kind: 'dot' });
    expect(boosted / base).toBeCloseTo(1.331, 1);
  });
  it('SKILL COOLDOWN gear shortens skill cooldown by 15%', () => {
    const w = sandbox(); const a = w.fighters[0];
    tryAbility(w, a, 1, 0, 0); const cd1 = a.cd[0];
    const w2 = sandbox(); const c = w2.fighters[0]; c.gears.add('COOLDOWN'); tryAbility(w2, c, 1, 0, 0);
    expect(c.cd[0]).toBeCloseTo(cd1 * 0.85, 3);
  });
  it('SHIELD gear absorbs damage first', () => {
    const w = sandbox(); const a = w.fighters[0], b = w.fighters[1];
    b.gearShieldMax = b.gearShield = 500; const hp = b.hp;
    damageFighter(w, a, b, 300, { kind: 'dot' }); expect(b.hp).toBe(hp); expect(b.gearShield).toBeLessThan(500);
  });
  it('kills award stats and respawn', () => {
    const w = sandbox(); const a = w.fighters[0], b = w.fighters[1];
    damageFighter(w, a, b, 99999, { kind: 'attack' });
    expect(b.alive).toBe(false); expect(a.stats.kills).toBe(1); expect(b.stats.deaths).toBe(1);
    run(w, 4 * 60); expect(b.alive).toBe(true);
  });
  it('knockback moves the target; teammates cannot be damaged', () => {
    const w = sandbox('tdm'); const a = w.fighters.find(f => f.team === 0)!, mate = w.fighters.find(f => f.team === 0 && f !== a)!, e = w.fighters.find(f => f.team === 1)!;
    expect(damageFighter(w, a, mate, 500, { kind: 'attack' })).toBe(0);
    const x0 = e.x; e.x = x0; damageFighter(w, a, e, 10, { kind: 'attack', kb: 60, dirX: 1, dirY: 0 }); run(w, 10);
    expect(Math.abs(e.x - x0)).toBeGreaterThan(5);
  });
});

describe('determinism & performance', () => {
  it('same seed => identical match', () => {
    const a = autoplay('tdm', 11, 60), b = autoplay('tdm', 11, 60);
    expect(a.w.fighters.map(f => f.stats.damage)).toEqual(b.w.fighters.map(f => f.stats.damage));
  });
  it('20-fighter MEGA BR simulates quickly with bounded entity counts', () => {
    const t0 = performance.now(); const { w, ticks } = autoplay('br-mega', 5, 120);
    const ms = performance.now() - t0;
    expect(ms / ticks).toBeLessThan(4); // well under the 16.6ms frame budget
    expect(w.projectiles.length).toBeLessThan(400);
  }, 60000);
});
