import { CHARACTERS } from './characters';
import { SKIN_PRICES } from './config';

export const RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'SUPER RARE', 'HYPER RARE', 'MYTHIC', 'LEGENDARY'] as const;
export type Rarity = typeof RARITIES[number];
export const RARITY_COLOR: Record<Rarity, string> = {
  COMMON: '#9ca3af', UNCOMMON: '#4ade80', RARE: '#38bdf8', 'SUPER RARE': '#a78bfa', 'HYPER RARE': '#f472b6', MYTHIC: '#f87171', LEGENDARY: '#fbbf24',
};

export type Accessory = 'horns' | 'halo' | 'visor' | 'hood' | 'crown' | 'mask' | 'antenna' | 'ears' | 'crest' | 'spikes' | 'wings' | 'tail' | 'scarf' | 'helmet' | 'goggles' | 'unihorn' | 'flamehair' | 'crystal' | 'orbitals' | 'cape';
export type Pattern = 'plain' | 'stripes' | 'dots' | 'circuit' | 'flames' | 'scales' | 'stars' | 'camo' | 'rings' | 'cracks' | 'waves' | 'checker' | 'runes' | 'hex' | 'drip' | 'bolts' | 'leaves' | 'gems' | 'pixel' | 'swirl' | 'chevron' | 'grid' | 'feathers' | 'sparkle' | 'tribal';

const PREFIXES: { name: string; c: [string, string, string]; pattern: Pattern }[] = [
  { name: 'NEON', c: ['#ff2fd6', '#2a0a3a', '#2ef7ff'], pattern: 'circuit' }, { name: 'SAKURA', c: ['#ffb7d5', '#7a2048', '#fff0f6'], pattern: 'leaves' },
  { name: 'MAGMA', c: ['#ff5a1f', '#3b0d02', '#ffd166'], pattern: 'cracks' }, { name: 'GLACIER', c: ['#a5f3fc', '#0c4a6e', '#ffffff'], pattern: 'hex' },
  { name: 'JUNGLE', c: ['#4ade80', '#14532d', '#facc15'], pattern: 'camo' }, { name: 'ABYSSAL', c: ['#1e3a8a', '#020617', '#22d3ee'], pattern: 'waves' },
  { name: 'SOLAR', c: ['#fbbf24', '#7c2d12', '#fff7ed'], pattern: 'rings' }, { name: 'LUNAR', c: ['#cbd5e1', '#1e1b4b', '#c4b5fd'], pattern: 'stars' },
  { name: 'TOXIC', c: ['#a3e635', '#1a2e05', '#d946ef'], pattern: 'drip' }, { name: 'ROYAL', c: ['#7c3aed', '#2e1065', '#fcd34d'], pattern: 'chevron' },
  { name: 'STEAM', c: ['#b45309', '#292524', '#fde68a'], pattern: 'grid' }, { name: 'PIXEL', c: ['#22c55e', '#111827', '#f43f5e'], pattern: 'pixel' },
  { name: 'STORM', c: ['#60a5fa', '#172554', '#fef08a'], pattern: 'bolts' }, { name: 'DESERT', c: ['#d6a35c', '#5c3a12', '#fef3c7'], pattern: 'stripes' },
  { name: 'CANDY', c: ['#f9a8d4', '#831843', '#a7f3d0'], pattern: 'dots' }, { name: 'SHOGUN', c: ['#dc2626', '#1c1917', '#fbbf24'], pattern: 'scales' },
  { name: 'COSMIC', c: ['#8b5cf6', '#0f0a1f', '#f0abfc'], pattern: 'swirl' }, { name: 'CHROME', c: ['#e5e7eb', '#374151', '#93c5fd'], pattern: 'plain' },
  { name: 'SPECTRAL', c: ['#99f6e4', '#134e4a', '#e0f2fe'], pattern: 'sparkle' }, { name: 'TRIBAL', c: ['#ea580c', '#431407', '#fef9c3'], pattern: 'tribal' },
  { name: 'CRYSTAL', c: ['#67e8f9', '#164e63', '#f5d0fe'], pattern: 'gems' }, { name: 'PHOENIX', c: ['#f97316', '#450a0a', '#fde047'], pattern: 'feathers' },
  { name: 'ARCADE', c: ['#facc15', '#1e1b4b', '#ec4899'], pattern: 'checker' }, { name: 'RUNIC', c: ['#94a3b8', '#0f172a', '#38bdf8'], pattern: 'runes' },
  { name: 'INFERNAL', c: ['#b91c1c', '#0a0000', '#f97316'], pattern: 'flames' },
];
const MOTIFS: { name: string; acc: Accessory; weapon: string }[] = [
  { name: 'SAMURAI', acc: 'helmet', weapon: 'katana' }, { name: 'ANGEL', acc: 'halo', weapon: 'wing' }, { name: 'DEMON', acc: 'horns', weapon: 'trident' },
  { name: 'CYBORG', acc: 'visor', weapon: 'cannon' }, { name: 'NINJA', acc: 'mask', weapon: 'kunai' }, { name: 'KING', acc: 'crown', weapon: 'scepter' },
  { name: 'ROBOT', acc: 'antenna', weapon: 'claw' }, { name: 'BEAST', acc: 'ears', weapon: 'fang' }, { name: 'KNIGHT', acc: 'crest', weapon: 'lance' },
  { name: 'PUNK', acc: 'spikes', weapon: 'guitar' }, { name: 'DRAGON', acc: 'wings', weapon: 'flame' }, { name: 'FOX', acc: 'tail', weapon: 'fan' },
  { name: 'ROGUE', acc: 'scarf', weapon: 'dagger' }, { name: 'PILOT', acc: 'goggles', weapon: 'blaster' }, { name: 'MONK', acc: 'hood', weapon: 'staff' },
  { name: 'UNICORN', acc: 'unihorn', weapon: 'horn' }, { name: 'SPIRIT', acc: 'flamehair', weapon: 'orb' }, { name: 'GOLEM', acc: 'crystal', weapon: 'fist' },
  { name: 'ORACLE', acc: 'orbitals', weapon: 'rune' }, { name: 'HERO', acc: 'cape', weapon: 'sword' },
];

