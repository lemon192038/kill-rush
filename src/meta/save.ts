import { SAVE_VERSION } from '../data/config';
import { STARTER_IDS } from '../data/characters';
import { defaultSkinId } from '../data/skins';
import { DEFAULT_BG } from '../data/backgrounds';
import { newSkill, type CharSkill, type SkillRecord } from '../ai/matchmaking';
import type { GearKey } from '../data/gears';
import type { ModeId } from '../data/modes';

export interface TouchButtonLayout { x: number; y: number; size: number; opacity: number }
export type TouchLayout = Record<string, TouchButtonLayout>;
export interface KeyBinds { up: string; down: string; left: string; right: string; skill1: string; skill2: string; ult: string; dodge: string; score: string; menu: string; pass: string }
export const DEFAULT_KEYS: KeyBinds = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', skill1: 'KeyQ', skill2: 'KeyE', ult: 'KeyR', dodge: 'Space', score: 'Tab', menu: 'Escape', pass: 'KeyF' };
export const DEFAULT_TOUCH: TouchLayout = {
  stick: { x: 0.13, y: 0.72, size: 1, opacity: 0.6 },
  attack: { x: 0.86, y: 0.72, size: 1, opacity: 0.7 },
  skill1: { x: 0.72, y: 0.84, size: 0.75, opacity: 0.7 },
  skill2: { x: 0.74, y: 0.6, size: 0.75, opacity: 0.7 },
  ult: { x: 0.86, y: 0.45, size: 0.85, opacity: 0.75 },
  dodge: { x: 0.95, y: 0.9, size: 0.6, opacity: 0.6 },
  pass: { x: 0.62, y: 0.88, size: 0.65, opacity: 0.7 },
};

export interface ChampSeason { season: number; rating: number; peak: number; wins: number; losses: number; draws: number; streak: number; bestStreak: number; history: { t: number; mode: string; map: string; result: string; delta: number; rating: number }[]; peakIndex: number; stars: Record<number, number> }

export interface SaveData {
  version: number; createdAt: number; updatedAt: number;
  profile: { name: string; title: string; bg: string; favoriteChar: number; showOnCard: { title: boolean; charPt: boolean; totalPt: boolean }; level: number; xp: number };
  pt: number; cumulativePt: number; charPt: Record<number, number>;
  credits: number; coins: number; charPoints: number;
  victoryRights: number; missionRights: number; lastFreeBox: number; gachaPity: Record<string, number>;
  unlockedChars: number[]; ownedSkins: string[]; equippedSkin: Record<number, string>;
  ownedGears: string[]; equippedGears: Record<number, GearKey[]>;
  ownedBackgrounds: string[]; ownedTitles: string[];
  selectedChar: number;
  skill: SkillRecord; charSkill: Record<number, CharSkill>;
  cpuAssignments: { t: number; mode: ModeId; char: number; target: number; ranks: string[] }[];
  championship: { current: ChampSeason; past: ChampSeason[]; bans: number; leaverPenaltyUntil: number };
  missions: { day: string; progress: Record<string, number>; claimed: string[] };
  settings: {
    volume: number; sfx: number; music: number; quality: 'low' | 'medium' | 'high'; fpsCap: 30 | 60 | 120; showFps: boolean;
    shake: number; damageNumbers: boolean; language: 'ja' | 'en'; keys: KeyBinds; touchLayouts: Record<string, TouchLayout>; activeLayout: string;
    aimAssist: boolean; showCpuInfo: boolean; notifications: boolean; tutorialDone: Record<string, boolean>;
  };
  stats: { matches: number; wins: number; byMode: Record<string, { g: number; w: number }> };
  history: { t: number; mode: string; map: string; char: number; outcome: string; kills: number; deaths: number; ptDelta: number; champ: boolean }[];
  processedMatches: string[]; // idempotency: prevents double-crediting rewards
  notifications: { t: number; text: string; read: boolean }[];
}

export function defaultSave(): SaveData {
  const now = Date.now();
  const unlocked = [...STARTER_IDS];
  return {
    version: SAVE_VERSION, createdAt: now, updatedAt: now,
    profile: { name: 'PLAYER', title: 'ルーキー', bg: DEFAULT_BG, favoriteChar: 1, showOnCard: { title: true, charPt: true, totalPt: true }, level: 1, xp: 0 },
    pt: 0, cumulativePt: 0, charPt: {}, credits: 500, coins: 0, charPoints: 0,
    victoryRights: 1, missionRights: 0, lastFreeBox: 0, gachaPity: {},
    unlockedChars: unlocked, ownedSkins: unlocked.map(defaultSkinId), equippedSkin: Object.fromEntries(unlocked.map(id => [id, defaultSkinId(id)])),
    ownedGears: [], equippedGears: {}, ownedBackgrounds: [DEFAULT_BG], ownedTitles: ['ルーキー'], selectedChar: 1,
    skill: newSkill(), charSkill: {}, cpuAssignments: [],
    championship: { current: newSeason(1), past: [], bans: 0, leaverPenaltyUntil: 0 },
    missions: { day: '', progress: {}, claimed: [] },
    settings: { volume: 0.8, sfx: 0.9, music: 0.5, quality: 'high', fpsCap: 60, showFps: false, shake: 1, damageNumbers: true, language: 'ja', keys: { ...DEFAULT_KEYS }, touchLayouts: { default: structuredClone(DEFAULT_TOUCH) }, activeLayout: 'default', aimAssist: true, showCpuInfo: true, notifications: true, tutorialDone: {} },
    stats: { matches: 0, wins: 0, byMode: {} }, history: [], processedMatches: [], notifications: [{ t: now, text: 'KILL RUSHへようこそ！まずは練習場で操作を確認しよう。', read: false }],
  };
}
export function newSeason(n: number): ChampSeason { return { season: n, rating: 0, peak: 0, wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0, history: [], peakIndex: 0, stars: {} }; }

