import { TILE } from '../core/constants';
import { MAP_THEMES, T, type MapTheme } from '../data/maps';
import { RARITY_LAYERS, SKIN_BY_ID, themeOf } from '../data/skins';
import { has } from '../sim/combat';
import { isHidden } from '../sim/fighter';
import { BALL_R, territoryZones } from '../sim/modes';
import type { Fighter, GameEvent, World } from '../sim/types';
import { drawFighter, hexA } from './fighterArt';
import { Particles } from './particles';
import type { AudioEngine } from '../audio/sfx';

export interface AimPreview { slot: 0 | 1 | 2 | 3; ang: number; dist: number; active: boolean }
export interface RenderOpts { quality: 'low' | 'medium' | 'high'; shake: number; damageNumbers: boolean; showFps: boolean; fps: number; scoreboard: boolean; aim: AimPreview; showCpuInfo: boolean; touch: boolean }

const ALLY = '#3fa9ff', ENEMY = '#ff3b5c', SELF = '#ffd23f';

export class Renderer {
  ctx: CanvasRenderingContext2D;
  parts = new Particles();
  camX = 0; camY = 0; zoom = 1; shakeT = 0; shakeMag = 0; dpr = 1; W = 0; H = 0;
  floor: HTMLCanvasElement | null = null; floorSig = '';
  flash = new Map<number, number>(); announce: { text: string; color: string; big: boolean; t: number }[] = [];
  lastPos = new Map<number, { x: number; y: number }>();
  time = 0; viewCx = 0; viewCy = 0; theme!: MapTheme; viewerId = -1; vignette: CanvasGradient | null = null;
  constructor(public canvas: HTMLCanvasElement, public audio: AudioEngine | null) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    this.canvas.width = Math.round(this.W * this.dpr); this.canvas.height = Math.round(this.H * this.dpr);
    this.vignette = null;
  }
  reset(w: World, viewerId: number) {
    this.parts.clear(); this.floor = null; this.flash.clear(); this.announce = []; this.viewerId = viewerId;
    this.theme = MAP_THEMES[w.map.def.theme];
    const p = w.fighters.find(f => f.id === viewerId); if (p) { this.camX = p.x; this.camY = p.y; }
  }
  private buildFloor(w: World) {
    const c = document.createElement('canvas'); c.width = w.map.w * TILE; c.height = w.map.h * TILE;
    const g = c.getContext('2d')!; const th = this.theme;
    for (let y = 0; y < w.map.h; y++) for (let x = 0; x < w.map.w; x++) {
      const t = w.map.tiles[y * w.map.w + x];
      g.fillStyle = (x + y) % 2 ? th.floorA : th.floorB; g.fillRect(x * TILE, y * TILE, TILE, TILE);
      // subtle noise speckles
      g.fillStyle = 'rgba(0,0,0,0.05)'; for (let k = 0; k < 3; k++) g.fillRect(x * TILE + ((x * 37 + y * 17 + k * 23) % 56), y * TILE + ((x * 13 + y * 41 + k * 7) % 56), 4, 4);
      if (t === T.WATER) { g.fillStyle = th.water; g.fillRect(x * TILE, y * TILE, TILE, TILE); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x * TILE, y * TILE, TILE, 6); }
      if (t === T.HAZARD) { g.fillStyle = hexA(th.hazard, 0.35); g.fillRect(x * TILE, y * TILE, TILE, TILE); g.strokeStyle = hexA(th.hazard, 0.9); g.lineWidth = 3; g.setLineDash([8, 6]); g.strokeRect(x * TILE + 3, y * TILE + 3, TILE - 6, TILE - 6); g.setLineDash([]); g.fillStyle = hexA(th.hazard, 0.8); g.font = '900 20px sans-serif'; g.textAlign = 'center'; g.fillText('⚠', x * TILE + 32, y * TILE + 40); }
      if (t === T.JUMP) { g.fillStyle = '#2b2b3a'; g.beginPath(); g.arc(x * TILE + 32, y * TILE + 32, 26, 0, 7); g.fill(); g.strokeStyle = '#7cff4f'; g.lineWidth = 4; g.beginPath(); g.arc(x * TILE + 32, y * TILE + 32, 20, 0, 7); g.stroke(); g.fillStyle = '#7cff4f'; g.beginPath(); g.moveTo(x * TILE + 32, y * TILE + 18); g.lineTo(x * TILE + 42, y * TILE + 34); g.lineTo(x * TILE + 22, y * TILE + 34); g.fill(); }
      if (t === T.HEAL) { g.fillStyle = 'rgba(80,255,150,0.25)'; g.beginPath(); g.arc(x * TILE + 32, y * TILE + 32, 28, 0, 7); g.fill(); g.fillStyle = '#5dff9d'; g.fillRect(x * TILE + 27, y * TILE + 16, 10, 32); g.fillRect(x * TILE + 16, y * TILE + 27, 32, 10); }
      if (t === T.GOAL0 || t === T.GOAL1) { g.fillStyle = t === T.GOAL0 ? hexA(ALLY, 0.5) : hexA(ENEMY, 0.5); g.fillRect(x * TILE, y * TILE, TILE, TILE); g.strokeStyle = '#ffffff'; g.lineWidth = 2; for (let k = 0; k < TILE; k += 12) { g.beginPath(); g.moveTo(x * TILE + k, y * TILE); g.lineTo(x * TILE + k, y * TILE + TILE); g.stroke(); } }
    }
    // soccer field markings
    if (w.map.def.kind === 'soccer') { g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 4; g.beginPath(); g.moveTo(TILE, c.height / 2); g.lineTo(c.width - TILE, c.height / 2); g.stroke(); g.beginPath(); g.arc(c.width / 2, c.height / 2, 3 * TILE, 0, 7); g.stroke(); }
    // gem mine
    if (w.cfg.mode.id === 'gem') { const cx = c.width / 2, cy = c.height / 2; const gr = g.createRadialGradient(cx, cy, 10, cx, cy, 90); gr.addColorStop(0, '#d48bff'); gr.addColorStop(1, 'rgba(120,60,200,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 90, 0, 7); g.fill(); g.fillStyle = '#3a2350'; g.beginPath(); g.arc(cx, cy, 34, 0, 7); g.fill(); }
    this.floor = c;
  }
  private floorSignature(w: World): string { let h = 0; for (let i = 0; i < w.map.tiles.length; i++) if (w.map.tiles[i] === T.WATER || w.map.tiles[i] === T.HAZARD) h = (h * 31 + i) | 0; return String(h); }

  consume(w: World) {
    const viewer = w.fighters.find(f => f.id === this.viewerId);
    for (const e of w.events) this.onEvent(w, e, viewer);
    w.events.length = 0;
  }
  private onEvent(w: World, e: GameEvent, viewer?: Fighter) {
    const A = this.audio; const P = this.parts;
    const near = (x: number, y: number) => !viewer || Math.hypot(x - viewer.x, y - viewer.y) < 14 * TILE;
    switch (e.type) {
      case 'hit': {
        if (e.heal) { P.text(e.x, e.y - 10, `+${e.dmg}`, '#5dff9d', 17); break; }
        this.flash.set(e.target, 1);
        const mine = e.src === this.viewerId, onMe = e.target === this.viewerId;
        if (mine || onMe || near(e.x, e.y)) {
          const col = e.shield ? '#9be8ff' : e.crit ? '#ffd23f' : onMe ? '#ff6b7a' : '#ffffff';
          P.text(e.x, e.y - 12, e.crit ? `${e.dmg}!` : String(e.dmg), col, e.crit ? 24 : mine ? 19 : 15, e.crit);
          P.burst(e.x, e.y + 14, e.crit ? 12 : 6, 220, e.element === 'fire' ? '#ff7a2f' : e.element === 'ice' ? '#9be8ff' : '#ffffff', 2.5, 0.35);
          if (mine) A?.play(e.crit ? 'crit' : 'hit'); else if (onMe) { A?.play('hurt'); this.shake(4); }
        }
        break;
      }
      case 'kill': {
        const victim = w.fighters.find(f => f.id === e.victim); const col = victim ? themeOf(victim.skinId).accent : '#fff';
        const killer = w.fighters.find(f => f.id === e.killer);
        const kfx = killer ? SKIN_BY_ID.get(killer.skinId)?.fx.killFx : undefined;
        P.burst(e.x, e.y, 40, 420, col, 4, 0.8, 1); P.ring(e.x, e.y, 90, col, 0.5);
        if (kfx === 'pillar' || kfx === 'lightning') for (let i = 0; i < 20; i++) P.spawn(e.x + (Math.random() - 0.5) * 20, e.y, 0, -600 - Math.random() * 400, 0.6, 4, '#ffffff');
        else if (kfx === 'confetti' || kfx === 'petals') P.burst(e.x, e.y, 40, 300, ['#ff4fd8', '#ffd23f', '#3fa9ff', '#7cff4f'][Math.floor(Math.random() * 4)], 4, 1.2, 1);
        else if (kfx === 'vortex' || kfx === 'blackflame') P.ring(e.x, e.y, 140, '#b07cff', 0.8, true);
        if (e.killer === this.viewerId) { A?.play('kill'); this.announce.push({ text: 'KILL!', color: '#ffd23f', big: false, t: 1.2 }); }
        else if (e.victim === this.viewerId) { A?.play('death'); this.shake(10); }
        else if (near(e.x, e.y)) A?.play('kill', 0.4);
        break;
      }
      case 'shot': if (near(e.x, e.y)) { A?.play(e.pattern === 'melee' ? 'swing' : e.pattern === 'kick' ? 'kick' : e.pattern === 'shotgun' ? 'shotgun' : e.pattern === 'lob' || e.pattern === 'explode' ? 'lob' : 'shoot', e.owner === this.viewerId ? 1 : 0.35); } break;
      case 'explode': {
        if (e.r < 0) { // melee arc swoosh
          P.ring(e.x, e.y, -e.r * 0.6, e.color, 0.18); break;
        }
        P.ring(e.x, e.y, e.r, e.color, 0.4, true); P.burst(e.x, e.y, Math.min(40, 8 + e.r / 6), e.r * 3, e.color, 4, 0.5);
        if (e.r > 60 && near(e.x, e.y)) { A?.play('boom', Math.min(1, e.r / 200)); this.shake(Math.min(12, e.r / 20)); }
        break;
      }
      case 'cast': if (e.owner === this.viewerId || near(e.x, e.y)) { A?.play(e.slot === 3 ? 'ult' : 'skill', e.owner === this.viewerId ? 1 : 0.4); if (e.slot === 3) { const f = w.fighters.find(x => x.id === e.owner); P.ring(e.x, e.y, 120, f ? themeOf(f.skinId).accent : '#fff', 0.6); if (e.owner === this.viewerId) this.announce.push({ text: e.name, color: '#ff4fd8', big: false, t: 1.4 }); } } break;
      case 'telegraph': P.ring(e.x, e.y, e.r, e.ult ? '#ff4fd8' : '#ffffff', Math.max(0.15, e.t), true); break;
      case 'pickup': if (e.owner === this.viewerId) A?.play('pickup'); break;
      case 'goal': A?.play('goal'); this.shake(14); break;
      case 'announce': this.announce.push({ text: e.text, color: e.color ?? '#fff', big: !!e.big, t: e.big ? 2.2 : 1.8 }); if (e.big && (e.text === 'VICTORY' || e.text === 'DEFEAT')) A?.play(e.text === 'VICTORY' ? 'victory' : 'defeat'); break;
      case 'boxbreak': P.burst(e.x, e.y, 30, 300, '#ffd23f', 4, 0.7, 1); A?.play('boom', 0.6); break;
      case 'dodge': { const f = w.fighters.find(x => x.id === e.owner); if (f) P.burst(f.x, f.y, 10, 200, '#ffffff', 3, 0.3); if (e.owner === this.viewerId) A?.play('dodge'); break; }
      case 'respawn': { const f = w.fighters.find(x => x.id === e.owner); if (f) { const fx = SKIN_BY_ID.get(f.skinId)?.fx.entranceFx; P.ring(f.x, f.y, kfxRadius(fx), themeOf(f.skinId).accent, 0.6, true); } break; }
      case 'status': if (e.kind === 'freeze' || e.kind === 'stun') { const f = w.fighters.find(x => x.id === e.target); if (f) P.burst(f.x, f.y, 10, 120, e.kind === 'freeze' ? '#9be8ff' : '#ffe94a', 3, 0.5); } break;
    }
  }
  worldToScreen(x: number, y: number) { return { x: (x - this.viewCx) * this.zoom + this.W / 2, y: (y - this.viewCy) * this.zoom + this.H / 2 }; }
  shake(m: number) { this.shakeMag = Math.max(this.shakeMag, m); this.shakeT = 0.25; }

  render(w: World, dt: number, o: RenderOpts) {
    this.time += dt;
    const ctx = this.ctx; const viewer = w.fighters.find(f => f.id === this.viewerId) ?? w.fighters[0];
    const sig = this.floorSignature(w);
    if (!this.floor || sig !== this.floorSig) { this.buildFloor(w); this.floorSig = sig; }
    this.consume(w);
    this.parts.update(dt);
    // camera
    const short = Math.min(this.W, this.H);
    const baseTiles = (this.W > this.H ? 12.5 : 13.5) * (o.touch && short < 600 ? 0.85 : 1); // visible tiles on the short side
    let zoom = short / (baseTiles * TILE);
    if (w.ultZoomT > 0 || viewer.casting?.slot === 3) zoom *= 0.85;
    if (w.cfg.mode.id === 'br-mega' || w.cfg.mode.id.startsWith('br')) zoom *= 0.95;
    this.zoom += (zoom - this.zoom) * Math.min(1, dt * 4);
    const look = viewer.alive ? 1 : 0;
    const tx = viewer.x + viewer.lastMoveX * TILE * 1.4 * look, ty = viewer.y + viewer.lastMoveY * TILE * 1.4 * look;
    const k = Math.min(1, dt * 6);
    this.camX += (tx - this.camX) * k; this.camY += (ty - this.camY) * k;
    const halfW = this.W / 2 / this.zoom, halfH = this.H / 2 / this.zoom;
    const MW = w.map.w * TILE, MH = w.map.h * TILE;
    const cx = MW < halfW * 2 ? MW / 2 : Math.max(halfW, Math.min(MW - halfW, this.camX));
    const cy = MH < halfH * 2 ? MH / 2 : Math.max(halfH, Math.min(MH - halfH, this.camY));
    this.viewCx = cx; this.viewCy = cy;
    let sx = 0, sy = 0;
    if (this.shakeT > 0) { this.shakeT -= dt; const m = this.shakeMag * o.shake * (this.shakeT / 0.25); sx = (Math.random() - 0.5) * m; sy = (Math.random() - 0.5) * m; } else this.shakeMag = 0;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0b0b14'; ctx.fillRect(0, 0, this.W, this.H);
    ctx.save();
    ctx.translate(this.W / 2 + sx, this.H / 2 + sy); ctx.scale(this.zoom, this.zoom); ctx.translate(-cx, -cy);
    const x0 = cx - halfW - TILE, y0 = cy - halfH - TILE, x1 = cx + halfW + TILE, y1 = cy + halfH + TILE;
    ctx.drawImage(this.floor!, 0, 0);
    this.drawWaterAnim(ctx, w, x0, y0, x1, y1);
    this.drawObjectives(ctx, w, viewer);
    this.drawZones(ctx, w);
    this.drawPickups(ctx, w);
    this.drawStructures(ctx, w, viewer);
    if (o.aim.active && viewer.alive) this.drawAim(ctx, viewer, o.aim);
    // fighters (y-sorted) & walls interleaved by row
    const vis = w.visibility[viewer.team] ?? new Uint8Array(0);
    const drawList: { y: number; f?: Fighter; row?: number }[] = [];
    w.fighters.forEach((f, i) => { if (f.alive && (vis[i] || f.team === viewer.team)) drawList.push({ y: f.y, f }); });
    const ty0 = Math.max(0, Math.floor(y0 / TILE)), ty1 = Math.min(w.map.h - 1, Math.floor(y1 / TILE));
    for (let r = ty0; r <= ty1; r++) drawList.push({ y: r * TILE + TILE * 0.98, row: r });
    drawList.sort((a, b) => a.y - b.y);
    for (const d of drawList) {
      if (d.row !== undefined) this.drawWallRow(ctx, w, d.row, x0, x1);
      else if (d.f) this.drawFighterEntity(ctx, w, d.f, viewer, o);
    }
    this.drawBall(ctx, w);
    this.drawProjectiles(ctx, w, x0, y0, x1, y1);
    this.drawBushes(ctx, w, viewer, x0, y0, x1, y1);
    this.drawStorm(ctx, w);
    this.parts.draw(ctx, x0, y0, x1, y1);
    // overhead bars
    w.fighters.forEach((f, i) => { if (f.alive && (vis[i] || f.team === viewer.team)) this.drawBars(ctx, w, f, viewer, o); });
    if (o.damageNumbers) this.parts.drawText(ctx);
    ctx.restore();
    // vignette
    if (o.quality !== 'low') {
      if (!this.vignette) { this.vignette = ctx.createRadialGradient(this.W / 2, this.H / 2, short * 0.45, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.75); this.vignette.addColorStop(0, 'rgba(0,0,0,0)'); this.vignette.addColorStop(1, 'rgba(0,0,0,0.45)'); }
      ctx.fillStyle = this.vignette; ctx.fillRect(0, 0, this.W, this.H);
    }
    if (!viewer.alive && !w.over) { ctx.fillStyle = 'rgba(40,0,10,0.35)'; ctx.fillRect(0, 0, this.W, this.H); }
    this.drawHud(ctx, w, viewer, o);
  }

  private drawWaterAnim(ctx: CanvasRenderingContext2D, w: World, x0: number, y0: number, x1: number, y1: number) {
    const th = this.theme;
    for (let ty = Math.max(0, Math.floor(y0 / TILE)); ty <= Math.min(w.map.h - 1, Math.floor(y1 / TILE)); ty++)
      for (let tx = Math.max(0, Math.floor(x0 / TILE)); tx <= Math.min(w.map.w - 1, Math.floor(x1 / TILE)); tx++) {
        const t = w.map.tiles[ty * w.map.w + tx];
        if (t === T.WATER) { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); const o = (this.time * 20 + tx * 9) % 64; ctx.moveTo(tx * TILE + 6, ty * TILE + o); ctx.quadraticCurveTo(tx * TILE + 32, ty * TILE + o - 6, tx * TILE + 58, ty * TILE + o); ctx.stroke(); }
        else if (t === T.HAZARD) { ctx.fillStyle = hexA(th.hazard, 0.1 + 0.1 * Math.sin(this.time * 4 + tx + ty)); ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE); }
      }
  }
  private drawWallRow(ctx: CanvasRenderingContext2D, w: World, row: number, x0: number, x1: number) {
    const th = this.theme;
    for (let tx = Math.max(0, Math.floor(x0 / TILE)); tx <= Math.min(w.map.w - 1, Math.floor(x1 / TILE)); tx++) {
      const t = w.map.tiles[row * w.map.w + tx];
      if (t !== T.WALL && t !== T.CRATE) continue;
      const x = tx * TILE, y = row * TILE, H = 18;
      if (t === T.WALL) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 6, y + TILE - 4, TILE, 10);
        ctx.fillStyle = th.wallSide; ctx.fillRect(x, y + TILE - H, TILE, H);
        ctx.fillStyle = th.wallTop; ctx.fillRect(x, y - H, TILE, TILE);
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, y - H, TILE, 5);
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y - H + 1, TILE - 2, TILE - 2);
      } else {
        const hp = w.map.crateHp[row * w.map.w + tx];
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 8, y + TILE - 6, TILE - 6, 10);
        ctx.fillStyle = th.crate; ctx.fillRect(x + 4, y - 8, TILE - 8, TILE - 4);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3; ctx.strokeRect(x + 6, y - 6, TILE - 12, TILE - 8);
        ctx.beginPath(); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x + TILE - 6, y + TILE - 14); ctx.moveTo(x + TILE - 6, y - 6); ctx.lineTo(x + 6, y + TILE - 14); ctx.stroke();
        if (hp < 1200) { ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.moveTo(x + 20, y); ctx.lineTo(x + 30, y + 20); ctx.lineTo(x + 24, y + 34); ctx.stroke(); }
      }
    }
  }
  private drawBushes(ctx: CanvasRenderingContext2D, w: World, viewer: Fighter, x0: number, y0: number, x1: number, y1: number) {
    const th = this.theme;
    for (let ty = Math.max(0, Math.floor(y0 / TILE)); ty <= Math.min(w.map.h - 1, Math.floor(y1 / TILE)); ty++)
      for (let tx = Math.max(0, Math.floor(x0 / TILE)); tx <= Math.min(w.map.w - 1, Math.floor(x1 / TILE)); tx++) {
        if (w.map.tiles[ty * w.map.w + tx] !== T.BUSH) continue;
        const x = tx * TILE + 32, y = ty * TILE + 32;
        const d = Math.hypot(viewer.x - x, viewer.y - y);
        ctx.globalAlpha = viewer.inBush && d < TILE * 2.6 ? 0.45 : 0.95;
        const sway = Math.sin(this.time * 2 + tx * 0.7 + ty) * 2;
        ctx.fillStyle = th.bushDark; ctx.beginPath(); ctx.arc(x - 10 + sway, y + 6, 24, 0, 7); ctx.arc(x + 12 + sway, y + 4, 22, 0, 7); ctx.fill();
        ctx.fillStyle = th.bush; ctx.beginPath(); ctx.arc(x - 8 + sway, y - 8, 22, 0, 7); ctx.arc(x + 12 + sway, y - 10, 20, 0, 7); ctx.arc(x + sway, y + 6, 20, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(x - 12 + sway, y - 16, 7, 0, 7); ctx.fill();
      }
    ctx.globalAlpha = 1;
  }
  private drawObjectives(ctx: CanvasRenderingContext2D, w: World, viewer: Fighter) {
    if (w.cfg.mode.id === 'territory') {
      const st = w.modeState as { owner: number[] };
      territoryZones(w).forEach((z, i) => {
        const own = st.owner?.[i] ?? -1;
        const col = own === -2 ? '#ffffff' : own === -1 ? '#bbbbbb' : own === viewer.team ? ALLY : ENEMY;
        ctx.fillStyle = hexA(col.startsWith('#') ? col : '#ffffff', 0.18); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.setLineDash([16, 10]); ctx.lineDashOffset = -this.time * 20;
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = col; ctx.font = '900 28px "Russo One",sans-serif'; ctx.textAlign = 'center'; ctx.fillText(['A', 'B'][i], z.x, z.y + 10);
      });
    }
  }
  private drawZones(ctx: CanvasRenderingContext2D, w: World) {
    for (const z of w.zones) {
      const owner = w.fighters.find(f => f.id === z.owner);
      const col = z.spec.healPs ? '#5dff9d' : z.spec.element === 'fire' ? '#ff7a2f' : z.spec.element === 'ice' ? '#9be8ff' : z.spec.element === 'poison' ? '#a6ff4a' : z.spec.element === 'dark' ? '#8a4dff' : owner ? themeOf(owner.skinId).accent : '#ffffff';
      const a = Math.min(1, z.t * 2);
      const g = ctx.createRadialGradient(z.x, z.y, z.r * 0.2, z.x, z.y, z.r);
      g.addColorStop(0, hexA(col, 0.08 * a)); g.addColorStop(1, hexA(col, 0.35 * a));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.fill();
      ctx.strokeStyle = hexA(col, 0.7 * a); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, this.time * 2, this.time * 2 + 5.5); ctx.stroke();
      if (z.spec.pull) { ctx.strokeStyle = hexA(col, 0.5 * a); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(z.x, z.y, z.r * ((this.time * 0.8 + i / 3) % 1), 0, 7); ctx.stroke(); } }
    }
  }
  private drawPickups(ctx: CanvasRenderingContext2D, w: World) {
    for (const p of w.pickups) {
      const bob = Math.sin(this.time * 5 + p.id) * 4;
      if (p.kind === 'cube') {
        ctx.save(); ctx.translate(p.x, p.y + bob); ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 16; ctx.fillStyle = '#ffd23f';
        ctx.beginPath(); ctx.moveTo(4, -16); ctx.lineTo(-8, 2); ctx.lineTo(0, 2); ctx.lineTo(-4, 16); ctx.lineTo(8, -2); ctx.lineTo(0, -2); ctx.closePath(); ctx.fill(); ctx.restore();
      } else {
        const blink = p.t < 4 && p.t < 9999 ? (Math.sin(this.time * 18) > 0 ? 0.4 : 1) : 1;
        ctx.save(); ctx.globalAlpha = blink; ctx.translate(p.x, p.y + bob); ctx.rotate(this.time); ctx.shadowColor = '#d48bff'; ctx.shadowBlur = 14;
        ctx.fillStyle = '#c070ff'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(10, 0); ctx.lineTo(0, 12); ctx.lineTo(-10, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f0d0ff'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(4, 0); ctx.lineTo(0, 4); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
  }
  private drawStructures(ctx: CanvasRenderingContext2D, w: World, viewer: Fighter) {
    for (const s of w.structures) {
      if (s.dead) continue;
      ctx.save(); ctx.translate(s.x, s.y);
      if (s.kind === 'box') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-24, 14, 52, 14);
        ctx.fillStyle = '#7a5a2a'; ctx.fillRect(-26, -26, 52, 46); ctx.fillStyle = '#c9a050'; ctx.fillRect(-26, -26, 52, 10);
        ctx.fillStyle = '#ffd23f'; ctx.font = '900 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('⚡', 0, 10);
        bar(ctx, -26, -36, 52, 6, s.hp / s.maxHp, '#ffd23f');
      } else if (s.kind === 'vault') {
        const col = s.team === viewer.team ? ALLY : ENEMY;
        ctx.shadowColor = col; ctx.shadowBlur = 20;
        ctx.fillStyle = '#3a3f4a'; ctx.beginPath(); ctx.roundRect(-40, -44, 80, 80, 14); ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, -4, 24, 0, 7); ctx.fill(); ctx.fillStyle = '#ffd23f'; ctx.font = '900 26px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('$', 0, 6);
        bar(ctx, -44, -60, 88, 9, s.hp / s.maxHp, col);
        ctx.fillStyle = '#fff'; ctx.font = '700 12px sans-serif'; ctx.fillText(`${Math.ceil(s.hp)}`, 0, -66);
      } else {
        const col = s.team === viewer.team ? ALLY : ENEMY;
        ctx.fillStyle = '#2a2a3a'; ctx.beginPath(); ctx.arc(0, 0, s.r, 0, 7); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, s.r * 0.45, 0, 7); ctx.fill();
        bar(ctx, -20, -32, 40, 5, s.hp / s.maxHp, col);
      }
      ctx.restore();
    }
  }
  private drawBall(ctx: CanvasRenderingContext2D, w: World) {
    const b = w.ball; if (!b || b.x < -1000) return;
    ctx.save(); ctx.translate(b.x, b.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(3, BALL_R * 0.8, BALL_R, BALL_R * 0.4, 0, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, BALL_R); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cfd8e8');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, BALL_R, 0, 7); ctx.fill();
    ctx.rotate((b.x + b.y) * 0.05); ctx.fillStyle = '#222'; for (let i = 0; i < 5; i++) { const a = i * 1.256; ctx.beginPath(); ctx.arc(Math.cos(a) * 7, Math.sin(a) * 7, 3, 0, 7); ctx.fill(); }
    ctx.restore();
    if (Math.hypot(b.vx, b.vy) > 300) this.parts.spawn(b.x, b.y, 0, 0, 0.25, 6, '#ffffff');
  }
  private drawProjectiles(ctx: CanvasRenderingContext2D, w: World, x0: number, y0: number, x1: number, y1: number) {
    ctx.save();
    for (const p of w.projectiles) {
      if (p.dead || p.x < x0 || p.y < y0 || p.x > x1 || p.y > y1) continue;
      if (p.lob) {
        const k = Math.min(1, p.lob.t / p.lob.T); const hgt = p.deployed ? 0 : Math.sin(k * Math.PI) * 60;
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.5, 0, 0, 7); ctx.fill();
        if (!p.deployed) { ctx.strokeStyle = hexA(p.color, 0.35); ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(p.lob.tx, p.lob.ty, (p.spec.explodeRadius ?? 1) * TILE, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
        ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(p.x, p.y - hgt, p.r, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
        if (p.deployed) { ctx.strokeStyle = Math.sin(this.time * 12) > 0 ? '#ff3b5c' : p.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 4, 0, 7); ctx.stroke(); }
        continue;
      }
      const sp = Math.hypot(p.vx, p.vy) || 1; const ux = p.vx / sp, uy = p.vy / sp;
      const L = Math.min(48, sp * 0.045) + p.r;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(p.x - ux * L, p.y - uy * L, p.x, p.y); g.addColorStop(0, hexA(p.color, 0)); g.addColorStop(1, hexA(p.color, 0.9));
      ctx.strokeStyle = g; ctx.lineWidth = p.r * 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x - ux * L, p.y - uy * L); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.6, 0, 7); ctx.fill();
      ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.stroke();
    }
    ctx.restore();
  }
  private drawStorm(ctx: CanvasRenderingContext2D, w: World) {
    const s = w.storm; if (!s) return;
    ctx.save(); ctx.fillStyle = 'rgba(60,200,120,0.28)';
    ctx.beginPath(); ctx.rect(-2000, -2000, w.map.w * TILE + 4000, w.map.h * TILE + 4000); ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2, true); ctx.fill('evenodd');
    ctx.strokeStyle = '#5dff9d'; ctx.lineWidth = 6; ctx.setLineDash([24, 12]); ctx.lineDashOffset = this.time * 30; ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r, 0, 7); ctx.stroke();
    ctx.restore();
  }
  private drawAim(ctx: CanvasRenderingContext2D, f: Fighter, a: AimPreview) {
    ctx.save(); ctx.translate(f.x, f.y);
    const ab = a.slot === 1 ? f.char.skill1 : a.slot === 2 ? f.char.skill2 : a.slot === 3 ? f.char.ult : null;
    const col = a.slot === 3 ? '#ff4fd8' : a.slot ? '#ffd23f' : '#ffffff';
    ctx.globalAlpha = 0.28; ctx.fillStyle = col; ctx.strokeStyle = col;
    if (!ab) {
      const at = f.char.attack; const R = (at.pattern === 'melee' ? at.range * TILE + f.radius : at.range * TILE);
      if (at.pattern === 'melee') { const arc = (at.arcDeg ?? 90) * Math.PI / 360; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a.ang - arc, a.ang + arc); ctx.closePath(); ctx.fill(); }
      else if (at.pattern === 'lob' || at.pattern === 'deploy') { const d = Math.min(R, a.dist || R); ctx.beginPath(); ctx.arc(Math.cos(a.ang) * d, Math.sin(a.ang) * d, (at.explodeRadius ?? 1) * TILE, 0, 7); ctx.fill(); }
      else if (at.spreadDeg) { const s = at.spreadDeg * Math.PI / 360; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a.ang - s, a.ang + s); ctx.closePath(); ctx.fill(); }
      else { ctx.rotate(a.ang); ctx.fillRect(0, -at.radius - 4, R, (at.radius + 4) * 2); }
    } else {
      const R = ab.range * TILE;
      if (ab.aim === 'point') { const d = Math.min(R, a.dist || R); ctx.globalAlpha = 0.12; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill(); ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(Math.cos(a.ang) * d, Math.sin(a.ang) * d, TILE * 1.4, 0, 7); ctx.fill(); }
      else if (ab.aim === 'self') { ctx.beginPath(); ctx.arc(0, 0, Math.max(TILE * 1.2, Math.min(R, TILE * 3)), 0, 7); ctx.fill(); }
      else { ctx.rotate(a.ang); ctx.fillRect(0, -16, R, 32); }
    }
    ctx.restore();
  }
  private drawFighterEntity(ctx: CanvasRenderingContext2D, w: World, f: Fighter, viewer: Fighter, o: RenderOpts) {
    const hidden = isHidden(f);
    const mine = f.id === viewer.id;
    const ally = f.team === viewer.team;
    const fl = this.flash.get(f.id) ?? 0; if (fl > 0) this.flash.set(f.id, fl - 0.12);
    const air = f.air ? Math.sin(Math.min(1, f.air.t / f.air.T) * Math.PI) * 50 : 0;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(f.x, f.y + f.radius * 0.75, f.radius * (f.isBoss ? 2 : 1), f.radius * 0.4 * (f.isBoss ? 2 : 1), 0, 0, 7); ctx.fill();
    // trail for skins with trail
    const sk = SKIN_BY_ID.get(f.skinId);
    if (sk && sk.trail !== 'none' && f.moving && o.quality !== 'low' && Math.random() < 0.6) this.parts.spawn(f.x + (Math.random() - 0.5) * 10, f.y + f.radius * 0.6, 0, -20, sk.trail === 'comet' ? 0.6 : 0.35, sk.trail === 'comet' ? 6 : 3, themeOf(f.skinId).accent, sk.trail === 'ribbon' ? 1 : 0);
    if ((f.dash || f.air) && o.quality !== 'low') this.parts.spawn(f.x, f.y - air, 0, 0, 0.25, f.radius * 0.8, hexA(themeOf(f.skinId).accent, 0.6));
    ctx.save(); ctx.translate(f.x, f.y - air);
    // casting telegraph glow
    if (f.casting) { ctx.strokeStyle = f.casting.slot === 3 ? '#ff4fd8' : '#ffd23f'; ctx.lineWidth = 3; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.time * 30); ctx.beginPath(); ctx.arc(0, 0, f.radius * 1.5, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    if (f.spawnProtectT > 0) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, f.radius * 1.4, 0, 7); ctx.stroke(); }
    if (f.shield > 0 || f.gearShield > 0) { ctx.fillStyle = 'rgba(120,220,255,0.18)'; ctx.strokeStyle = 'rgba(160,235,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, f.radius * 1.35, 0, 7); ctx.fill(); ctx.stroke(); }
    if (has(f, 'reflect')) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, f.radius * 1.6, f.aim - 1.2, f.aim + 1.2); ctx.stroke(); }
    const alpha = hidden ? (ally ? 0.5 : 0.65) : f.cloneOf !== null ? 0.82 : 1;
    const scale = f.isBoss ? 2.1 : 1;
    drawFighter(ctx, f.char, f.skinId, {
      t: this.time + f.id, facing: f.facing, aim: f.aim, moving: f.moving, teamColor: mine ? SELF : ally ? ALLY : ENEMY, hpFrac: f.hp / f.maxHp,
      attacking: f.lock > 0, scale, alpha, flash: fl, casting: !!f.casting, stunned: has(f, 'stun') || has(f, 'knockup'), frozen: has(f, 'freeze'),
    }, f.radius);
    ctx.restore();
    if (w.ball?.holder === f.id) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(f.x, f.y, f.radius * 1.9, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    void RARITY_LAYERS;
  }
  private drawBars(ctx: CanvasRenderingContext2D, w: World, f: Fighter, viewer: Fighter, o: RenderOpts) {
    if (f.isBoss) return;
    const mine = f.id === viewer.id, ally = f.team === viewer.team;
    const air = f.air ? Math.sin(Math.min(1, f.air.t / f.air.T) * Math.PI) * 50 : 0;
    const x = f.x, y = f.y - f.radius * 2.15 - air;
    const W = 62;
    ctx.save();
    ctx.font = '800 12px "Russo One",system-ui,sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    const label = f.cloneOf !== null ? f.name : f.name + (o.showCpuInfo && f.cpu && !ally ? '' : '');
    ctx.strokeText(label, x, y - 12); ctx.fillStyle = mine ? SELF : ally ? '#bfe3ff' : '#ffc2cb'; ctx.fillText(label, x, y - 12);
    const hpf = Math.max(0, f.hp / f.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.beginPath(); ctx.roundRect(x - W / 2 - 2, y - 6, W + 4, 12, 4); ctx.fill();
    ctx.fillStyle = mine ? '#5dff9d' : ally ? ALLY : ENEMY; ctx.beginPath(); ctx.roundRect(x - W / 2, y - 4, W * hpf, 8, 3); ctx.fill();
    const sh = (f.shield + f.gearShield) / f.maxHp; if (sh > 0) { ctx.fillStyle = '#bff3ff'; ctx.fillRect(x - W / 2, y - 4, W * Math.min(1, sh), 3); }
    ctx.fillStyle = '#fff'; ctx.font = '700 10px system-ui,sans-serif'; ctx.fillText(String(Math.ceil(f.hp)), x, y + 3.5);
    if (mine) { // ammo segments
      const a = f.char.attack.ammo; const sw = (W - (a - 1) * 3) / a;
      for (let i = 0; i < a; i++) { const fill = i < Math.floor(f.ammo) ? 1 : i === Math.floor(f.ammo) ? f.reloadT / f.char.attack.reload : 0; ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - W / 2 + i * (sw + 3), y + 8, sw, 5); ctx.fillStyle = fill >= 1 ? '#ff9f1c' : '#a06a20'; ctx.fillRect(x - W / 2 + i * (sw + 3), y + 8, sw * Math.min(1, fill), 5); }
      if (f.char.attack.pattern === 'charge' && f.charging) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - W / 2, y + 15, W * Math.min(1, f.chargeT / (f.char.attack.chargeMax ?? 1)), 4); }
    }
    // status icons
    let ix = x - W / 2;
    const icons: [string, string][] = [];
    for (const [k, s] of f.statuses) if (s.t > 0) { const m = STATUS_ICON[k]; if (m) icons.push(m); }
    if (f.cubes > 0) icons.push([`⚡${f.cubes}`, '#ffd23f']);
    if (f.gems > 0) icons.push([`💎${f.gems}`, '#d48bff']);
    if (f.combo >= 3 && f.comboT > 0) icons.push([`${f.combo}HIT`, '#ff9f1c']);
    ctx.font = '800 11px system-ui,sans-serif'; ctx.textAlign = 'left';
    for (const [t, c] of icons.slice(0, 5)) { ctx.strokeText(t, ix, y - 26); ctx.fillStyle = c; ctx.fillText(t, ix, y - 26); ix += ctx.measureText(t).width + 4; }
    ctx.restore();
  }

  // ───────────── HUD (screen space) ─────────────
  private drawHud(ctx: CanvasRenderingContext2D, w: World, me: Fighter, o: RenderOpts) {
    const k = Math.max(0.55, Math.min(1, this.W / 1000, this.H / 620));
    const W = this.W / k, H = this.H / k;
    const hud = w.rules.hud(w);
    ctx.save();
    ctx.scale(k, k);
    const top = 10, safeL = 12 + (o.touch ? 18 : 0);
    // top-center timer & score
    ctx.textAlign = 'center';
    panel(ctx, W / 2 - 170, top, 340, 54);
    ctx.font = '900 24px "Russo One",system-ui,sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(hud.center ?? '', W / 2, top + 34);
    ctx.font = '800 22px "Russo One",system-ui,sans-serif';
    ctx.fillStyle = ALLY; ctx.fillText(hud.left, W / 2 - 118, top + 34);
    ctx.fillStyle = ENEMY; ctx.fillText(hud.right, W / 2 + 118, top + 34);
    ctx.font = '700 10px system-ui,sans-serif'; ctx.fillStyle = '#c9c9e0'; ctx.fillText(hud.title, W / 2, top + 48);
    if (hud.bars) hud.bars.forEach((b, i) => { const y = top + 62 + i * 18; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - 120, y, 240, 14); ctx.fillStyle = b.color; ctx.fillRect(W / 2 - 120, y, 240 * Math.max(0, Math.min(1, b.value)), 14); ctx.fillStyle = '#fff'; ctx.font = '700 10px system-ui'; ctx.fillText(`${b.label} ${Math.round(b.value * 100)}%`, W / 2, y + 11); });
    // top-left player info
    ctx.textAlign = 'left';
    panel(ctx, safeL, top, 210, 58);
    ctx.fillStyle = themeOf(me.skinId).primary; ctx.beginPath(); ctx.arc(safeL + 28, top + 29, 20, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '900 13px "Russo One",system-ui'; ctx.fillText(me.char.key, safeL + 56, top + 22);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(safeL + 56, top + 30, 140, 10); ctx.fillStyle = '#5dff9d'; ctx.fillRect(safeL + 56, top + 30, 140 * Math.max(0, me.hp / me.maxHp), 10);
    ctx.font = '700 10px system-ui'; ctx.fillStyle = '#ddd'; ctx.fillText(`${Math.ceil(me.hp)} / ${me.maxHp}`, safeL + 58, top + 52);
    if (w.cfg.mode.powerCubes) { ctx.fillStyle = '#ffd23f'; ctx.fillText(`⚡×${me.cubes}  (×${Math.pow(1.1, me.cubes).toFixed(2)})`, safeL + 120, top + 52); }
    // top-right K/D
    ctx.textAlign = 'right'; panel(ctx, W - 160 - 12, top, 160, 40);
    ctx.font = '800 15px "Russo One",system-ui'; ctx.fillStyle = '#fff'; ctx.fillText(`⚔ ${me.stats.kills}  ☠ ${me.stats.deaths}  ✚ ${me.stats.assists}`, W - 22, top + 26);
    // kill feed (left)
    ctx.textAlign = 'left'; ctx.font = '700 12px system-ui';
    const feed = w.feed.filter(e => w.time - e.t < 6).slice(-5);
    feed.forEach((e, i) => { const y = top + 80 + i * 22; const txt = `${e.killer}  ▶  ${e.victim}`; const tw = ctx.measureText(txt).width; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(safeL, y - 14, tw + 14, 19); ctx.fillStyle = e.kTeam === me.team ? '#9fd4ff' : e.kTeam < 0 ? '#ccc' : '#ffb3bf'; ctx.fillText(e.killer, safeL + 7, y); const kw = ctx.measureText(e.killer + '  ▶  ').width; ctx.fillStyle = e.vTeam === me.team ? '#9fd4ff' : '#ffb3bf'; ctx.fillText(e.victim, safeL + 7 + kw, y); });
    // combo rank
    if (me.combo >= 3 && me.comboT > 0) { const rank = me.combo >= 12 ? 'S' : me.combo >= 8 ? 'A' : me.combo >= 5 ? 'B' : 'C'; ctx.textAlign = 'right'; ctx.font = '900 30px "Russo One",system-ui'; ctx.fillStyle = '#ff9f1c'; ctx.fillText(`${me.combo} COMBO ${rank}`, W - 24, top + 90); }
    // danger warning
    if (me.alive && me.hp < me.maxHp * 0.3) { ctx.strokeStyle = `rgba(255,40,60,${0.35 + 0.25 * Math.sin(this.time * 8)})`; ctx.lineWidth = 14; ctx.strokeRect(0, 0, W, H); }
    // respawn
    if (!me.alive && !w.over) { ctx.textAlign = 'center'; ctx.font = '900 30px "Russo One",system-ui'; ctx.fillStyle = '#fff'; ctx.fillText(me.respawnT > 0 && w.rules.canRespawn !== undefined && w.cfg.mode.respawn ? `復活まで ${Math.ceil(me.respawnT)}` : '撃破されました（観戦中）', W / 2, H / 2); }
    // announcements
    ctx.textAlign = 'center';
    this.announce = this.announce.filter(a => (a.t -= 1 / 60) > 0);
    this.announce.slice(-3).forEach((a, i) => {
      const s = a.big ? 54 : 26; const pop = 1 + Math.max(0, a.t - (a.big ? 2 : 1.6)) * 2;
      ctx.font = `900 ${Math.round(s * pop)}px "Russo One",system-ui`; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.globalAlpha = Math.min(1, a.t * 2);
      const y = a.big ? H * 0.32 : H * 0.42 + i * 34; ctx.strokeText(a.text, W / 2, y); ctx.fillStyle = a.color; ctx.fillText(a.text, W / 2, y); ctx.globalAlpha = 1;
    });
    // skills (desktop only; touch has DOM buttons)
    if (!o.touch) this.drawSkillBar(ctx, me, W, H);
    if (o.showFps) { ctx.textAlign = 'left'; ctx.font = '700 11px monospace'; ctx.fillStyle = '#7cff4f'; ctx.fillText(`${o.fps.toFixed(0)} FPS  E:${w.fighters.length} P:${w.projectiles.length}`, 12, H - 10); }
    if (o.scoreboard) this.drawScoreboard(ctx, w, me, W, H);
    ctx.restore();
  }
  private drawSkillBar(ctx: CanvasRenderingContext2D, f: Fighter, W: number, H: number) {
    const slots: [string, string, number, number, boolean][] = [
      ['Q', f.char.skill1.name, f.cd[0], f.char.skill1.cooldown, false],
      ['E', f.char.skill2.name, f.cd[1], f.char.skill2.cooldown, false],
      ['R', f.char.ult.name, 1 - f.ult, 1, true],
    ];
    const S = 64, gap = 14, total = slots.length * S + (slots.length - 1) * gap;
    let x = W / 2 - total / 2; const y = H - S - 18;
    ctx.textAlign = 'center';
    for (const [key, name, cd, max, ult] of slots) {
      const ready = cd <= 0.001;
      ctx.save(); ctx.translate(x + S / 2, y + S / 2);
      ctx.fillStyle = ready ? (ult ? 'rgba(255,79,216,0.9)' : 'rgba(255,210,63,0.92)') : 'rgba(20,20,30,0.85)';
      if (ult && ready) { ctx.shadowColor = '#ff4fd8'; ctx.shadowBlur = 20 + 8 * Math.sin(this.time * 6); }
      ctx.beginPath(); ctx.arc(0, 0, S / 2, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      if (!ready) { ctx.fillStyle = ult ? 'rgba(255,79,216,0.55)' : 'rgba(255,210,63,0.45)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, S / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cd / max)); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, S / 2, 0, 7); ctx.stroke();
      ctx.fillStyle = ready ? '#1a1030' : '#fff'; ctx.font = '900 20px "Russo One",system-ui'; ctx.fillText(key, 0, 2);
      ctx.font = '700 9px system-ui'; ctx.fillText(!ready && !ult ? cd.toFixed(1) : ult && !ready ? `${Math.round((1 - cd) * 100)}%` : '', 0, 16);
      ctx.fillStyle = '#fff'; ctx.font = '700 10px system-ui'; ctx.fillText(name, 0, S / 2 + 12);
      ctx.restore();
      x += S + gap;
    }
    ctx.textAlign = 'left'; ctx.font = '700 10px system-ui'; ctx.fillStyle = f.dodgeCd > 0 ? '#888' : '#9be8ff';
    ctx.fillText(f.dodgeCd > 0 ? `回避 ${f.dodgeCd.toFixed(1)}` : 'SPACE 回避', W / 2 + total / 2 + 20, H - 40);
  }
  private drawScoreboard(ctx: CanvasRenderingContext2D, w: World, me: Fighter, VW: number, VH: number) {
    const rows = w.fighters.filter(f => f.cloneOf === null).sort((a, b) => a.team - b.team || b.stats.kills - a.stats.kills);
    const W = Math.min(640, VW - 40), H = 40 + rows.length * 24;
    const x = (VW - W) / 2, y = Math.max(20, (VH - H) / 2);
    panel(ctx, x, y, W, H);
    ctx.font = '800 12px system-ui'; ctx.fillStyle = '#aaa'; ctx.textAlign = 'left';
    ctx.fillText('プレイヤー', x + 14, y + 24); ctx.textAlign = 'right';
    const cols = ['K', 'D', 'A', 'DMG', '目標']; cols.forEach((c, i) => ctx.fillText(c, x + W - 14 - (cols.length - 1 - i) * 70, y + 24));
    rows.forEach((f, i) => {
      const yy = y + 48 + i * 24; ctx.textAlign = 'left';
      ctx.fillStyle = f.id === me.id ? SELF : f.team === me.team ? '#9fd4ff' : '#ffb3bf';
      ctx.fillText(`${f.name}  [${f.char.key}]${f.cpu ? ' · CPU' : ''}${!f.alive ? ' ☠' : ''}`, x + 14, yy);
      ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
      [f.stats.kills, f.stats.deaths, f.stats.assists, Math.round(f.stats.damage), Math.round(f.stats.objective)].forEach((v, k) => ctx.fillText(String(v), x + W - 14 - (4 - k) * 70, yy));
    });
  }
}

const STATUS_ICON: Partial<Record<string, [string, string]>> = {
  slow: ['🐢', '#9be8ff'], stun: ['💫', '#ffe94a'], freeze: ['❄', '#9be8ff'], poison: ['☠', '#a6ff4a'], burn: ['🔥', '#ff7a2f'], bleed: ['🩸', '#ff3b5c'],
  silence: ['🔇', '#ccc'], blind: ['🌑', '#999'], mark: ['🎯', '#ff9f1c'], root: ['⛓', '#ccc'], curse: ['☯', '#b07cff'], haste: ['»', '#7cff4f'],
  dmgUp: ['⚔', '#ff9f1c'], defUp: ['🛡', '#9be8ff'], atkSpeed: ['⏩', '#ffd23f'], invis: ['👁', '#ddd'], knockup: ['↑', '#fff'],
};
function kfxRadius(fx?: string) { return fx === 'meteor' ? 120 : fx ? 90 : 50; }
function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(12,10,28,0.72)'; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill(); ctx.stroke();
}
function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, v: number, col: string) {
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = col; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, v)), h);
}
