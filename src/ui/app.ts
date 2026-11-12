import { AudioEngine } from '../audio/sfx';
import { SaveManager } from '../meta/save';
import { ensureDay } from '../meta/missions';
import { setLang } from './i18n';
import { h, toast } from './dom';
import { drawFighter } from '../render/fighterArt';
import { getChar } from '../data/characters';
import { defaultSkinId } from '../data/skins';

export type ScreenName = 'home' | 'modes' | 'chars' | 'shop' | 'gacha' | 'missions' | 'ranking' | 'profile' | 'settings' | 'game';
export interface Ctx {
  save: SaveManager; audio: AudioEngine; root: HTMLElement;
  go(name: ScreenName, arg?: unknown): void;
  persist(): void;
}
type ScreenFn = (ctx: Ctx, el: HTMLElement, arg?: unknown) => void | (() => void);
const screens = new Map<ScreenName, ScreenFn>();
export function registerScreen(n: ScreenName, fn: ScreenFn) { screens.set(n, fn); }

export class App implements Ctx {
  save = new SaveManager(); audio = new AudioEngine(); root: HTMLElement; private cleanup: (() => void) | void = undefined; current: ScreenName = 'home';
  constructor(root: HTMLElement) { this.root = root; }
  async start() {
    await this.save.load();
    this.save.onError = m => toast(m, 'err');
    if (this.save.loadedCorrupt) toast('セーブデータの破損を検出しました。初期データで開始します（破損データは上書きされます）。', 'err');
    ensureDay(this.save.data);
    setLang(this.save.data.settings.language);
    const s = this.save.data.settings; this.audio.setVolumes(s.volume, s.sfx, s.music);
    const unlock = () => { this.audio.unlock(); this.audio.startMusic(); };
    window.addEventListener('pointerdown', unlock, { once: false }); window.addEventListener('keydown', unlock, { once: false });
    document.addEventListener('click', e => { if ((e.target as HTMLElement).closest('button,.card-click')) this.audio.play('click'); });
    window.addEventListener('beforeunload', () => { void this.save.flush(); });
    this.go('home');
  }
  go(name: ScreenName, arg?: unknown) {
    if (typeof this.cleanup === 'function') this.cleanup();
    this.current = name;
    this.root.innerHTML = '';
    const el = h('div', { class: `screen screen-${name}` });
    this.root.appendChild(el);
    const fn = screens.get(name);
    if (!fn) { el.textContent = 'missing screen ' + name; return; }
    this.cleanup = fn(this, el, arg);
    if (name !== 'game') window.scrollTo(0, 0);
  }
  persist() { this.save.save(); }
}

const cache = new Map<string, HTMLCanvasElement>();
/** Render a static portrait of a character skin (cached). */
export function portrait(charId: number, skinId?: string, size = 96, animated = false): HTMLCanvasElement {
  const sk = skinId ?? defaultSkinId(charId);
  const key = `${sk}@${size}`;
  if (!animated && cache.has(key)) { const c = cache.get(key)!; const copy = document.createElement('canvas'); copy.width = c.width; copy.height = c.height; copy.className = 'portrait'; copy.getContext('2d')!.drawImage(c, 0, 0); copy.style.width = copy.style.height = `${size}px`; return copy; }
  const c = document.createElement('canvas'); const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = c.height = size * dpr; c.style.width = c.style.height = `${size}px`; c.className = 'portrait';
  const ch = getChar(charId);
  const paint = (t: number) => {
    const g = c.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, size, size);
    g.save(); g.translate(size / 2, size * 0.56); const r = size * 0.24;
    drawFighter(g, ch, sk, { t, facing: Math.PI / 2, aim: Math.PI * 0.35, moving: false, teamColor: 'rgba(255,255,255,0.35)', hpFrac: 1, attacking: false, scale: 1, alpha: 1, flash: 0, casting: false, stunned: false, frozen: false }, r);
    g.restore();
  };
  paint(0);
  if (!animated) cache.set(key, c);
  else { let raf = 0; const start = performance.now(); const tick = () => { if (!c.isConnected && performance.now() - start > 1000) { cancelAnimationFrame(raf); return; } paint((performance.now() - start) / 1000); raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); }
  return c;
}
