import type { CharacterDef } from '../data/types';
import { THEMES, SKIN_BY_ID, type Theme } from '../data/skins';

export interface ArtState { t: number; facing: number; aim: number; moving: boolean; teamColor: string; hpFrac: number; attacking: boolean; scale: number; alpha: number; flash: number; casting: boolean; stunned: boolean; frozen: boolean }

function pattern(ctx: CanvasRenderingContext2D, th: Theme, r: number, t: number) {
  ctx.save();
  ctx.globalAlpha *= 0.35;
  ctx.strokeStyle = th.accent; ctx.fillStyle = th.accent; ctx.lineWidth = r * 0.12;
  switch (th.pattern) {
    case 'stripes': for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.4 - r, -r); ctx.lineTo(i * r * 0.4 + r, r); ctx.stroke(); } break;
    case 'dots': for (let i = 0; i < 7; i++) { const a = i * 0.9; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.12, 0, 7); ctx.fill(); } break;
    case 'circuit': ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(-r * 0.3, 0); ctx.lineTo(0, -r * 0.4); ctx.lineTo(r, -r * 0.4); ctx.moveTo(-r * 0.6, r * 0.5); ctx.lineTo(r * 0.5, r * 0.5); ctx.stroke(); break;
    case 'flames': for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.4, r); ctx.quadraticCurveTo(i * r * 0.4 + r * 0.3 * Math.sin(t * 6 + i), 0, i * r * 0.4, -r * 0.6); ctx.stroke(); } break;
    case 'scales': for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) { ctx.beginPath(); ctx.arc(x * r * 0.4 + (y % 2) * r * 0.2, y * r * 0.35, r * 0.2, 0, Math.PI); ctx.stroke(); } break;
    case 'stars': for (let i = 0; i < 5; i++) { const a = i * 1.3 + 0.3; star(ctx, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.14); } break;
    case 'camo': for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(Math.cos(i * 2.1) * r * 0.5, Math.sin(i * 1.7) * r * 0.5, r * 0.3, r * 0.18, i, 0, 7); ctx.fill(); } break;
    case 'rings': for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(0, 0, r * 0.28 * i, 0, 7); ctx.stroke(); } break;
    case 'cracks': ctx.beginPath(); ctx.moveTo(-r, -r * 0.3); ctx.lineTo(-r * 0.2, 0); ctx.lineTo(-r * 0.4, r * 0.6); ctx.moveTo(-r * 0.2, 0); ctx.lineTo(r * 0.6, -r * 0.2); ctx.lineTo(r, r * 0.3); ctx.stroke(); break;
    case 'waves': for (let i = -2; i <= 2; i++) { ctx.beginPath(); for (let x = -r; x <= r; x += 4) ctx.lineTo(x, i * r * 0.38 + Math.sin(x * 0.3 + t * 3) * 3); ctx.stroke(); } break;
    case 'checker': for (let y = -2; y < 2; y++) for (let x = -2; x < 2; x++) if ((x + y) % 2 === 0) ctx.fillRect(x * r * 0.5, y * r * 0.5, r * 0.5, r * 0.5); break;
    case 'runes': for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + t; ctx.save(); ctx.translate(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55); ctx.beginPath(); ctx.moveTo(0, -r * 0.15); ctx.lineTo(r * 0.1, r * 0.15); ctx.lineTo(-r * 0.1, r * 0.15); ctx.closePath(); ctx.stroke(); ctx.restore(); } break;
    case 'hex': for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; hexagon(ctx, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.22); } break;
    case 'drip': for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.4, -r); ctx.lineTo(i * r * 0.4, -r * 0.2 + Math.abs(i) * r * 0.2); ctx.stroke(); ctx.beginPath(); ctx.arc(i * r * 0.4, -r * 0.15 + Math.abs(i) * r * 0.2, r * 0.1, 0, 7); ctx.fill(); } break;
    case 'bolts': ctx.beginPath(); ctx.moveTo(-r * 0.2, -r); ctx.lineTo(r * 0.1, -r * 0.1); ctx.lineTo(-r * 0.15, 0); ctx.lineTo(r * 0.2, r); ctx.stroke(); break;
    case 'leaves': for (let i = 0; i < 5; i++) { const a = i * 1.25 + t * 0.5; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.18, r * 0.08, a, 0, 7); ctx.fill(); } break;
    case 'gems': for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; diamond(ctx, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.18); } break;
    case 'pixel': for (let y = -2; y < 2; y++) for (let x = -2; x < 2; x++) if ((x * 7 + y * 13) % 3 === 0) ctx.fillRect(x * r * 0.45, y * r * 0.45, r * 0.42, r * 0.42); break;
    case 'swirl': ctx.beginPath(); for (let a = 0; a < 12; a += 0.2) ctx.lineTo(Math.cos(a + t) * a * r * 0.07, Math.sin(a + t) * a * r * 0.07); ctx.stroke(); break;
    case 'chevron': for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.7, i * r * 0.45 + r * 0.2); ctx.lineTo(0, i * r * 0.45 - r * 0.1); ctx.lineTo(r * 0.7, i * r * 0.45 + r * 0.2); ctx.stroke(); } break;
    case 'grid': for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.4, -r); ctx.lineTo(i * r * 0.4, r); ctx.moveTo(-r, i * r * 0.4); ctx.lineTo(r, i * r * 0.4); ctx.stroke(); } break;
    case 'feathers': for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.5; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5 + r * 0.3, r * 0.3, r * 0.1, a, 0, 7); ctx.fill(); } break;
    case 'sparkle': for (let i = 0; i < 5; i++) { const a = i * 1.3 + t * 2; const s = (Math.sin(t * 5 + i) + 1) * r * 0.08; star(ctx, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, s + 1); } break;
    case 'tribal': ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.3); ctx.lineTo(-r * 0.3, -r * 0.3); ctx.lineTo(0, r * 0.2); ctx.lineTo(r * 0.3, -r * 0.3); ctx.lineTo(r * 0.8, r * 0.3); ctx.stroke(); break;
    default: break;
  }
  ctx.restore();
}
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2; const rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
function hexagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); ctx.stroke(); }
function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.7, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.7, y); ctx.closePath(); ctx.fill(); }

