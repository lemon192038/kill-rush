export type ModeId = 'ffa' | 'tdm' | 'duel' | 'boss' | 'br-solo' | 'br-duo' | 'br-trio' | 'br-mega' | 'gem' | 'deathmatch' | 'vault' | 'territory' | 'goal';
export interface ModeDef {
  id: ModeId; name: string; jp: string; desc: string;
  teams: number; teamSize: number; duration: number; respawn: number | null;
  maps: string[]; powerCubes: boolean; championship: boolean; group: 'basic' | 'br' | 'team' | 'special';
}
export const MODES: ModeDef[] = [
  { id: 'ffa', name: 'FREE FOR ALL', jp: 'フリーフォーオール', desc: '6人全員が敵。120秒で最もキルした者が勝利。', teams: 6, teamSize: 1, duration: 120, respawn: 3, maps: ['ruins', 'forest', 'volcano', 'neon'], powerCubes: false, championship: false, group: 'basic' },
  { id: 'tdm', name: 'TEAM DEATHMATCH', jp: 'チームデスマッチ', desc: '3対3。180秒以内にチーム合計20キルで勝利。', teams: 2, teamSize: 3, duration: 180, respawn: 3, maps: ['tdm-ruins', 'tdm-neon', 'emerald-forest'], powerCubes: false, championship: true, group: 'basic' },
  { id: 'duel', name: 'DUEL', jp: 'デュエル', desc: '1対1のラウンド制。先に2ラウンド取った方の勝利。', teams: 2, teamSize: 1, duration: 60, respawn: null, maps: ['duel-ruins'], powerCubes: false, championship: false, group: 'basic' },
  { id: 'boss', name: 'BOSS HUNT', jp: 'ボスハント', desc: '味方CPU2人と協力して巨大ボスを180秒以内に討伐。', teams: 2, teamSize: 3, duration: 180, respawn: 4, maps: ['boss-volcano'], powerCubes: false, championship: false, group: 'basic' },
  { id: 'br-solo', name: 'SOLO BATTLE ROYALE', jp: 'ソロバトルロワイヤル', desc: '10人の個人戦。箱を壊して⚡を集め、最後の1人を目指せ。', teams: 10, teamSize: 1, duration: 240, respawn: null, maps: ['br-isle'], powerCubes: true, championship: false, group: 'br' },
  { id: 'br-duo', name: 'DUO BATTLE ROYALE', jp: 'デュオバトルロワイヤル', desc: '2人×5チーム。味方は一度だけ復活可能。', teams: 5, teamSize: 2, duration: 240, respawn: null, maps: ['br-isle'], powerCubes: true, championship: false, group: 'br' },
  { id: 'br-trio', name: 'TRIO BATTLE ROYALE', jp: 'トリオバトルロワイヤル', desc: '3人×4チーム。', teams: 4, teamSize: 3, duration: 240, respawn: null, maps: ['br-isle'], powerCubes: true, championship: false, group: 'br' },
  { id: 'br-mega', name: 'MEGA BATTLE ROYALE', jp: 'メガバトルロワイヤル', desc: '20人の大規模個人戦。', teams: 20, teamSize: 1, duration: 300, respawn: null, maps: ['br-mega'], powerCubes: true, championship: false, group: 'br' },
  { id: 'gem', name: 'GEM HUNT', jp: 'ジェムハント', desc: '中央鉱山のジェムを10個以上保持して15秒耐えれば勝利。', teams: 2, teamSize: 3, duration: 180, respawn: 3, maps: ['crystal-mine', 'emerald-forest', 'neon-reactor'], powerCubes: false, championship: true, group: 'team' },
  { id: 'deathmatch', name: 'DEATHMATCH', jp: 'デスマッチ', desc: '復活なし3ラウンド制。先に2ラウンド取ったチームの勝利。', teams: 2, teamSize: 3, duration: 90, respawn: null, maps: ['ruined-colosseum', 'lava-crossing', 'dead-city'], powerCubes: false, championship: true, group: 'team' },
  { id: 'vault', name: 'VAULT BREAK', jp: 'ヴォルトブレイク', desc: '敵の金庫（HP30000）を先に破壊したチームの勝利。', teams: 2, teamSize: 3, duration: 180, respawn: 3, maps: ['golden-fortress', 'iron-factory', 'cyber-bank'], powerCubes: false, championship: true, group: 'team' },
  { id: 'territory', name: 'TERRITORY BATTLE', jp: 'テリトリーバトル', desc: '2か所のエリアを占領し、占領率100%で勝利。', teams: 2, teamSize: 3, duration: 180, respawn: 3, maps: ['green-frontier', 'temple-control', 'neon-dominion'], powerCubes: false, championship: true, group: 'team' },
  { id: 'goal', name: 'KILL & GOAL', jp: 'キル＆ゴール', desc: 'ボールを敵ゴールへ。先に2点で勝利。同点なら延長戦。', teams: 2, teamSize: 3, duration: 180, respawn: 3, maps: ['neon-stadium', 'ancient-arena', 'magma-field', 'cyber-arena'], powerCubes: false, championship: true, group: 'special' },
];
export const MODE_BY_ID = new Map(MODES.map(m => [m.id, m]));
export const CHAMPIONSHIP_MODES: ModeId[] = ['tdm', 'gem', 'deathmatch', 'vault', 'territory', 'goal'];
export function getMode(id: ModeId): ModeDef { const m = MODE_BY_ID.get(id); if (!m) throw new Error(id); return m; }
