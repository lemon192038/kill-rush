import { h, fmtNum } from '../dom';
import type { Ctx, ScreenName } from '../app';
import { champRank } from '../../data/backgrounds';
import { t } from '../i18n';

export function topBar(ctx: Ctx, title?: string, back: ScreenName | null = 'home'): HTMLElement {
  const s = ctx.save.data;
  const rk = champRank(s.championship.current.rating);
  const unread = s.notifications.filter(n => !n.read).length;
  return h('header', { class: 'topbar' },
    back ? h('button', { class: 'btn ghost back', onclick: () => ctx.go(back) }, '◀ ' + t('戻る')) : h('div', { class: 'logo-sm' }, 'KILL', h('b', {}, 'RUSH')),
    title ? h('h1', { class: 'title' }, title) : h('div', { class: 'player-chip card-click', onclick: () => ctx.go('profile') }, h('b', {}, s.profile.name), h('span', { class: 'lv' }, `Lv.${s.profile.level}`)),
    h('div', { class: 'cur' },
      h('span', { class: 'pill pt', title: '通常PT' }, '🏆 ', fmtNum(s.pt)),
      h('span', { class: 'pill champ', title: 'チャンピオンシップ' }, '👑 ', rk.name),
      h('span', { class: 'pill cr', title: 'クレジット' }, '💳 ', fmtNum(s.credits)),
      h('span', { class: 'pill coin', title: 'コイン（ギア購入用）' }, '🪙 ', fmtNum(s.coins)),
      h('button', { class: 'pill bell', title: t('通知'), onclick: () => showNotifications(ctx) }, '🔔', unread ? h('i', { class: 'dot' }, String(unread)) : null),
    ));
}
import { modal } from '../dom';
function showNotifications(ctx: Ctx) {
  const s = ctx.save.data;
  const list = h('div', { class: 'notif-list' }, s.notifications.length ? s.notifications.slice(0, 30).map(n => h('div', { class: `notif ${n.read ? '' : 'new'}` }, h('small', {}, new Date(n.t).toLocaleString()), h('p', {}, n.text))) : h('p', {}, '通知はありません'));
  s.notifications.forEach(n => (n.read = true)); ctx.persist();
  modal('通知', list, [{ label: '閉じる' }]);
}
export function notify(ctx: Ctx, text: string) { if (!ctx.save.data.settings.notifications) return; ctx.save.data.notifications.unshift({ t: Date.now(), text, read: false }); if (ctx.save.data.notifications.length > 50) ctx.save.data.notifications.length = 50; }
export function tabs(items: [string, string][], active: string, on: (k: string) => void): HTMLElement {
  return h('div', { class: 'tabs' }, items.map(([k, label]) => h('button', { class: `tab ${k === active ? 'on' : ''}`, onclick: () => on(k) }, label)));
}
