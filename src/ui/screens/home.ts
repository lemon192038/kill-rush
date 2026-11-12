import { h } from '../dom';
import { portrait, registerScreen } from '../app';
import { topBar } from './common';
import { getChar, CATEGORY_INFO } from '../../data/characters';
import { getBackground } from '../../data/backgrounds';
import { t } from '../i18n';
import { estimatedDifficulty, targetRating } from '../../ai/matchmaking';

registerScreen('home', (ctx, el) => {
  const s = ctx.save.data;
  const ch = getChar(s.selectedChar);
  const bg = getBackground(s.profile.bg);
  const skin = s.equippedSkin[ch.id];
  const target = targetRating(s.skill, s.charSkill[ch.id]);
  el.append(
    topBar(ctx, undefined, null),
    h('div', { class: 'home' },
      h('div', { class: 'home-left' },
        h('button', { class: 'menu-btn', onclick: () => ctx.go('chars') }, '🧩 ', t('キャラクター')),
        h('button', { class: 'menu-btn', onclick: () => ctx.go('shop') }, '🛒 ', t('ショップ')),
        h('button', { class: 'menu-btn', onclick: () => ctx.go('gacha') }, '🎁 ', t('ガチャ'), s.victoryRights + s.missionRights > 0 ? h('i', { class: 'dot' }, String(s.victoryRights + s.missionRights)) : null),
        h('button', { class: 'menu-btn', onclick: () => ctx.go('missions') }, '📋 ', t('ミッション')),
        h('button', { class: 'menu-btn', onclick: () => ctx.go('ranking') }, '📈 ', t('ランキング')),
        h('button', { class: 'menu-btn', onclick: () => ctx.go('profile') }, '👤 ', t('プロフィール')),
        h('button', { class: 'menu-btn', onclick: () => ctx.go('settings') }, '⚙ ', t('設定')),
      ),
      h('div', { class: 'home-stage', style: { background: bg?.css } },
        h('div', { class: 'stage-glow' }),
        portrait(ch.id, skin, 240, true),
        h('div', { class: 'stage-name' }, h('span', { class: 'cat', style: { background: CATEGORY_INFO[ch.category].color } }, CATEGORY_INFO[ch.category].jp), h('b', {}, ch.key), h('small', {}, `キャラPT ${s.charPt[ch.id] ?? 0}`)),
        h('button', { class: 'btn ghost sm', onclick: () => ctx.go('chars', ch.id) }, 'キャラ変更'),
      ),
      h('div', { class: 'home-right' },
        h('button', { class: 'play-btn', onclick: () => ctx.go('modes') }, h('b', {}, t('対戦')), h('small', {}, 'CPU対戦')),
        h('button', { class: 'menu-btn wide', onclick: () => ctx.go('modes', 'championship') }, '👑 CHAMPIONSHIP'),
        h('button', { class: 'menu-btn wide', onclick: () => ctx.go('modes', 'practice') }, '🎯 ', t('練習'), '場'),
        h('div', { class: 'info-card' },
          h('div', {}, '推定CPU難易度: ', h('b', {}, estimatedDifficulty(target))),
          h('div', { class: 'muted' }, `総合評価 ${Math.round(s.skill.rating)} · 試合数 ${s.skill.games}`),
          h('div', { class: 'muted' }, `ヴィクトリーボックス権 ×${s.victoryRights}`),
        ),
      ),
    ),
    h('footer', { class: 'home-foot muted' }, 'KILL RUSH v0.1 — CPU戦オフライン版。オンライン対戦は未実装です。セーブはブラウザ内（IndexedDB）に保存されます。'),
  );
});