export interface Theme { id: number; name: string; primary: string; dark: string; accent: string; pattern: Pattern; accessory: Accessory; weapon: string }
export const THEMES: Theme[] = PREFIXES.flatMap((p, pi) => MOTIFS.map((m, mi) => ({
  id: pi * MOTIFS.length + mi, name: `${p.name} ${m.name}`, primary: p.c[0], dark: p.c[1], accent: p.c[2], pattern: p.pattern, accessory: m.acc, weapon: m.weapon,
})));

/** Cosmetic FX layers. Higher rarities unlock more custom layers. NO stat fields exist on skins (performance parity). */
export const FX_LAYERS = ['model', 'weapon', 'attackFx', 'skillFx', 'ultFx', 'killFx', 'entranceFx', 'victoryFx'] as const;
export type FxLayer = typeof FX_LAYERS[number];
export const RARITY_LAYERS: Record<Rarity, number> = { COMMON: 2, UNCOMMON: 3, RARE: 4, 'SUPER RARE': 5, 'HYPER RARE': 6, MYTHIC: 7, LEGENDARY: 8 };
const KILL_FX = ['shatter', 'vortex', 'pillar', 'confetti', 'skull', 'petals', 'pixels', 'lightning', 'blackflame', 'crown'];
const ENTRANCE_FX = ['portal', 'meteor', 'smoke', 'lightning', 'petals', 'rise'];
const VICTORY_FX = ['fireworks', 'aura', 'throne', 'rain', 'spotlight'];

export interface SkinDef {
  id: string; charId: number; index: number; rarity: Rarity; themeId: number; name: string; price: number;
  fx: Partial<Record<FxLayer, string>>; aura: number; trail: 'none' | 'line' | 'spark' | 'ribbon' | 'comet';
  gacha: boolean;
}

