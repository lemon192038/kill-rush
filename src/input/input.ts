import { TILE } from '../core/constants';
import type { KeyBinds, TouchLayout } from '../meta/save';
import { autoAim, assistAim } from '../sim/aim';
import type { Fighter, World } from '../sim/types';
import type { Renderer, AimPreview } from '../render/renderer';

interface Pending { slot: 1 | 2 | 3; ang: number | null; dist: number; t: number; pulse: boolean }

/** Converts keyboard/mouse/touch into per-tick FighterInput for the local player. */
export class PlayerInput {
  keys = new Set<string>(); mouseX = 0; mouseY = 0; mouseDown = false; hasMouse = false;
  moveX = 0; moveY = 0; // touch stick
  touchAim: { ang: number; dist: number } | null = null; touchAttackHeld = false;
  attackQueue: { ang: number | null; dist: number; t: number } | null = null;
  pending: Pending[] = []; dodgeQ = 0; passQ = 0;
  scoreboard = false; aim: AimPreview = { slot: 0, ang: 0, dist: 0, active: false };
  onMenu: () => void = () => {};
  touchMode = false; aimAssist = true;
  private bound: (() => void)[] = [];
  constructor(public keysCfg: KeyBinds) {}

  attach(canvas: HTMLCanvasElement) {
    const on = <K extends keyof WindowEventMap>(t: K, fn: (e: WindowEventMap[K]) => void, target: Window | HTMLElement = window) => { target.addEventListener(t, fn as EventListener, { passive: false }); this.bound.push(() => target.removeEventListener(t, fn as EventListener)); };
    on('keydown', e => {
      const k = this.keysCfg;
      if ([k.score, 'Space', k.dodge].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === k.skill1) this.press(1); else if (e.code === k.skill2) this.press(2); else if (e.code === k.ult) this.press(3);
      else if (e.code === k.dodge) this.dodgeQ = 0.2; else if (e.code === k.pass) this.passQ = 0.2;
      else if (e.code === k.score) this.scoreboard = true; else if (e.code === k.menu) this.onMenu();
    });
    on('keyup', e => { this.keys.delete(e.code); if (e.code === this.keysCfg.score) this.scoreboard = false; });
    on('blur', () => { this.keys.clear(); this.mouseDown = false; });
    on('mousemove', e => { this.mouseX = e.clientX; this.mouseY = e.clientY; this.hasMouse = true; }, canvas);
    on('mousedown', e => { if (e.button === 0) { this.mouseDown = true; this.touchMode = false; } }, canvas);
    on('mouseup', e => { if (e.button === 0) this.mouseDown = false; });
    on('contextmenu', e => e.preventDefault(), canvas);
  }
  detach() { for (const b of this.bound) b(); this.bound = []; }
  press(slot: 1 | 2 | 3, ang: number | null = undefined as unknown as null, dist = 0) {
    this.pending = this.pending.filter(p => p.slot !== slot);
    this.pending.push({ slot, ang: ang === undefined ? NaN : ang, dist, t: 0.3, pulse: false });
  }
  touchAttack(ang: number | null, dist: number) { this.attackQueue = { ang, dist, t: 0.3 }; }

