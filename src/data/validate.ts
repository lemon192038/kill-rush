import { CHARACTERS } from './characters';
import { GEARS } from './gears';
import { MAPS } from './maps';
import { MODES } from './modes';
import type { ValidationIssue } from './skins';
import { SIGS } from './sigs';

/** Validates character / gear / map / mode data integrity. */
export function validateData(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<number>(), keys = new Set<string>();
  for (const c of CHARACTERS) {
    if (ids.has(c.id)) issues.push({ kind: 'char-dup-id', detail: String(c.id) }); ids.add(c.id);
    if (keys.has(c.key)) issues.push({ kind: 'char-dup-key', detail: c.key }); keys.add(c.key);
    const nums = [c.hp, c.attack.damage, c.attack.range, c.attack.ammo, c.attack.reload, c.ultCharge, c.skill1.cooldown, c.skill2.cooldown];
    if (nums.some(n => !Number.isFinite(n) || n <= 0)) issues.push({ kind: 'char-bad-number', detail: c.key });
    if (c.hp < 2000 || c.hp > 8000) issues.push({ kind: 'char-hp-range', detail: c.key });
  }
  if (CHARACTERS.length !== 200) issues.push({ kind: 'char-count', detail: String(CHARACTERS.length) });
  const kits = new Set(Object.values(SIGS));
  if (kits.size !== Object.keys(SIGS).length) issues.push({ kind: 'kit-dup', detail: 'duplicate prototype kit composition' });
  const gids = new Set<string>();
  for (const g of GEARS) { if (gids.has(g.id)) issues.push({ kind: 'gear-dup', detail: g.id }); gids.add(g.id); if (g.price !== 1000) issues.push({ kind: 'gear-price', detail: g.id }); }
  if (GEARS.length !== 1400) issues.push({ kind: 'gear-count', detail: String(GEARS.length) });
  const uniq = new Set(GEARS.filter(g => g.key === 'UNIQUE').map(g => g.name));
  if (uniq.size !== 200) issues.push({ kind: 'unique-gear-names', detail: String(uniq.size) });
  const mapIds = new Set(MAPS.map(m => m.id));
  for (const m of MODES) for (const mp of m.maps) if (!mapIds.has(mp)) issues.push({ kind: 'mode-map-missing', detail: `${m.id}:${mp}` });
  return issues;
}