function accessory(ctx: CanvasRenderingContext2D, th: Theme, r: number, t: number) {
  ctx.save();
  ctx.fillStyle = th.accent; ctx.strokeStyle = th.dark; ctx.lineWidth = 2;
  const A = th.accessory;
  switch (A) {
    case 'horns': for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.45, -r * 0.7); ctx.quadraticCurveTo(s * r * 1.0, -r * 1.2, s * r * 0.75, -r * 1.45); ctx.lineTo(s * r * 0.25, -r * 0.85); ctx.closePath(); ctx.fill(); ctx.stroke(); } break;
    case 'halo': ctx.strokeStyle = th.accent; ctx.lineWidth = 3; ctx.shadowColor = th.accent; ctx.shadowBlur = 10; ctx.beginPath(); ctx.ellipse(0, -r * 1.25 + Math.sin(t * 3) * 2, r * 0.6, r * 0.18, 0, 0, 7); ctx.stroke(); break;
    case 'visor': ctx.fillStyle = th.accent; ctx.shadowColor = th.accent; ctx.shadowBlur = 8; roundRect(ctx, -r * 0.65, -r * 0.42, r * 1.3, r * 0.32, r * 0.15); ctx.fill(); break;
    case 'hood': ctx.fillStyle = th.dark; ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 1.05, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(r * 0.3, -r * 1.35); ctx.closePath(); ctx.fill(); break;
    case 'crown': ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.8); for (let i = 0; i < 5; i++) { ctx.lineTo(-r * 0.55 + i * r * 0.275 + r * 0.1375, -r * (i % 2 ? 1.0 : 1.35)); } ctx.lineTo(r * 0.55, -r * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'mask': ctx.fillStyle = th.dark; roundRect(ctx, -r * 0.75, -r * 0.05, r * 1.5, r * 0.55, r * 0.2); ctx.fill(); break;
    case 'antenna': ctx.strokeStyle = th.accent; ctx.beginPath(); ctx.moveTo(0, -r * 0.9); ctx.lineTo(0, -r * 1.5); ctx.stroke(); ctx.fillStyle = th.accent; ctx.beginPath(); ctx.arc(0, -r * 1.55, r * 0.16 + Math.sin(t * 8) * 1.5, 0, 7); ctx.fill(); break;
    case 'ears': for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.3, -r * 0.8); ctx.lineTo(s * r * 0.75, -r * 1.35); ctx.lineTo(s * r * 0.85, -r * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke(); } break;
    case 'crest': ctx.fillStyle = th.accent; ctx.beginPath(); ctx.moveTo(-r * 0.12, -r * 0.85); ctx.quadraticCurveTo(r * 0.1, -r * 1.7, r * 0.6, -r * 1.35); ctx.quadraticCurveTo(r * 0.2, -r * 1.2, r * 0.12, -r * 0.85); ctx.fill(); break;
    case 'spikes': for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.25 - r * 0.1, -r * 0.85); ctx.lineTo(i * r * 0.3, -r * 1.35 + Math.abs(i) * r * 0.12); ctx.lineTo(i * r * 0.25 + r * 0.1, -r * 0.85); ctx.fill(); } break;
    case 'wings': for (const s of [-1, 1]) { ctx.save(); ctx.globalAlpha *= 0.85; ctx.beginPath(); ctx.moveTo(s * r * 0.8, 0); ctx.quadraticCurveTo(s * r * 1.9, -r * (0.9 + Math.sin(t * 6) * 0.2), s * r * 1.6, r * 0.4); ctx.quadraticCurveTo(s * r * 1.2, r * 0.2, s * r * 0.8, r * 0.3); ctx.fill(); ctx.restore(); } break;
    case 'tail': ctx.fillStyle = th.primary; ctx.beginPath(); ctx.ellipse(-r * 1.0, r * 0.6 + Math.sin(t * 4) * 3, r * 0.55, r * 0.25, 0.6, 0, 7); ctx.fill(); ctx.fillStyle = th.accent; ctx.beginPath(); ctx.ellipse(-r * 1.4, r * 0.85 + Math.sin(t * 4) * 3, r * 0.2, r * 0.15, 0.6, 0, 7); ctx.fill(); break;
    case 'scarf': ctx.fillStyle = th.accent; ctx.fillRect(-r * 0.75, r * 0.15, r * 1.5, r * 0.25); ctx.beginPath(); ctx.moveTo(r * 0.5, r * 0.3); ctx.lineTo(r * 1.2 + Math.sin(t * 7) * 4, r * 0.7); ctx.lineTo(r * 0.9, r * 0.9); ctx.closePath(); ctx.fill(); break;
    case 'helmet': ctx.fillStyle = th.dark; ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.95, Math.PI, 0); ctx.fill(); ctx.fillStyle = th.accent; ctx.beginPath(); ctx.moveTo(-r * 0.15, -r * 1.1); ctx.lineTo(0, -r * 1.55); ctx.lineTo(r * 0.15, -r * 1.1); ctx.fill(); break;
    case 'goggles': ctx.fillStyle = th.accent; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * 0.32, -r * 0.3, r * 0.24, 0, 7); ctx.fill(); ctx.stroke(); } break;
    case 'unihorn': ctx.fillStyle = th.accent; ctx.beginPath(); ctx.moveTo(-r * 0.15, -r * 0.85); ctx.lineTo(0, -r * 1.75); ctx.lineTo(r * 0.15, -r * 0.85); ctx.fill(); break;
    case 'flamehair': for (let i = -2; i <= 2; i++) { ctx.fillStyle = i % 2 ? th.accent : th.primary; ctx.beginPath(); ctx.moveTo(i * r * 0.25 - r * 0.2, -r * 0.7); ctx.quadraticCurveTo(i * r * 0.3 + Math.sin(t * 9 + i) * 4, -r * 1.7, i * r * 0.25 + r * 0.2, -r * 0.7); ctx.fill(); } break;
    case 'crystal': ctx.fillStyle = th.accent; ctx.globalAlpha *= 0.85; for (const [x, h] of [[-0.4, 1.1], [0, 1.5], [0.4, 1.0]]) { ctx.beginPath(); ctx.moveTo(x * r - r * 0.13, -r * 0.75); ctx.lineTo(x * r, -r * h); ctx.lineTo(x * r + r * 0.13, -r * 0.75); ctx.fill(); } break;
    case 'orbitals': for (let i = 0; i < 3; i++) { const a = t * 2.5 + i * 2.09; ctx.fillStyle = th.accent; ctx.shadowColor = th.accent; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.35, Math.sin(a) * r * 0.5 - r * 0.6, r * 0.13, 0, 7); ctx.fill(); } break;
    case 'cape': ctx.fillStyle = th.dark; ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.1); ctx.lineTo(-r * 1.1 + Math.sin(t * 5) * 3, r * 1.25); ctx.lineTo(r * 1.1 + Math.sin(t * 5 + 1) * 3, r * 1.25); ctx.lineTo(r * 0.8, -r * 0.1); ctx.closePath(); ctx.fill(); break;
  }
  ctx.restore();
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

