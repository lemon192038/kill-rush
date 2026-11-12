import type { Rng } from '../core/rng';
import type { AbilityDef, CharacterDef, Element, ProjectileSpec, StatusApply, StatusKind, ZoneSpec } from '../data/types';
import type { MapData } from '../data/maps';
import type { ModeDef } from '../data/modes';
import type { GearKey } from '../data/gears';
import type { CpuProfile } from '../ai/profile';

export interface FighterInput {
  mx: number; my: number;            // move vector (-1..1)
  aimX: number; aimY: number;        // aim direction (unit) or zero for auto
  aimDist: number;                   // aim distance in px (for point skills), 0 = auto
  attack: boolean;                   // held
  skill1: boolean; skill2: boolean; ult: boolean; dodge: boolean;
  pass: boolean;                     // KILL & GOAL pass
  autoAttack: boolean; autoS1: boolean; autoS2: boolean; autoUlt: boolean; // quick-tap auto aim
}
export const emptyInput = (): FighterInput => ({ mx: 0, my: 0, aimX: 0, aimY: 0, aimDist: 0, attack: false, skill1: false, skill2: false, ult: false, dodge: false, pass: false, autoAttack: false, autoS1: false, autoS2: false, autoUlt: false });

export interface StatusState { t: number; power: number; src: number }
export interface Scheduled { at: number; run: () => void }

export interface FighterStats {
  kills: number; deaths: number; assists: number; damage: number; taken: number; healing: number;
  objective: number; maxStreak: number; streak: number; maxCombo: number; survival: number; protect: number; defense: number;
}

export interface Fighter {
  id: number; team: number; char: CharacterDef; skinId: string; name: string; title: string; bg: string;
  isPlayer: boolean; cpu: CpuProfile | null; ai: unknown;
  x: number; y: number; kx: number; ky: number; radius: number; facing: number; aim: number;
  moving: boolean; lastMoveX: number; lastMoveY: number;
  hp: number; maxHp: number; baseMaxHp: number; shield: number; shieldT: number;
  gearShield: number; gearShieldMax: number; fullHpT: number;
  ammo: number; reloadT: number; lock: number; castLock: number; casting: { ab: AbilityDef; slot: 1 | 2 | 3; t: number; ax: number; ay: number; tx: number; ty: number } | null;
  cd: [number, number]; ult: number; dodgeCd: number;
  statuses: Map<StatusKind, StatusState>;
  alive: boolean; respawnT: number; invulnT: number; spawnProtectT: number;
  inBush: boolean; bushStayT: number; revealT: number; revealedFor: number[]; // per-team VISION reveal timers
  combatT: number; // seconds since last combat
  stats: FighterStats;
  combo: number; comboT: number; hitStreak: number; hitStreakT: number; revenge: number; frost: number; entropyT: number;
  cubes: number; gears: Set<GearKey>; gems: number; lives: number;
  input: FighterInput; prevInput: FighterInput;
  chargeT: number; charging: boolean;
  dash: { vx: number; vy: number; left: number; dmg: number; r: number; kb: number; status?: StatusApply; stop: boolean; hit: Set<number>; ownerKind: 'skill' | 'ult' } | null;
  air: { t: number; T: number; sx: number; sy: number; tx: number; ty: number } | null;
  hitstop: number;
  lastHitBy: Map<number, number>; // fighterId -> world time
  cloneOf: number | null; cloneT: number;
  isBoss: boolean;
  ambushReady: boolean;
  firstShotDelay: number;
}

export interface Projectile {
  id: number; owner: number; team: number; x: number; y: number; vx: number; vy: number; r: number;
  dmg: number; left: number; spec: ProjectileSpec; hit: Set<number>; bounces: number; kind: 'attack' | 'skill' | 'ult' | 'turret';
  lob: { sx: number; sy: number; tx: number; ty: number; t: number; T: number } | null;
  life: number; returning: boolean; ambush: boolean; color: string; element: Element; deployed: boolean; dead: boolean;
}
export interface Zone { id: number; owner: number; team: number; x: number; y: number; r: number; t: number; spec: ZoneSpec; follow: boolean; tick: number }
export type StructureKind = 'box' | 'vault' | 'turret';
export interface Structure { id: number; kind: StructureKind; team: number; owner: number; x: number; y: number; r: number; hp: number; maxHp: number; t: number; spec?: ProjectileSpec; rate?: number; cdT?: number; dead: boolean }
export interface TempWall { tiles: number[]; t: number }
export interface Pickup { id: number; kind: 'cube' | 'gem'; x: number; y: number; t: number; vx: number; vy: number }
export interface Ball { x: number; y: number; vx: number; vy: number; holder: number | null; noPickT: number; lastTeam: number; lastTouch: number }

