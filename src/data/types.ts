import type { SpeedClass } from '../core/constants';

export type Element = 'physical' | 'fire' | 'ice' | 'electric' | 'poison' | 'light' | 'dark' | 'earth' | 'water' | 'arcane';
export type StatusKind =
  | 'slow' | 'stun' | 'freeze' | 'poison' | 'burn' | 'bleed' | 'knockup' | 'silence'
  | 'blind' | 'mark' | 'root' | 'curse' | 'haste' | 'dmgUp' | 'defUp' | 'atkSpeed' | 'reveal' | 'invis' | 'reflect';

export interface StatusApply { kind: StatusKind; duration: number; power?: number }

export type ProjectilePattern =
  | 'straight' | 'spread' | 'shotgun' | 'burst' | 'pierce' | 'explode' | 'melee'
  | 'lob' | 'bounce' | 'deploy' | 'charge' | 'beam' | 'homing' | 'boomerang' | 'wave';

/** All distances in tiles (64px), speeds in tiles/sec, time in seconds unless noted as frames (60fps). */
export interface ProjectileSpec {
  pattern: ProjectilePattern;
  damage: number;
  count?: number;          // projectiles per volley
  spreadDeg?: number;      // total spread for spread/shotgun
  burstFrames?: number;    // frames between shots in a burst
  range: number;
  speed: number;
  radius: number;          // px collision radius
  pierce?: boolean;
  bounces?: number;
  explodeRadius?: number;  // tiles
  knockback?: number;      // px
  critChance?: number;
  element?: Element;
  status?: StatusApply;
  homing?: number;         // turn rate rad/sec
  arcDeg?: number;         // melee arc
  zone?: ZoneSpec;         // zone left where it lands / explodes
  pull?: number;           // px pull toward source on hit
  lifeSec?: number;        // for deploy pattern
  chargeMax?: number;      // charge pattern: seconds to full
  ignoreWalls?: boolean;   // lob
}

export interface AttackDef extends ProjectileSpec {
  name: string;
  startup: number;   // frames
  recovery: number;  // frames (movement slowed, cannot attack)
  ammo: number;
  reload: number;    // seconds per ammo
  breaksStealth?: boolean; // default true
}

export interface ZoneSpec {
  radius: number; duration: number;
  dps?: number; healPs?: number; slow?: number;
  status?: StatusApply; enemyOnly?: boolean; reveal?: boolean; pull?: number;
  allyBuff?: StatusApply; blocksProjectiles?: boolean; element?: Element;
}

export type Op =
  | { op: 'fire'; spec: ProjectileSpec; angleOffset?: number; delay?: number }
  | { op: 'dash'; distance: number; speed: number; damage?: number; radius?: number; knockback?: number; status?: StatusApply; stopOnHit?: boolean; backward?: boolean; delay?: number }
  | { op: 'blink'; distance: number; damage?: number; radius?: number; status?: StatusApply; behindTarget?: boolean; delay?: number }
  | { op: 'nova'; radius: number; damage: number; knockback?: number; status?: StatusApply; at?: 'self' | 'target'; delay?: number; element?: Element; pull?: number }
  | { op: 'zone'; zone: ZoneSpec; at: 'self' | 'target'; follow?: boolean; delay?: number }
  | { op: 'shield'; amount: number; duration: number; radius?: number; delay?: number }
  | { op: 'buff'; status: StatusApply; radius?: number; delay?: number }
  | { op: 'heal'; amount: number; radius?: number; delay?: number }
  | { op: 'invis'; duration: number; delay?: number }
  | { op: 'clone'; count: number; duration: number; hpFrac: number; delay?: number }
  | { op: 'wall'; length: number; hp: number; duration: number; delay?: number }
  | { op: 'turret'; hp: number; duration: number; spec: ProjectileSpec; rate: number; delay?: number }
  | { op: 'reveal'; radius: number; duration: number; delay?: number }
  | { op: 'cleanse'; delay?: number }
  | { op: 'repeat'; times: number; interval: number; ops: Op[]; delay?: number };

export interface AbilityDef {
  name: string;
  desc: string;
  cooldown: number;          // seconds (skills). For ult: ignored
  startup: number;           // frames of wind-up (telegraph)
  recovery: number;          // frames
  aim: 'dir' | 'point' | 'self';
  range: number;             // tiles (for point aim/auto aim)
  ops: Op[];
  stealth?: 'break' | 'keep'; // default break
  cancelable?: boolean;
}

export type PassiveType =
  | 'backstab' | 'lowHpDefense' | 'frostStacks' | 'hitStreakAtkSpeed' | 'comboDamage' | 'healCharge'
  | 'poisonOnHit' | 'bleedOnHit' | 'burnOnHit' | 'executeBonus' | 'revengeStack' | 'frontArmor'
  | 'movingArmor' | 'stillAccuracy' | 'lifesteal' | 'ambush' | 'chainHit' | 'slowOnHit'
  | 'speedOnKill' | 'shieldOnSkill' | 'ultChargeBonus' | 'bushPower' | 'markOnHit' | 'thorns'
  | 'rangeScaling' | 'closeScaling' | 'cooldownOnHit' | 'entropy' | 'allyAura' | 'dodgeChance';

export interface PassiveDef { type: PassiveType; name: string; desc: string; p1: number; p2?: number; p3?: number }

export type Category = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type Role = 'ASSASSIN' | 'TANK' | 'MARKSMAN' | 'FIGHTER' | 'CONTROLLER' | 'SUPPORT' | 'SPECIALIST';
export type ImplStatus = 'complete' | 'prototype';

export interface CharacterDef {
  id: number;            // 1..200
  key: string;           // e.g. "SHADOW"
  name: string;
  category: Category;
  combatType: string;
  role: Role;
  mechanic: string;      // signature mechanic (JP)
  hp: number;
  speedClass: SpeedClass;
  attack: AttackDef;
  skill1: AbilityDef;
  skill2: AbilityDef;
  ult: AbilityDef;
  ultCharge: number;     // damage-equivalent needed (normalised by attack damage)
  passive: PassiveDef;
  combo: string;
  strongVs: string;
  weakVs: string;
  weakness: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  tactics: string;
  color: string;         // signature color
  status: ImplStatus;
  note?: string;
}