/** Merge loaded data over defaults (handles new fields across versions). */
export function migrate(raw: unknown): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<SaveData>;
  const out = deepMerge(d, r) as SaveData;
  // v1 -> v2: coins added; v2 -> v3: skill model
  if (!r.version || r.version < 3) { out.skill = { ...newSkill(), ...(r.skill ?? {}) }; }
  out.version = SAVE_VERSION;
  // integrity fixes
  out.unlockedChars = [...new Set(out.unlockedChars.filter(n => Number.isInteger(n) && n >= 1 && n <= 200))];
  out.coins = Math.max(0, Math.floor(Number(out.coins) || 0));
  out.credits = Math.max(0, Math.floor(Number(out.credits) || 0));
  out.pt = Math.max(0, Math.floor(Number(out.pt) || 0));
  out.victoryRights = Math.max(0, Math.floor(Number(out.victoryRights) || 0));
  for (const [k, g] of Object.entries(out.equippedGears)) out.equippedGears[Number(k)] = [...new Set(g)].slice(0, 2);
  if (out.processedMatches.length > 200) out.processedMatches = out.processedMatches.slice(-200);
  return out;
}
function deepMerge(base: any, over: any): any {
  if (Array.isArray(base)) return Array.isArray(over) ? over : base;
  if (base && typeof base === 'object') {
    const o: any = { ...base };
    if (over && typeof over === 'object') for (const k of Object.keys(over)) o[k] = k in base ? deepMerge(base[k], over[k]) : over[k];
    return o;
  }
  return over === undefined || over === null || typeof over !== typeof base ? base : over;
}

export function checksum(s: string): string { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }

const DB = 'kill-rush', STORE = 'save', KEY = 'main', LS = 'kill-rush-save';
export interface Storage { load(): Promise<string | null>; store(s: string): Promise<void>; clear(): Promise<void> }

function idb(): Storage | null {
  if (typeof indexedDB === 'undefined') return null;
  const open = () => new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => { const db = await open(); return new Promise<T>((res, rej) => { const t = db.transaction(STORE, mode); const req = fn(t.objectStore(STORE)); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); };
  return {
    load: async () => (await tx<string | undefined>('readonly', s => s.get(KEY) as IDBRequest<string | undefined>)) ?? null,
    store: async v => { await tx('readwrite', s => s.put(v, KEY)); },
    clear: async () => { await tx('readwrite', s => s.delete(KEY)); },
  };
}
function ls(): Storage {
  const mem = new Map<string, string>();
  const get = (k: string) => { try { return localStorage.getItem(k); } catch { return mem.get(k) ?? null; } };
  const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { mem.set(k, v); } };
  return { load: async () => get(LS), store: async v => set(LS, v), clear: async () => { try { localStorage.removeItem(LS); } catch { mem.delete(LS); } } };
}

export function wrap(data: SaveData): string { const body = JSON.stringify(data); return JSON.stringify({ v: SAVE_VERSION, c: checksum(body), body }); }
export function unwrap(s: string): { data: SaveData | null; corrupt: boolean } {
  try {
    const o = JSON.parse(s);
    if (!o || typeof o.body !== 'string') return { data: null, corrupt: true };
    if (checksum(o.body) !== o.c) return { data: null, corrupt: true };
    return { data: migrate(JSON.parse(o.body)), corrupt: false };
  } catch { return { data: null, corrupt: true }; }
}

export class SaveManager {
  data: SaveData = defaultSave();
  private primary: Storage | null = idb();
  private backup: Storage = ls();
  private timer: ReturnType<typeof setTimeout> | null = null;
  lastError: string | null = null; onError: (msg: string) => void = () => {}; loadedCorrupt = false;
  async load(): Promise<SaveData> {
    let raw: string | null = null;
    try { raw = this.primary ? await this.primary.load() : null; } catch { raw = null; }
    let res = raw ? unwrap(raw) : { data: null, corrupt: false };
    if (!res.data) { const b = await this.backup.load(); const rb = b ? unwrap(b) : { data: null, corrupt: false }; if (rb.data) res = rb; else if (res.corrupt || rb.corrupt) this.loadedCorrupt = true; }
    this.data = res.data ?? defaultSave();
    return this.data;
  }
  /** Debounced autosave */
  save(immediate = false) {
    this.data.updatedAt = Date.now();
    if (this.timer) clearTimeout(this.timer);
    if (immediate) { void this.flush(); return; }
    this.timer = setTimeout(() => void this.flush(), 300);
  }
  async flush() {
    const s = wrap(this.data);
    try { if (this.primary) await this.primary.store(s); } catch (e) { this.lastError = String(e); this.onError('セーブに失敗しました（IndexedDB）。バックアップに保存します。'); }
    try { await this.backup.store(s); } catch (e) { this.lastError = String(e); this.onError('セーブに失敗しました。ストレージ容量を確認してください。'); }
  }
  exportString(): string { return btoa(unescape(encodeURIComponent(wrap(this.data)))); }
  importString(code: string): boolean {
    try { const r = unwrap(decodeURIComponent(escape(atob(code.trim())))); if (!r.data) return false; this.data = r.data; this.save(true); return true; } catch { return false; }
  }
  async reset() { this.data = defaultSave(); try { await this.primary?.clear(); } catch { /* ignore */ } await this.backup.clear(); await this.flush(); }
}
