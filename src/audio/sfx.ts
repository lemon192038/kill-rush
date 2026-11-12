/** Procedural WebAudio sound effects & light music loop (no external assets). */
export type Sfx = 'shoot' | 'shotgun' | 'lob' | 'swing' | 'hit' | 'crit' | 'hurt' | 'kill' | 'death' | 'boom' | 'skill' | 'ult' | 'pickup' | 'goal' | 'dodge' | 'click' | 'victory' | 'defeat' | 'kick' | 'gacha' | 'rare';

export class AudioEngine {
  ctx: AudioContext | null = null; master: GainNode | null = null; sfxGain: GainNode | null = null; musicGain: GainNode | null = null;
  noiseBuf: AudioBuffer | null = null; musicOn = false; private musicTimer: ReturnType<typeof setInterval> | null = null;
  private last = new Map<Sfx, number>();
  vol = 0.8; sfx = 0.9; music = 0.5;
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain(); this.musicGain.connect(this.master);
    const len = this.ctx.sampleRate * 0.5; this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
  }
  setVolumes(v: number, s: number, m: number) { this.vol = v; this.sfx = s; this.music = m; this.applyVolumes(); }
  private applyVolumes() { if (!this.master) return; this.master.gain.value = this.vol; this.sfxGain!.gain.value = this.sfx * 0.6; this.musicGain!.gain.value = this.music * 0.18; }
  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
    const c = this.ctx!; const t = c.currentTime + delay;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxGain!); o.start(t); o.stop(t + dur + 0.02);
  }
  private noise(dur: number, vol: number, freq: number, q = 1, delay = 0) {
    const c = this.ctx!; const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxGain!); s.start(t); s.stop(t + dur);
  }
  play(name: Sfx, v = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = performance.now(); const last = this.last.get(name) ?? 0;
    if (now - last < 35) return; this.last.set(name, now);
    switch (name) {
      case 'shoot': this.tone('square', 900, 300, 0.07, 0.12 * v); this.noise(0.05, 0.08 * v, 3000); break;
      case 'shotgun': this.noise(0.14, 0.25 * v, 1200, 0.8); this.tone('sawtooth', 300, 80, 0.12, 0.1 * v); break;
      case 'lob': this.tone('sine', 300, 600, 0.15, 0.12 * v); break;
      case 'swing': this.noise(0.1, 0.18 * v, 2500, 2); break;
      case 'kick': this.tone('sine', 180, 60, 0.12, 0.3 * v); this.noise(0.05, 0.1 * v, 800); break;
      case 'hit': this.tone('square', 520, 260, 0.05, 0.12 * v); this.noise(0.04, 0.1 * v, 1800); break;
      case 'crit': this.tone('square', 1200, 600, 0.09, 0.15 * v); this.tone('triangle', 1800, 1700, 0.12, 0.08 * v, 0.03); break;
      case 'hurt': this.tone('sawtooth', 200, 90, 0.12, 0.15 * v); break;
      case 'kill': this.tone('triangle', 660, 660, 0.08, 0.16 * v); this.tone('triangle', 990, 990, 0.14, 0.16 * v, 0.08); break;
      case 'death': this.tone('sawtooth', 400, 60, 0.6, 0.2 * v); break;
      case 'boom': this.noise(0.45, 0.45 * v, 300, 0.6); this.tone('sine', 120, 35, 0.4, 0.3 * v); break;
      case 'skill': this.tone('triangle', 400, 900, 0.16, 0.14 * v); break;
      case 'ult': this.tone('sawtooth', 200, 1200, 0.4, 0.15 * v); this.tone('square', 100, 600, 0.45, 0.08 * v); break;
      case 'pickup': this.tone('sine', 900, 1500, 0.1, 0.15 * v); break;
      case 'goal': [523, 659, 784, 1046].forEach((f, i) => this.tone('square', f, f, 0.18, 0.12, i * 0.1)); this.noise(0.8, 0.15, 2000, 0.3); break;
      case 'dodge': this.noise(0.12, 0.12 * v, 4000, 3); break;
      case 'click': this.tone('sine', 1100, 900, 0.04, 0.08 * v); break;
      case 'victory': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.14, i * 0.13)); break;
      case 'defeat': [392, 349, 311, 262].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.3, 0.12, i * 0.2)); break;
      case 'gacha': this.tone('sine', 300, 1200, 0.5, 0.1); break;
      case 'rare': [784, 988, 1175, 1568].forEach((f, i) => this.tone('square', f, f, 0.16, 0.1, i * 0.08)); break;
    }
  }
  startMusic() {
    if (!this.ctx || this.musicOn) return; this.musicOn = true;
    const notes = [110, 110, 131, 147, 110, 98, 131, 123];
    let step = 0;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const c = this.ctx, t = c.currentTime; const f = notes[step % notes.length];
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = f;
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 600 + 300 * Math.sin(step / 8);
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.connect(fl); fl.connect(g); g.connect(this.musicGain!); o.start(t); o.stop(t + 0.25);
      if (step % 4 === 0) { const k = c.createOscillator(), kg = c.createGain(); k.frequency.setValueAtTime(140, t); k.frequency.exponentialRampToValueAtTime(40, t + 0.12); kg.gain.setValueAtTime(0.9, t); kg.gain.exponentialRampToValueAtTime(0.001, t + 0.15); k.connect(kg); kg.connect(this.musicGain!); k.start(t); k.stop(t + 0.16); }
      step++;
    }, 250);
  }
  stopMusic() { this.musicOn = false; if (this.musicTimer) clearInterval(this.musicTimer); this.musicTimer = null; }
}