  /** Build input for this tick. */
  apply(w: World, f: Fighter, r: Renderer, dt: number) {
    const inp = f.input; const k = this.keysCfg;
    // movement
    let mx = this.moveX, my = this.moveY;
    if (this.keys.has(k.left)) mx -= 1; if (this.keys.has(k.right)) mx += 1;
    if (this.keys.has(k.up)) my -= 1; if (this.keys.has(k.down)) my += 1;
    const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
    inp.mx = mx; inp.my = my;
    // mouse aim
    let ang = f.aim, dist = 0;
    if (this.hasMouse && !this.touchMode) {
      const s = r.worldToScreen(f.x, f.y);
      ang = Math.atan2(this.mouseY - s.y, this.mouseX - s.x); dist = Math.hypot(this.mouseX - s.x, this.mouseY - s.y) / r.zoom;
      if (this.aimAssist) ang = assistAim(w, f, ang, f.char.attack.range);
    }
    if (this.touchAim) { ang = this.touchAim.ang; dist = this.touchAim.dist; }
    inp.aimX = Math.cos(ang); inp.aimY = Math.sin(ang); inp.aimDist = dist;
    // attack
    inp.attack = false;
    if (this.mouseDown && !this.touchMode) inp.attack = true;
    if (this.touchAttackHeld && this.touchAim && f.char.attack.pattern === 'charge') inp.attack = true;
    const ball = w.ball && w.ball.holder === f.id;
    if (this.attackQueue) {
      const q = this.attackQueue; q.t -= dt;
      let a = q.ang, d = q.dist;
      if (a === null) { const t = ball ? null : autoAim(w, f, f.char.attack.range); a = t ? t.ang : f.facing; d = t ? t.dist : 0; if (ball) a = f.team === 0 ? -Math.PI / 2 : Math.PI / 2; }
      inp.aimX = Math.cos(a); inp.aimY = Math.sin(a); inp.aimDist = d || f.char.attack.range * TILE;
      if (ball) { inp.attack = q.t > 0.18; if (q.t <= 0.18) this.attackQueue = null; }
      else { inp.attack = true; if (f.lock > 0 || f.ammo < 1 || q.t <= 0) { if (q.t <= 0 || f.lock > 0) this.attackQueue = null; } }
    }
    // skills (pulsed until accepted)
    inp.skill1 = inp.skill2 = inp.ult = false;
    for (const p of this.pending) {
      p.t -= dt; p.pulse = !p.pulse;
      const ab = p.slot === 1 ? f.char.skill1 : p.slot === 2 ? f.char.skill2 : f.char.ult;
      let a = Number.isNaN(p.ang as number) ? ang : p.ang, d = Number.isNaN(p.ang as number) ? dist : p.dist;
      if (a === null) { const t = autoAim(w, f, ab.range); a = t ? t.ang : f.facing; d = t ? t.dist : ab.range * TILE * 0.7; }
      if (p.pulse) { inp.aimX = Math.cos(a); inp.aimY = Math.sin(a); inp.aimDist = d; if (p.slot === 1) inp.skill1 = true; else if (p.slot === 2) inp.skill2 = true; else inp.ult = true; }
    }
    const accepted = (p: Pending) => (p.slot === 3 ? f.ult < 1 : f.cd[p.slot - 1] > 0) || !!f.casting;
    this.pending = this.pending.filter(p => p.t > 0 && !accepted(p));
    inp.dodge = this.dodgeQ > 0 && !f.prevInput.dodge; this.dodgeQ = Math.max(0, this.dodgeQ - dt); if (f.dodgeCd > 0 && this.dodgeQ > 0 && f.prevInput.dodge) this.dodgeQ = 0;
    inp.pass = this.passQ > 0 && !f.prevInput.pass; this.passQ = Math.max(0, this.passQ - dt);
    // aim preview (desktop: show while holding attack)
    if (!this.touchMode) this.aim = { slot: 0, ang, dist, active: this.mouseDown || this.keys.has(k.skill1) || this.keys.has(k.skill2) || this.keys.has(k.ult) };
    if (!this.touchMode && (this.keys.has(k.skill1) || this.keys.has(k.skill2) || this.keys.has(k.ult))) this.aim.slot = this.keys.has(k.skill1) ? 1 : this.keys.has(k.skill2) ? 2 : 3;
  }
}

