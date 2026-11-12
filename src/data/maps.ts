import { Rng, hashStr } from '../core/rng';

/** Tile codes */
export const T = { FLOOR: 0, WALL: 1, BUSH: 2, CRATE: 3, WATER: 4, HAZARD: 5, JUMP: 6, HEAL: 7, GOAL0: 8, GOAL1: 9 } as const;
export type TileCode = typeof T[keyof typeof T];

export type ThemeKey = 'ruins' | 'forest' | 'volcano' | 'neon' | 'crystal' | 'city' | 'gold' | 'iron' | 'cyber';
export interface MapTheme { floorA: string; floorB: string; wallTop: string; wallSide: string; bush: string; bushDark: string; water: string; hazard: string; hazardName: string; crate: string; ambient: string; particles: 'dust' | 'leaves' | 'embers' | 'sparks' | 'snow' }
export const MAP_THEMES: Record<ThemeKey, MapTheme> = {
  ruins: { floorA: '#d8b98a', floorB: '#cfae7c', wallTop: '#a58a64', wallSide: '#6f5a3e', bush: '#5fa83a', bushDark: '#3d7a22', water: '#3aa5c8', hazard: '#8b4513', hazardName: '流砂', crate: '#9a6b3c', ambient: 'rgba(255,220,160,0.05)', particles: 'dust' },
  forest: { floorA: '#7fb069', floorB: '#76a660', wallTop: '#6b5a48', wallSide: '#40342a', bush: '#2f8f3a', bushDark: '#1d6127', water: '#3f8fc0', hazard: '#6b2f8f', hazardName: '毒沼', crate: '#7a5230', ambient: 'rgba(120,255,140,0.04)', particles: 'leaves' },
  volcano: { floorA: '#4a3b38', floorB: '#433431', wallTop: '#2b2220', wallSide: '#170f0e', bush: '#7a5a1f', bushDark: '#4f3a12', water: '#3b6f7a', hazard: '#ff5a1f', hazardName: '溶岩', crate: '#5c3a2a', ambient: 'rgba(255,90,30,0.06)', particles: 'embers' },
  neon: { floorA: '#1d1b33', floorB: '#221f3d', wallTop: '#3b2d6b', wallSide: '#16102e', bush: '#1fbf9f', bushDark: '#0f7a66', water: '#2a62ff', hazard: '#ff2fd6', hazardName: '電撃床', crate: '#4a3a8a', ambient: 'rgba(255,47,214,0.05)', particles: 'sparks' },
  crystal: { floorA: '#3d4a63', floorB: '#36425a', wallTop: '#6c7fa8', wallSide: '#2a3550', bush: '#3fa8a0', bushDark: '#257068', water: '#4fc3f7', hazard: '#b388ff', hazardName: '結晶棘', crate: '#5f6f9a', ambient: 'rgba(160,220,255,0.06)', particles: 'snow' },
  city: { floorA: '#5b5f66', floorB: '#53575e', wallTop: '#3a3d43', wallSide: '#1f2125', bush: '#5d7a3a', bushDark: '#3d5524', water: '#3f6e8a', hazard: '#7cff4f', hazardName: '汚染', crate: '#6b5843', ambient: 'rgba(200,200,200,0.03)', particles: 'dust' },
  gold: { floorA: '#c9a94f', floorB: '#bf9f45', wallTop: '#8a6d1f', wallSide: '#5a4510', bush: '#4f8f3a', bushDark: '#346627', water: '#3aa5c8', hazard: '#ff7a1f', hazardName: '熱鉄', crate: '#7a5a1f', ambient: 'rgba(255,215,0,0.05)', particles: 'dust' },
  iron: { floorA: '#4f565e', floorB: '#4a5058', wallTop: '#7a828c', wallSide: '#30353b', bush: '#4b6b3a', bushDark: '#324a26', water: '#40707f', hazard: '#ffb020', hazardName: '高温プレス', crate: '#7a5a40', ambient: 'rgba(255,170,60,0.04)', particles: 'sparks' },
  cyber: { floorA: '#0f2233', floorB: '#12283b', wallTop: '#1f5f8a', wallSide: '#0a2033', bush: '#16c2a3', bushDark: '#0b7a66', water: '#1f8fff', hazard: '#00e5ff', hazardName: 'データ嵐', crate: '#2a5a8a', ambient: 'rgba(0,229,255,0.05)', particles: 'sparks' },
};

export type MapKind = 'arena' | 'team' | 'br' | 'duel' | 'boss' | 'soccer';
export interface MapDef { id: string; name: string; theme: ThemeKey; kind: MapKind; w: number; h: number; seed: number; density?: number }
export interface MapData { def: MapDef; w: number; h: number; tiles: Uint8Array; crateHp: Float32Array }