export type GameEvent =
  | { type: 'hit'; x: number; y: number; dmg: number; crit: boolean; target: number; src: number; heal?: boolean; shield?: boolean; element?: Element }
  | { type: 'kill'; killer: number; victim: number; assist: number[]; x: number; y: number }
  | { type: 'shot'; owner: number; x: number; y: number; pattern: string; kind: string }
  | { type: 'explode'; x: number; y: number; r: number; color: string; owner: number }
  | { type: 'cast'; owner: number; slot: 1 | 2 | 3; x: number; y: number; name: string }
  | { type: 'telegraph'; owner: number; x: number; y: number; r: number; t: number; ult: boolean }
  | { type: 'status'; target: number; kind: StatusKind }
  | { type: 'pickup'; owner: number; kind: 'cube' | 'gem' | 'ball' }
  | { type: 'goal'; team: number; scorer: number }
  | { type: 'announce'; text: string; color?: string; big?: boolean }
  | { type: 'boxbreak'; x: number; y: number }
  | { type: 'dodge'; owner: number }
  | { type: 'respawn'; owner: number };

export interface KillFeedEntry { t: number; killer: string; victim: string; kTeam: number; vTeam: number; kColor: string; vColor: string }

export interface ModeState { [k: string]: unknown }

export interface MatchConfig {
  mode: ModeDef; mapId: string; seed: number; playerTeam: number;
  roster: { charId: number; skinId: string; name: string; title: string; bg: string; team: number; isPlayer: boolean; cpu: CpuProfile | null; gears: GearKey[] }[];
  championship: boolean; practice?: boolean;
}

export interface MatchResult {
  winnerTeam: number | null; // null = draw
  outcome: 'win' | 'loss' | 'draw';
  playerTeam: number; placement: number; totalTeams: number;
  durationSec: number; stats: FighterStats; perFighter: { id: number; name: string; team: number; charKey: string; stats: FighterStats; isPlayer: boolean; cpuRank?: string }[];
  mvpId: number; modeScore: Record<string, number>; reason: string;
}

export interface World {
  cfg: MatchConfig; rng: Rng; map: MapData; time: number; tick: number;
  fighters: Fighter[]; projectiles: Projectile[]; zones: Zone[]; structures: Structure[]; tempWalls: TempWall[]; pickups: Pickup[];
  ball: Ball | null; events: GameEvent[]; feed: KillFeedEntry[]; scheduled: Scheduled[];
  nextId: number; timeLeft: number; over: MatchResult | null; overT: number; modeState: ModeState;
  visibility: Uint8Array[]; // [team][fighterIndex]
  revealZones: { team: number; x: number; y: number; r: number; t: number }[];
  storm: { r: number; cx: number; cy: number; targetR: number; dps: number } | null;
  paused: boolean; ultZoomT: number;
}

export interface HudInfo { title: string; left: string; right: string; center?: string; bars?: { label: string; value: number; color: string }[]; teamScores?: number[] }
export interface ModeRules {
  init(w: World): void;
  tick(w: World): void;
  onKill(w: World, victim: Fighter, killer: Fighter | null): void;
  onStructureDestroyed?(w: World, s: Structure, by: Fighter | null): void;
  /** respawn allowed for this fighter? */
  canRespawn(w: World, f: Fighter): boolean;
  spawnPoint(w: World, f: Fighter): { x: number; y: number };
  hud(w: World): HudInfo;
  /** contribution for objective (used by rating/championship) */
  objectiveName: string;
}
declare module './types' { interface World { rules: ModeRules } }