/** Touch overlay: joystick + aim buttons. Hit areas are larger than the visuals; multi-touch via pointer IDs. */
export class TouchControls {
  root: HTMLDivElement; private stickBase!: HTMLDivElement; private stickKnob!: HTMLDivElement;
  private btns = new Map<string, HTMLDivElement>();
  constructor(parent: HTMLElement, private input: PlayerInput, public layout: TouchLayout, private getFighter: () => Fighter | null) {
    this.root = document.createElement('div'); this.root.className = 'touch-root';
    parent.appendChild(this.root);
    this.build();
  }
  destroy() { this.root.remove(); }
  setPassVisible(v: boolean) { const b = this.btns.get('pass'); if (b) b.style.display = v ? '' : 'none'; }
  private place(el: HTMLElement, key: string, base: number) {
    const L = this.layout[key]; const vmin = Math.min(window.innerWidth, window.innerHeight); const size = Math.min(base, base * vmin / 560) * L.size;
    el.style.left = `calc(${L.x * 100}% - ${size / 2}px)`; el.style.top = `calc(${L.y * 100}% - ${size / 2}px)`;
    el.style.width = el.style.height = `${size}px`; el.style.opacity = String(L.opacity);
  }
  build() {
    this.root.innerHTML = ''; this.btns.clear();
    // joystick zone (bigger than visual)
    const zone = document.createElement('div'); zone.className = 'touch-zone';
    this.place(zone, 'stick', 300); zone.style.opacity = '1';
    this.stickBase = document.createElement('div'); this.stickBase.className = 'stick-base';
    this.stickKnob = document.createElement('div'); this.stickKnob.className = 'stick-knob';
    this.stickBase.appendChild(this.stickKnob); zone.appendChild(this.stickBase);
    this.stickBase.style.opacity = String(this.layout.stick.opacity);
    this.root.appendChild(zone);
    let stickId = -1, ox = 0, oy = 0;
    const R = 60 * this.layout.stick.size * Math.min(1, Math.min(window.innerWidth, window.innerHeight) / 560);
    zone.addEventListener('pointerdown', e => {
      if (stickId !== -1) return; e.preventDefault(); stickId = e.pointerId; zone.setPointerCapture(e.pointerId);
      const rc = zone.getBoundingClientRect(); ox = e.clientX; oy = e.clientY;
      this.stickBase.style.left = `${e.clientX - rc.left}px`; this.stickBase.style.top = `${e.clientY - rc.top}px`; this.stickBase.classList.add('active');
      this.input.touchMode = true;
    });
    zone.addEventListener('pointermove', e => {
      if (e.pointerId !== stickId) return; e.preventDefault();
      let dx = e.clientX - ox, dy = e.clientY - oy; const d = Math.hypot(dx, dy);
      if (d > R) { // follow finger (floating stick) so slightly outside still works
        ox += dx * (1 - R / d); oy += dy * (1 - R / d); dx = e.clientX - ox; dy = e.clientY - oy;
        const rc = zone.getBoundingClientRect(); this.stickBase.style.left = `${ox - rc.left}px`; this.stickBase.style.top = `${oy - rc.top}px`;
      }
      const m = Math.min(1, Math.hypot(dx, dy) / R);
      const dead = 0.12;
      const a = Math.atan2(dy, dx);
      this.input.moveX = m > dead ? Math.cos(a) * m : 0; this.input.moveY = m > dead ? Math.sin(a) * m : 0;
      this.stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    const endStick = (e: PointerEvent) => { if (e.pointerId !== stickId) return; stickId = -1; this.input.moveX = this.input.moveY = 0; this.stickKnob.style.transform = ''; this.stickBase.classList.remove('active'); };
    zone.addEventListener('pointerup', endStick); zone.addEventListener('pointercancel', endStick);
    const mk = (key: string, label: string, base: number, kind: 'aim' | 'tap', slot: 0 | 1 | 2 | 3) => {
      const b = document.createElement('div'); b.className = `touch-btn tb-${key}`; b.innerHTML = `<span>${label}</span><i class="cd"></i>`;
      this.place(b, key, base); this.root.appendChild(b); this.btns.set(key, b);
      let id = -1, sx = 0, sy = 0, t0 = 0, manual = false;
      b.addEventListener('pointerdown', e => {
        e.preventDefault(); if (id !== -1) return; id = e.pointerId; b.setPointerCapture(e.pointerId); sx = e.clientX; sy = e.clientY; t0 = performance.now(); manual = false; b.classList.add('down');
        this.input.touchMode = true;
        if (kind === 'tap') { if (key === 'dodge') this.input.dodgeQ = 0.2; else this.input.passQ = 0.2; }
        if (slot === 0) this.input.touchAttackHeld = true;
      });
      b.addEventListener('pointermove', e => {
        if (e.pointerId !== id || kind !== 'aim') return; e.preventDefault();
        const dx = e.clientX - sx, dy = e.clientY - sy; const d = Math.hypot(dx, dy);
        if (d > 18) { manual = true; const f = this.getFighter(); const ab = f ? (slot === 0 ? null : slot === 1 ? f.char.skill1 : slot === 2 ? f.char.skill2 : f.char.ult) : null; const rng = (ab ? ab.range : f?.char.attack.range ?? 6) * TILE; const dist = Math.min(1, d / 110) * rng; this.input.touchAim = { ang: Math.atan2(dy, dx), dist }; this.input.aim = { slot, ang: Math.atan2(dy, dx), dist, active: true }; }
      });
      const up = (e: PointerEvent) => {
        if (e.pointerId !== id) return; id = -1; b.classList.remove('down');
        if (kind === 'aim') {
          const quick = !manual && performance.now() - t0 < 400; // tap = auto aim
          const a = manual && this.input.touchAim ? this.input.touchAim : null;
          if (slot === 0) { this.input.touchAttackHeld = false; if (a || quick) this.input.touchAttack(a ? a.ang : null, a ? a.dist : 0); }
          else if (a || quick) this.input.press(slot as 1 | 2 | 3, a ? a.ang : null, a ? a.dist : 0);
          this.input.touchAim = null; this.input.aim = { slot: 0, ang: 0, dist: 0, active: false };
        }
      };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', e => { if (e.pointerId === id) { id = -1; b.classList.remove('down'); this.input.touchAim = null; this.input.touchAttackHeld = false; this.input.aim.active = false; } });
    };
    mk('attack', '⚔', 110, 'aim', 0); mk('skill1', 'S1', 110, 'aim', 1); mk('skill2', 'S2', 110, 'aim', 2); mk('ult', '★', 110, 'aim', 3); mk('dodge', '⤴', 110, 'tap', 0); mk('pass', 'PASS', 110, 'tap', 0);
  }
  update(f: Fighter) {
    const set = (key: string, frac: number, ready: boolean) => { const b = this.btns.get(key); if (!b) return; b.classList.toggle('ready', ready); (b.querySelector('.cd') as HTMLElement).style.setProperty('--p', String(frac)); };
    set('skill1', f.cd[0] / Math.max(0.1, f.char.skill1.cooldown), f.cd[0] <= 0);
    set('skill2', f.cd[1] / Math.max(0.1, f.char.skill2.cooldown), f.cd[1] <= 0);
    set('ult', 1 - f.ult, f.ult >= 1);
    set('attack', 1 - f.ammo / f.char.attack.ammo, f.ammo >= 1);
    set('dodge', f.dodgeCd / 3.5, f.dodgeCd <= 0);
  }
}
