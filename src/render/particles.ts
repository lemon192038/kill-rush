/** Fixed-size particle & floating-text pools (no per-frame allocation → no GC spikes / leaks). */
export interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: number; rot: number; grav: number }
export interface Txt { x: number; y: number; vy: number; life: number; text: string; color: string; size: number; crit: boolean }
export interface Ring { x: number; y: number; r: number; max: number; life: number; maxLife: number; color: string; fill: boolean }

export class Particles {
  p: P[] = []; n = 0; txt: Txt[] = []; rings: Ring[] = [];
  constructor(public cap = 2400) { for (let i = 0; i < cap; i++) this.p.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: '#fff', kind: 0, rot: 0, grav: 0 }); }
  spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, kind = 0, grav = 0) {
    const q = this.p[this.n]; this.n = (this.n + 1) % this.cap;
    q.x = x; q.y = y; q.vx = vx; q.vy = vy; q.life = life; q.max = life; q.size = size; q.color = color; q.kind = kind; q.rot = Math.random() * 6; q.grav = grav;
  }
  burst(x: number, y: number, n: number, speed: number, color: string, size = 3, life = 0.5, kind = 0) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7); this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), color, kind); }
  }
  ring(x: number, y: number, r: number, color: string, life = 0.35, fill = false) { if (this.rings.length < 120) this.rings.push({ x, y, r: 0, max: r, life, maxLife: life, color, fill }); }
  text(x: number, y: number, text: string, color: string, size = 18, crit = false) { if (this.txt.length > 80) this.txt.shift(); this.txt.push({ x: x + (Math.random() - 0.5) * 16, y, vy: -70, life: 0.9, text, color, size, crit }); }
  update(dt: number) {
    for (const q of this.p) { if (q.life <= 0) continue; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy = q.vy * 0.94 + q.grav * dt; q.rot += dt * 5; }
    for (const t of this.txt) { t.life -= dt; t.y += t.vy * dt; t.vy *= 0.92; }
    this.txt = this.txt.filter(t => t.life > 0);
    for (const r of this.rings) { r.life -= dt; r.r = r.max * (1 - r.life / r.maxLife); }
    this.rings = this.rings.filter(r => r.life > 0);
  }
  draw(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const q of this.p) {
      if (q.life <= 0 || q.x < x0 || q.y < y0 || q.x > x1 || q.y > y1) continue;
      const a = q.life / q.max; ctx.globalAlpha = a; ctx.fillStyle = q.color;
      if (q.kind === 1) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillRect(-q.size, -q.size * 0.4, q.size * 2, q.size * 0.8); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.5 + a * 0.5), 0, 6.283); ctx.fill(); }
    }
    for (const r of this.rings) {
      const a = r.life / r.maxLife; ctx.globalAlpha = a * 0.8; ctx.strokeStyle = r.color; ctx.lineWidth = 3 + 6 * a;
      ctx.beginPath(); ctx.arc(r.x, r.y, Math.abs(r.r), 0, 6.283); ctx.stroke();
      if (r.fill) { ctx.globalAlpha = a * 0.25; ctx.fillStyle = r.color; ctx.fill(); }
    }
    ctx.restore();
  }
  drawText(ctx: CanvasRenderingContext2D) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of this.txt) {
      const a = Math.min(1, t.life * 2.5); const pop = t.crit ? 1 + Math.max(0, t.life - 0.7) * 3 : 1 + Math.max(0, t.life - 0.8) * 2;
      ctx.globalAlpha = a; ctx.font = `900 ${Math.round(t.size * pop)}px "Russo One", system-ui, sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(t.text, t.x, t.y); ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }
  clear() { for (const q of this.p) q.life = 0; this.txt = []; this.rings = []; }
}
