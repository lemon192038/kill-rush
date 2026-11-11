export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const TILE = 64;
export const FIGHTER_RADIUS = 22;
/** Speed classes in px/sec */
export const SPEED = { VERY_SLOW: 175, SLOW: 195, NORMAL: 220, FAST: 245, VERY_FAST: 270 } as const;
export type SpeedClass = keyof typeof SPEED;
