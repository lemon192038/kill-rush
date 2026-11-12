type Child = Node | string | number | null | undefined | false | Child[];
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'html') el.innerHTML = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  const add = (c: Child) => { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.append(c instanceof Node ? c : document.createTextNode(String(c))); };
  children.forEach(add);
  return el;
}
export function toast(msg: string, kind: 'info' | 'ok' | 'err' = 'info') {
  let box = document.getElementById('toasts');
  if (!box) { box = h('div', { id: 'toasts' }); document.body.appendChild(box); }
  const t = h('div', { class: `toast ${kind}` }, msg); box.appendChild(t);
  setTimeout(() => t.classList.add('out'), 2400); setTimeout(() => t.remove(), 2900);
}
export function modal(title: string, body: Node | string, buttons: { label: string; kind?: 'primary' | 'danger' | 'ghost'; onClick?: () => void | boolean }[]): HTMLDivElement {
  const ov = h('div', { class: 'modal-ov' });
  const close = () => ov.remove();
  const box = h('div', { class: 'modal' }, h('h2', {}, title), h('div', { class: 'modal-body' }, body),
    h('div', { class: 'modal-btns' }, buttons.map(b => h('button', { class: `btn ${b.kind ?? ''}`, onclick: () => { const keep = b.onClick?.(); if (keep !== true) close(); } }, b.label))));
  ov.appendChild(box); ov.addEventListener('click', e => { if (e.target === ov) close(); });
  document.body.appendChild(ov);
  return ov;
}
export function confirmBox(title: string, msg: string, ok: () => void, okLabel = 'OK', danger = false) {
  modal(title, msg, [{ label: 'キャンセル', kind: 'ghost' }, { label: okLabel, kind: danger ? 'danger' : 'primary', onClick: ok }]);
}
export const fmtNum = (n: number) => Math.round(n).toLocaleString('ja-JP');