export const MAPS: MapDef[] = [
  { id: 'ruins', name: '古代遺跡', theme: 'ruins', kind: 'arena', w: 26, h: 26, seed: 11 },
  { id: 'forest', name: '深緑の森', theme: 'forest', kind: 'arena', w: 26, h: 26, seed: 23, density: 1.3 },
  { id: 'volcano', name: '灼熱火山', theme: 'volcano', kind: 'arena', w: 26, h: 26, seed: 37 },
  { id: 'neon', name: 'ネオンシティ', theme: 'neon', kind: 'arena', w: 26, h: 26, seed: 41 },
  { id: 'duel-ruins', name: '決闘の間', theme: 'ruins', kind: 'duel', w: 17, h: 17, seed: 5 },
  { id: 'boss-volcano', name: '魔獣の火口', theme: 'volcano', kind: 'boss', w: 24, h: 24, seed: 7 },
  { id: 'br-isle', name: 'ラッシュアイランド', theme: 'forest', kind: 'br', w: 44, h: 44, seed: 101, density: 1.2 },
  { id: 'br-mega', name: 'メガ大陸', theme: 'ruins', kind: 'br', w: 56, h: 56, seed: 202, density: 1.2 },
  { id: 'crystal-mine', name: 'CRYSTAL MINE', theme: 'crystal', kind: 'team', w: 21, h: 31, seed: 301 },
  { id: 'emerald-forest', name: 'EMERALD FOREST', theme: 'forest', kind: 'team', w: 21, h: 31, seed: 302, density: 1.3 },
  { id: 'neon-reactor', name: 'NEON REACTOR', theme: 'neon', kind: 'team', w: 21, h: 31, seed: 303 },
  { id: 'ruined-colosseum', name: 'RUINED COLOSSEUM', theme: 'ruins', kind: 'team', w: 21, h: 27, seed: 311 },
  { id: 'lava-crossing', name: 'LAVA CROSSING', theme: 'volcano', kind: 'team', w: 21, h: 27, seed: 312 },
  { id: 'dead-city', name: 'DEAD CITY', theme: 'city', kind: 'team', w: 21, h: 27, seed: 313 },
  { id: 'golden-fortress', name: 'GOLDEN FORTRESS', theme: 'gold', kind: 'team', w: 21, h: 33, seed: 321 },
  { id: 'iron-factory', name: 'IRON FACTORY', theme: 'iron', kind: 'team', w: 21, h: 33, seed: 322 },
  { id: 'cyber-bank', name: 'CYBER BANK', theme: 'cyber', kind: 'team', w: 21, h: 33, seed: 323 },
  { id: 'green-frontier', name: 'GREEN FRONTIER', theme: 'forest', kind: 'team', w: 23, h: 31, seed: 331 },
  { id: 'temple-control', name: 'TEMPLE CONTROL', theme: 'ruins', kind: 'team', w: 23, h: 31, seed: 332 },
  { id: 'neon-dominion', name: 'NEON DOMINION', theme: 'neon', kind: 'team', w: 23, h: 31, seed: 333 },
  { id: 'tdm-ruins', name: '遺跡の戦線', theme: 'ruins', kind: 'team', w: 21, h: 29, seed: 341 },
  { id: 'tdm-neon', name: 'ネオン戦線', theme: 'neon', kind: 'team', w: 21, h: 29, seed: 342 },
  { id: 'neon-stadium', name: 'NEON STADIUM', theme: 'neon', kind: 'soccer', w: 19, h: 29, seed: 401 },
  { id: 'ancient-arena', name: 'ANCIENT ARENA', theme: 'ruins', kind: 'soccer', w: 19, h: 29, seed: 402 },
  { id: 'magma-field', name: 'MAGMA FIELD', theme: 'volcano', kind: 'soccer', w: 19, h: 29, seed: 403 },
  { id: 'cyber-arena', name: 'CYBER ARENA', theme: 'cyber', kind: 'soccer', w: 19, h: 29, seed: 404 },
];
export const MAP_BY_ID = new Map(MAPS.map(m => [m.id, m]));

const cache = new Map<string, MapData>();
export function loadMap(id: string): MapData {
  const def = MAP_BY_ID.get(id);
  if (!def) throw new Error('map ' + id);
  let m = cache.get(id);
  if (!m) { m = generate(def); cache.set(id, m); }
  return { def, w: m.w, h: m.h, tiles: m.tiles.slice(), crateHp: m.crateHp.slice() };
}

