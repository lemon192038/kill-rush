import { DT } from '../core/constants';
import { createWorld, stepWorld } from '../sim/world';
import type { MatchConfig, MatchResult, World } from '../sim/types';
import { Renderer } from '../render/renderer';
import { PlayerInput, TouchControls } from '../input/input';
import type { AudioEngine } from '../audio/sfx';
import type { SaveData } from '../meta/save';
import { h, confirmBox } from './dom';

export interface GameHandle { world: World; stop(): void }

export function isTouchDevice() { return 'ontouchstart' in window || navigator.maxTouchPoints > 0; }

/** Runs a match: fixed 60Hz simulation, render decoupled (FPS drops never change game time per tick). */
export function runGame(root: HTMLElement, cfg: MatchConfig, save: SaveData, audio: AudioEngine, onEnd: (r: MatchResult, w: World, aborted: boolean) => void): GameHandle {
  root.innerHTML = '';
  document.body.classList.add('in-game');
  const wrap = h('div', { class: 'game-wrap' });
  const canvas = h('canvas', { class: 'game-canvas' });
  wrap.appendChild(canvas); root.appendChild(wrap);
  const world = createWorld(cfg);
  const player = world.fighters.find(f => f.isPlayer)!;
  const renderer = new Renderer(canvas, audio);
  renderer.reset(world, player.id);
  const input = new PlayerInput(save.settings.keys);
  input.aimAssist = save.settings.aimAssist;
  input.attach(canvas);
  const touch = isTouchDevice();
  let tc: TouchControls | null = null;
  if (touch) {
    tc = new TouchControls(wrap, input, save.settings.touchLayouts[save.settings.activeLayout] ?? save.settings.touchLayouts.default, () => world.fighters.find(f => f.isPlayer) ?? null);
    tc.setPassVisible(cfg.mode.id === 'goal');
    input.touchMode = true;
  }
  const menuBtn = h('button', { class: 'pause-btn', onclick: () => openMenu() }, 'Ⅱ');
  wrap.appendChild(menuBtn);
  let paused = false, stopped = false, ended = false, endT = 0;
  const openMenu = () => {
    if (paused || ended) return; paused = true;
    const leaveText = cfg.practice ? '練習を終了' : cfg.championship ? '退出（敗北扱い・ペナルティ）' : '退出（敗北扱い）';
    const ov = h('div', { class: 'pause-ov' }, h('div', { class: 'pause-box' },
      h('h2', {}, cfg.practice ? '練習場' : 'PAUSE'),
      h('p', { class: 'muted' }, cfg.practice ? '' : 'CPU戦のため一時停止できます（オンライン対戦は未実装）。'),
      h('button', { class: 'btn primary', onclick: () => { ov.remove(); paused = false; } }, '再開'),
      h('button', { class: 'btn danger', onclick: () => { const leave = () => { ov.remove(); finish(true); }; if (cfg.practice) leave(); else confirmBox('退出確認', leaveText + 'になります。よろしいですか？', leave, '退出', true); } }, leaveText),
    ));
    wrap.appendChild(ov);
  };
  input.onMenu = openMenu;
  const onResize = () => renderer.resize();
  window.addEventListener('resize', onResize); renderer.resize();
  const onVis = () => { if (document.hidden && !cfg.practice) openMenu(); };
  document.addEventListener('visibilitychange', onVis);
  let acc = 0, last = performance.now(), fps = 60, frameSkip = 0;
  const finish = (aborted: boolean) => {
    if (stopped) return; stopped = true; cleanup();
    let r = world.over;
    if (!r || aborted) {
      // forfeit: counts as a loss for player team
      r = { winnerTeam: null, outcome: cfg.practice ? 'draw' : 'loss', playerTeam: cfg.playerTeam, placement: cfg.mode.teams, totalTeams: cfg.mode.teams, durationSec: world.time, stats: { ...player.stats }, perFighter: world.fighters.filter(f => f.cloneOf === null).map(f => ({ id: f.id, name: f.name, team: f.team, charKey: f.char.key, stats: { ...f.stats }, isPlayer: f.isPlayer, cpuRank: f.cpu?.rank })), mvpId: -1, modeScore: {}, reason: '途中退出' };
    }
    onEnd(r, world, aborted);
  };
  const loop = (now: number) => {
    if (stopped) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    fps = fps * 0.95 + (1 / Math.max(0.001, dt)) * 0.05;
    if (!paused) {
      acc += dt;
      let steps = 0;
      while (acc >= DT && steps < 5) {
        const p = world.fighters.find(f => f.isPlayer)!;
        if (p.alive && !world.over) input.apply(world, p, renderer, DT);
        stepWorld(world); acc -= DT; steps++;
      }
      if (steps >= 5) acc = 0; // device too slow: slow down rather than skip simulation fidelity
    }
    const cap = save.settings.fpsCap;
    frameSkip++;
    if (cap >= 60 || frameSkip % 2 === 0) {
      renderer.render(world, cap >= 60 ? dt : dt * 2, { quality: save.settings.quality, shake: save.settings.shake, damageNumbers: save.settings.damageNumbers, showFps: save.settings.showFps, fps, scoreboard: input.scoreboard, aim: input.aim, showCpuInfo: save.settings.showCpuInfo, touch });
      const p = world.fighters.find(f => f.isPlayer); if (tc && p) tc.update(p);
    }
    if (world.over && !ended) { ended = true; endT = now; }
    if (ended && now - endT > 2600) { finish(false); return; }
    requestAnimationFrame(loop);
  };
  const cleanup = () => { document.body.classList.remove('in-game'); input.detach(); tc?.destroy(); window.removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVis); };
  requestAnimationFrame(loop);
  return { world, stop: () => { stopped = true; cleanup(); } };
}
