/** Original combat-system hooks (spec §18). `implemented` reflects the actual code state. */
export interface SystemDef { id: string; name: string; desc: string; implemented: boolean; where?: string }
export const COMBAT_SYSTEMS: SystemDef[] = [
  { id: 'KILL_CHAIN', name: 'KILL CHAIN', desc: '3連続キル以上でアナウンス。最大連続キルをリザルトに記録。', implemented: true, where: 'sim/combat.ts killFighter' },
  { id: 'COMBO_RANK', name: 'COMBO RANK', desc: '連続ヒット数に応じてC/B/A/Sランク表示。', implemented: true, where: 'render/renderer.ts drawHud' },
  { id: 'DANGER_WARNING', name: 'DANGER WARNING', desc: 'HP30%未満で画面縁が赤く点滅。', implemented: true, where: 'render/renderer.ts drawHud' },
  { id: 'RUSH_MODE', name: 'RUSH MODE', desc: '一定条件で一時的に全能力上昇（未実装）。', implemented: false },
  { id: 'REVENGE', name: 'REVENGE', desc: '自分を倒した相手を倒すとボーナス演出（未実装）。', implemented: false },
  { id: 'NEMESIS', name: 'NEMESIS', desc: '同じ相手に繰り返し倒されると宿敵表示（未実装）。', implemented: false },
  { id: 'LAST_STAND', name: 'LAST STAND', desc: 'チーム最後の生存者に一時バフ（未実装）。', implemented: false },
  { id: 'BOUNTY_TARGET', name: 'BOUNTY TARGET', desc: '連続キル中の相手に懸賞金（未実装）。', implemented: false },
  { id: 'CLUTCH_MOMENT', name: 'CLUTCH MOMENT', desc: '劣勢時の演出（未実装。CPU性格CLUTCHの集中力補正のみ実装）。', implemented: false },
  { id: 'RIVAL_MATCH', name: 'RIVAL MATCH', desc: '因縁の相手との再戦表示（未実装）。', implemented: false },
];