function generate(def: MapDef): MapData {
  const { w, h } = def;
  const rng = new Rng(def.seed ^ hashStr(def.id));
  const tiles = new Uint8Array(w * h);
  const set = (x: number, y: number, t: number) => { if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = t; };
  const get = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? T.WALL : tiles[y * w + x]);
  // Symmetry: team & soccer mirror vertically (+ horizontally flipped -> point symmetric); arena/br 4-way
  const sym = def.kind === 'team' || def.kind === 'soccer' ? 'point' : def.kind === 'duel' ? 'point' : 'four';
  const place = (x: number, y: number, t: number) => {
    set(x, y, t);
    if (sym === 'point') set(w - 1 - x, h - 1 - y, t);
    else { set(w - 1 - x, y, t); set(x, h - 1 - y, t); set(w - 1 - x, h - 1 - y, t); }
  };
  const qw = sym === 'four' ? Math.ceil(w / 2) : w;
  const qh = sym === 'four' ? Math.ceil(h / 2) : Math.ceil(h / 2);
  const density = (def.density ?? 1) * (def.kind === 'soccer' ? 0.35 : 1);
  const area = qw * qh;
  // wall clusters
  const nWalls = Math.round(area / 22 * density);
  for (let i = 0; i < nWalls; i++) {
    const x = rng.int(1, qw - 2), y = rng.int(1, qh - 2);
    const horiz = rng.chance(0.5), L = rng.int(2, 4);
    for (let k = 0; k < L; k++) place(horiz ? x + k : x, horiz ? y : y + k, rng.chance(0.18) ? T.CRATE : T.WALL);
  }
  // bushes
  const nBush = Math.round(area / 30 * density * (def.theme === 'forest' ? 1.5 : 1));
  for (let i = 0; i < nBush; i++) {
    const x = rng.int(1, qw - 2), y = rng.int(1, qh - 2), bw = rng.int(2, 4), bh = rng.int(2, 3);
    for (let a = 0; a < bw; a++) for (let b = 0; b < bh; b++) if (get(x + a, y + b) === T.FLOOR) place(x + a, y + b, T.BUSH);
  }
  // water & hazards
  if (def.kind !== 'soccer') {
    const nW = Math.round(area / 160);
    for (let i = 0; i < nW; i++) { const x = rng.int(2, qw - 3), y = rng.int(2, qh - 3); for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) if (get(x + a, y + b) === T.FLOOR) place(x + a, y + b, T.WATER); }
    const nH = Math.round(area / 200);
    for (let i = 0; i < nH; i++) { const x = rng.int(2, qw - 3), y = rng.int(2, qh - 3); for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) if (get(x + a, y + b) === T.FLOOR) place(x + a, y + b, T.HAZARD); }
    const nJ = Math.max(1, Math.round(area / 260));
    for (let i = 0; i < nJ; i++) { const x = rng.int(2, qw - 3), y = rng.int(2, qh - 3); if (get(x, y) === T.FLOOR) place(x, y, T.JUMP); }
    const nHe = Math.max(1, Math.round(area / 300));
    for (let i = 0; i < nHe; i++) { const x = rng.int(2, qw - 3), y = rng.int(2, qh - 3); if (get(x, y) === T.FLOOR) place(x, y, T.HEAL); }
  }
  // clear spawn / objective areas
  const clear = (cx: number, cy: number, r: number) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = T.FLOOR; };
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  if (def.kind === 'team' || def.kind === 'soccer' || def.kind === 'duel') {
    clear(cx, 2, 2); clear(cx, h - 3, 2); clear(cx, cy, 2);
  } else {
    clear(cx, cy, def.kind === 'boss' ? 3 : 1);
  }
  if (def.kind === 'soccer') {
    // goals: openings at top/bottom center, 5 wide
    for (let x = cx - 2; x <= cx + 2; x++) { tiles[x] = T.GOAL1; tiles[(h - 1) * w + x] = T.GOAL0; }
    // goal-side walls
    for (const gx of [cx - 3, cx + 3]) { tiles[1 * w + gx] = T.WALL; tiles[(h - 2) * w + gx] = T.WALL; }
    clear(cx, 3, 2); clear(cx, h - 4, 2);
  }
  // border walls
  for (let x = 0; x < w; x++) { if (tiles[x] < T.GOAL0) tiles[x] = T.WALL; if (tiles[(h - 1) * w + x] < T.GOAL0) tiles[(h - 1) * w + x] = T.WALL; }
  for (let y = 0; y < h; y++) { tiles[y * w] = T.WALL; tiles[y * w + w - 1] = T.WALL; }
  ensureConnected(tiles, w, h, cx, cy);
  const crateHp = new Float32Array(w * h);
  for (let i = 0; i < tiles.length; i++) if (tiles[i] === T.CRATE) crateHp[i] = 2400;
  return { def, w, h, tiles, crateHp };
}

/** Flood-fill from center; convert walls between disconnected regions to floor until all walkable tiles are reachable. */
function ensureConnected(tiles: Uint8Array, w: number, h: number, sx: number, sy: number) {
  const walkable = (t: number) => t !== T.WALL && t !== T.WATER && t !== T.CRATE;
  for (let pass = 0; pass < 50; pass++) {
    const seen = new Uint8Array(w * h);
    const q = [sy * w + sx]; seen[q[0]] = 1;
    while (q.length) {
      const i = q.pop()!; const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) continue;
        const j = ny * w + nx; if (!seen[j] && walkable(tiles[j])) { seen[j] = 1; q.push(j); }
      }
    }
    let fixed = false;
    for (let y = 1; y < h - 1 && !fixed; y++) for (let x = 1; x < w - 1 && !fixed; x++) {
      const i = y * w + x;
      if (walkable(tiles[i]) && !seen[i]) {
        // carve straight path toward start
        let px = x, py = y;
        while (!seen[py * w + px]) { if (!walkable(tiles[py * w + px])) tiles[py * w + px] = T.FLOOR; if (px !== sx) px += Math.sign(sx - px); else py += Math.sign(sy - py); }
        fixed = true;
      }
    }
    if (!fixed) return;
  }
}