function buildSkins(): SkinDef[] {
  const out: SkinDef[] = [];
  let k = 0;
  for (const c of CHARACTERS) {
    RARITIES.forEach((rarity, ri) => {
      const t = THEMES[k % THEMES.length];
      const layers = RARITY_LAYERS[rarity];
      const fx: Partial<Record<FxLayer, string>> = {};
      FX_LAYERS.slice(0, layers).forEach(l => {
        if (l === 'killFx') fx[l] = KILL_FX[k % KILL_FX.length];
        else if (l === 'entranceFx') fx[l] = ENTRANCE_FX[k % ENTRANCE_FX.length];
        else if (l === 'victoryFx') fx[l] = VICTORY_FX[k % VICTORY_FX.length];
        else fx[l] = `${t.name.toLowerCase().replace(/ /g, '-')}-${l}`;
      });
      out.push({
        id: `${c.id}-${ri}`, charId: c.id, index: ri, rarity, themeId: t.id,
        name: ri === 0 ? `${t.name} ${c.key}（初期）` : `${t.name} ${c.key}`,
        price: SKIN_PRICES[rarity], fx,
        aura: Math.max(0, ri - 2), trail: (['none', 'none', 'line', 'spark', 'ribbon', 'comet', 'comet'] as const)[ri],
        gacha: ri > 0,
      });
      k++;
    });
  }
  return out;
}
export const SKINS: SkinDef[] = buildSkins();
export const SKIN_BY_ID = new Map(SKINS.map(s => [s.id, s]));
export const defaultSkinId = (charId: number) => `${charId}-0`;
export function skinsFor(charId: number): SkinDef[] { return SKINS.filter(s => s.charId === charId); }
export function themeOf(skinId: string): Theme { const s = SKIN_BY_ID.get(skinId); return THEMES[s ? s.themeId : 0]; }

export interface ValidationIssue { kind: string; detail: string }
/** Automated skin validator (run in tests and available in-game under Settings > Data). */
export function validateSkins(skins = SKINS, chars = CHARACTERS): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  const themeUse = new Map<number, number>();
  for (const s of skins) {
    if (ids.has(s.id)) issues.push({ kind: 'duplicate-id', detail: s.id });
    ids.add(s.id);
    themeUse.set(s.themeId, (themeUse.get(s.themeId) ?? 0) + 1);
    if (Object.keys(s.fx).length < RARITY_LAYERS[s.rarity]) issues.push({ kind: 'fx-missing', detail: s.id });
    const anyS = s as unknown as Record<string, unknown>;
    for (const forbidden of ['hp', 'damage', 'speed', 'stats', 'power']) if (forbidden in anyS) issues.push({ kind: 'stat-difference', detail: s.id });
    if (s.index > 0 && !s.gacha) issues.push({ kind: 'gacha-missing', detail: s.id });
  }
  for (const c of chars) {
    const cs = skins.filter(s => s.charId === c.id);
    if (cs.length < 7) issues.push({ kind: 'too-few-skins', detail: c.key });
    for (const r of RARITIES) if (!cs.some(s => s.rarity === r)) issues.push({ kind: 'rarity-missing', detail: `${c.key}:${r}` });
    const th = new Set(cs.map(s => s.themeId));
    if (th.size !== cs.length) issues.push({ kind: 'theme-dup-in-char', detail: c.key });
    const looks = new Set(cs.map(s => `${THEMES[s.themeId].accessory}|${THEMES[s.themeId].pattern}`));
    if (looks.size !== cs.length) issues.push({ kind: 'color-swap-only', detail: c.key });
  }
  for (const [t, n] of themeUse) if (n > 3) issues.push({ kind: 'theme-overused', detail: `${THEMES[t].name}:${n}` });
  if (themeUse.size < 467) issues.push({ kind: 'too-few-themes', detail: String(themeUse.size) });
  return issues;
}