function weapon(ctx: CanvasRenderingContext2D, ch: CharacterDef, th: Theme, r: number, attacking: boolean, t: number) {
  ctx.save();
  const p = ch.attack.pattern;
  const kick = attacking ? Math.sin(t * 40) * 2 : 0;
  ctx.fillStyle = th.accent; ctx.strokeStyle = th.dark; ctx.lineWidth = 2;
  if (p === 'melee') {
    if (ch.attack.name.includes('拳') || ch.category === 'D' && ch.attack.arcDeg && ch.attack.arcDeg < 100) {
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(r * 0.9 + (attacking && s === 1 ? 6 : 0), s * r * 0.55, r * 0.32, 0, 7); ctx.fill(); ctx.stroke(); }
    } else {
      const L = ch.attack.range > 2 ? r * 2.1 : r * 1.6;
      ctx.translate(r * 0.6, r * 0.5); ctx.rotate(attacking ? -0.9 + Math.sin(t * 30) * 0.6 : -0.5);
      ctx.fillStyle = th.dark; ctx.fillRect(-3, -3, 10, 6);
      const g = ctx.createLinearGradient(0, 0, L, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(1, th.accent);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(6, -r * 0.16); ctx.lineTo(L, 0); ctx.lineTo(6, r * 0.16); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  } else if (p === 'lob' || p === 'explode' || p === 'deploy') {
    ctx.beginPath(); ctx.arc(r * 0.95 - kick, r * 0.45, r * 0.33, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = th.dark; ctx.fillRect(r * 0.85 - kick, r * 0.05, 4, 6);
  } else if (p === 'straight' && ch.attack.element === 'light' || p === 'homing' || p === 'beam') {
    ctx.shadowColor = th.accent; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(r * 1.05, 0, r * 0.25 + Math.sin(t * 6) * 1.5, 0, 7); ctx.fill();
  } else {
    const L = p === 'straight' && ch.attack.range > 10 ? r * 2.2 : p === 'shotgun' ? r * 1.3 : r * 1.65;
    const W = p === 'shotgun' || p === 'charge' || p === 'wave' ? r * 0.42 : r * 0.28;
    ctx.fillStyle = th.dark; roundRect(ctx, r * 0.4 - kick, -W / 2 + r * 0.25, L, W, 3); ctx.fill();
    ctx.fillStyle = th.accent; ctx.fillRect(r * 0.4 + L * 0.6 - kick, -W / 2 + r * 0.25, L * 0.25, W);
  }
  ctx.restore();
}

/** Draws a fighter centred at (0,0) facing +x when rotated; body is not rotated (top-down chibi). */
export function drawFighter(ctx: CanvasRenderingContext2D, ch: CharacterDef, skinId: string, s: ArtState, r: number) {
  const skin = SKIN_BY_ID.get(skinId);
  const th = THEMES[skin ? skin.themeId : 0];
  ctx.save();
  ctx.globalAlpha *= s.alpha;
  ctx.scale(s.scale, s.scale);
  const bob = s.moving ? Math.sin(s.t * 14) * 1.6 : Math.sin(s.t * 3) * 0.8;
  // aura by rarity
  if (skin && skin.aura > 0) {
    ctx.save();
    const a = 0.25 + 0.15 * Math.sin(s.t * 4);
    const g = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * (1.5 + skin.aura * 0.15));
    g.addColorStop(0, `rgba(255,255,255,0)`); g.addColorStop(1, hexA(th.accent, 0));
    g.addColorStop(0.6, hexA(th.accent, a));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * (1.5 + skin.aura * 0.15), 0, 7); ctx.fill();
    if (skin.aura >= 3) { ctx.strokeStyle = hexA(th.accent, 0.6); ctx.lineWidth = 2; ctx.setLineDash([6, 8]); ctx.lineDashOffset = -s.t * 30; ctx.beginPath(); ctx.arc(0, 0, r * 1.45, 0, 7); ctx.stroke(); }
    ctx.restore();
  }
  // team ring
  ctx.save(); ctx.translate(0, r * 0.7);
  ctx.strokeStyle = s.teamColor; ctx.lineWidth = 3; ctx.globalAlpha *= 0.9; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05, r * 0.42, 0, 0, 7); ctx.stroke(); ctx.restore();
  ctx.translate(0, -bob);
  // weapon behind when facing up
  const faceUp = Math.sin(s.aim) < -0.2;
  const drawWeapon = () => { ctx.save(); ctx.rotate(s.aim); weapon(ctx, ch, th, r, s.attacking, s.t); ctx.restore(); };
  if (faceUp) drawWeapon();
  if (th.accessory === 'cape' || th.accessory === 'wings' || th.accessory === 'tail') accessory(ctx, th, r, s.t);
  // body silhouette per category
  const cat = ch.category;
  const bodyR = cat === 'B' ? r * 1.1 : cat === 'A' ? r * 0.92 : r;
  const grad = ctx.createRadialGradient(-bodyR * 0.35, -bodyR * 0.45, bodyR * 0.1, 0, 0, bodyR * 1.1);
  grad.addColorStop(0, lighten(th.primary, 0.35)); grad.addColorStop(0.65, th.primary); grad.addColorStop(1, th.dark);
  ctx.fillStyle = grad; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  if (cat === 'B') roundRect(ctx, -bodyR, -bodyR * 0.95, bodyR * 2, bodyR * 1.9, bodyR * 0.55);
  else if (cat === 'F') { ctx.moveTo(0, -bodyR); ctx.quadraticCurveTo(bodyR * 1.15, -bodyR * 0.9, bodyR * 0.95, bodyR * 0.2); ctx.quadraticCurveTo(bodyR * 0.6, bodyR * 1.0, 0, bodyR); ctx.quadraticCurveTo(-bodyR * 0.6, bodyR * 1.0, -bodyR * 0.95, bodyR * 0.2); ctx.quadraticCurveTo(-bodyR * 1.15, -bodyR * 0.9, 0, -bodyR); }
  else if (cat === 'E') { for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const rr = bodyR * (1 + 0.06 * Math.sin(a * 4 + s.t * 4)); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); }
  else if (cat === 'A') { ctx.ellipse(0, 0, bodyR * 0.9, bodyR, 0, 0, 7); }
  else ctx.arc(0, 0, bodyR, 0, 7);
  ctx.fill(); ctx.save(); ctx.clip(); pattern(ctx, th, bodyR, s.t); ctx.restore(); ctx.stroke();
  // belly / chest plate
  ctx.fillStyle = hexA(th.accent, 0.25); ctx.beginPath(); ctx.ellipse(0, bodyR * 0.35, bodyR * 0.55, bodyR * 0.35, 0, 0, 7); ctx.fill();
  // face looking toward aim
  const ex = Math.cos(s.aim) * bodyR * 0.28, ey = Math.sin(s.aim) * bodyR * 0.2 - bodyR * 0.2;
  if (th.accessory !== 'visor' && th.accessory !== 'mask') {
    for (const sx of [-1, 1]) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex + sx * bodyR * 0.3, ey, bodyR * 0.2, bodyR * 0.24, 0, 0, 7); ctx.fill();
      ctx.fillStyle = s.frozen ? '#5ad1ff' : '#111'; ctx.beginPath(); ctx.arc(ex + sx * bodyR * 0.3 + Math.cos(s.aim) * 2.5, ey + Math.sin(s.aim) * 2.5, bodyR * 0.11, 0, 7); ctx.fill();
    }
    if (s.stunned) { ctx.strokeStyle = '#111'; ctx.lineWidth = 2; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(ex + sx * bodyR * 0.3 - 4, ey - 4); ctx.lineTo(ex + sx * bodyR * 0.3 + 4, ey + 4); ctx.moveTo(ex + sx * bodyR * 0.3 + 4, ey - 4); ctx.lineTo(ex + sx * bodyR * 0.3 - 4, ey + 4); ctx.stroke(); } }
  } else if (th.accessory === 'mask') {
    for (const sx of [-1, 1]) { ctx.fillStyle = th.accent; ctx.beginPath(); ctx.ellipse(ex + sx * bodyR * 0.3, ey, bodyR * 0.16, bodyR * 0.08, 0, 0, 7); ctx.fill(); }
  }
  if (th.accessory !== 'cape' && th.accessory !== 'wings' && th.accessory !== 'tail') accessory(ctx, th, r, s.t);
  if (!faceUp) drawWeapon();
  // hit flash
  if (s.flash > 0) { ctx.globalAlpha = Math.min(1, s.flash) * 0.7; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, bodyR * 1.02, 0, 7); ctx.fill(); }
  if (s.frozen) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#9be8ff'; ctx.beginPath(); ctx.arc(0, 0, bodyR * 1.15, 0, 7); ctx.fill(); }
  ctx.restore();
}

export function hexA(hex: string, a: number): string {
  const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export function lighten(hex: string, k: number): string {
  const h = hex.replace('#', ''); const n = parseInt(h, 16);
  const f = (c: number) => Math.round(c + (255 - c) * k);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
