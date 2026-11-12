import { h, toast, confirmBox, modal, fmtNum } from '../dom';
import { portrait, registerScreen, type Ctx } from '../app';
import { topBar, tabs } from './common';
import { CHARACTERS, getChar, CATEGORY_INFO } from '../../data/characters';
import { gearsFor, type GearKey } from '../../data/gears';
import { RARITIES, RARITY_COLOR, SKINS, skinsFor, THEMES, type Rarity } from '../../data/skins';
import { ECONOMY, GACHA, type GachaKind } from '../../data/config';
import { buyGear, buySkin, equipGear, equipSkin, unequipGear, unlockWithPoints, openGacha, canOpen } from '../../meta/economy';
import { Rng } from '../../core/rng';
import { SPEED } from '../../core/constants';
import type { AbilityDef, Category, CharacterDef } from '../../data/types';
import { BG_BY_ID, getBackground } from '../../data/backgrounds';
import { charEstimate } from '../../ai/matchmaking';

registerScreen('chars', (ctx, el, arg) => {
  const s = ctx.save.data;
  let cat: Category | 'ALL' = 'ALL', onlyOwned = false, q = '';
  let sel = typeof arg === 'number' ? arg : s.selectedChar;
  const render = () => {
    el.innerHTML = '';
    el.append(topBar(ctx, 'キャラクター'));
    const filters = h('div', { class: 'filters' },
      tabs([['ALL', 'すべて'], ...(['A', 'B', 'C', 'D', 'E', 'F', 'G'] as Category[]).map(c => [c, `${c}:${CATEGORY_INFO[c].jp}`] as [string, string])], cat, k => { cat = k as Category; render(); }),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: onlyOwned, onchange: (e: Event) => { onlyOwned = (e.target as HTMLInputElement).checked; render(); } }), '所持のみ'),
      h('input', { class: 'search', placeholder: '名前検索', value: q, oninput: (e: Event) => { q = (e.target as HTMLInputElement).value; renderGrid(); } }),
      h('span', { class: 'muted' }, `所持 ${s.unlockedChars.length}/200 · キャラポイント ${s.charPoints}/${ECONOMY.charUnlockPoints}`));
    const layout = h('div', { class: 'chars-layout' });
    const grid = h('div', { class: 'char-grid' });
    const detail = h('div', { class: 'char-detail' });
    const renderGrid = () => {
      grid.innerHTML = '';
      for (const c of CHARACTERS) {
        if (cat !== 'ALL' && c.category !== cat) continue;
        const owned = s.unlockedChars.includes(c.id);
        if (onlyOwned && !owned) continue;
        if (q && !c.key.includes(q.toUpperCase())) continue;
        grid.append(h('div', { class: `cc card-click ${owned ? '' : 'locked'} ${c.id === sel ? 'sel' : ''}`, onclick: () => { sel = c.id; render(); } },
          portrait(c.id, s.equippedSkin[c.id], 64), h('small', {}, String(c.id).padStart(3, '0')), h('b', {}, c.key),
          c.status === 'complete' ? h('i', { class: 'badge ok' }, '完成') : h('i', { class: 'badge proto' }, '試作')));
      }
    };
    renderGrid();
    renderDetail(ctx, detail, getChar(sel), render);
    layout.append(grid, detail);
    el.append(filters, layout);
  };
  render();
});

function abilityBlock(label: string, a: AbilityDef, extra = '') {
  return h('div', { class: 'ab' }, h('small', {}, label), h('b', {}, a.name), h('p', {}, a.desc), h('small', { class: 'muted' }, `${a.cooldown ? `CD ${a.cooldown}秒 · ` : ''}予備動作 ${a.startup}F · 射程 ${a.range}${extra}${a.stealth === 'keep' ? ' · 潜伏維持' : ' · 潜伏解除'}`));
}

function renderDetail(ctx: Ctx, el: HTMLElement, c: CharacterDef, rerender: () => void) {
  const s = ctx.save.data;
  const owned = s.unlockedChars.includes(c.id);
  const a = c.attack;
  const cs = s.charSkill[c.id];
  el.append(
    h('div', { class: 'cd-head' }, portrait(c.id, s.equippedSkin[c.id], 120, true), h('div', {},
      h('span', { class: 'cat', style: { background: CATEGORY_INFO[c.category].color } }, `${c.category} ${CATEGORY_INFO[c.category].jp}`),
      h('h2', {}, c.key, ' ', h('small', {}, `#${String(c.id).padStart(3, '0')}`)),
      h('div', {}, `${c.role} · ${c.combatType} · 難易度 ${'★'.repeat(c.difficulty)}${'☆'.repeat(5 - c.difficulty)}`),
      h('div', {}, `HP ${fmtNum(c.hp)} · 速度 ${c.speedClass}（${SPEED[c.speedClass]}）`),
      h('div', { class: c.status === 'complete' ? 'ok' : 'warn' }, c.status === 'complete' ? '✔ 完成キット（専用調整済み）' : '△ 試作キット：プリセット構成。専用モーション/演出は未実装'),
      h('div', { class: 'muted' }, `固有メカニクス: ${c.mechanic}`),
    )),
    owned ? h('div', { class: 'row' },
      h('button', { class: 'btn primary', disabled: s.selectedChar === c.id, onclick: () => { s.selectedChar = c.id; ctx.persist(); toast(`${c.key} を選択しました`, 'ok'); rerender(); } }, s.selectedChar === c.id ? '使用中' : 'このキャラを使う'),
      h('span', { class: 'muted' }, `キャラPT ${s.charPt[c.id] ?? 0} · 熟練度評価 ${Math.round(charEstimate(s.skill, cs))} · ${cs ? `${cs.games}戦${cs.wins}勝` : '未使用'}`),
    ) : h('div', { class: 'row' }, h('span', { class: 'warn' }, '🔒 未解放（ガチャまたはキャラクターポイント1000で解放）'),
      h('button', { class: 'btn', disabled: s.charPoints < ECONOMY.charUnlockPoints, onclick: () => confirmBox('解放', `${ECONOMY.charUnlockPoints}キャラクターポイントで${c.key}を解放しますか？`, () => { const r = unlockWithPoints(s, c.id); toast(r.msg, r.ok ? 'ok' : 'err'); ctx.persist(); rerender(); }) }, `ポイントで解放（${s.charPoints}/${ECONOMY.charUnlockPoints}）`)),
    h('div', { class: 'ab' }, h('small', {}, '通常攻撃'), h('b', {}, a.name), h('p', {}, `${a.pattern} · ダメージ ${Math.round(a.damage)}${(a.count ?? 1) > 1 ? `×${a.count}` : ''} · 射程 ${a.range} · 弾薬 ${a.ammo} · リロード ${a.reload}秒 · 発生 ${a.startup}F · 硬直 ${a.recovery}F${a.knockback ? ` · ノックバック ${a.knockback}` : ''}${a.critChance ? ` · クリティカル ${a.critChance * 100}%` : ''}${a.pierce ? ' · 貫通' : ''}${a.element ? ` · 属性 ${a.element}` : ''}`)),
    abilityBlock('スキル1', c.skill1), abilityBlock('スキル2', c.skill2), abilityBlock('必殺技', c.ult, ` · ゲージ ${c.ultCharge}`),
    h('div', { class: 'ab' }, h('small', {}, 'パッシブ'), h('b', {}, c.passive.name), h('p', {}, c.passive.desc)),
    h('div', { class: 'ab' }, h('small', {}, 'コンボ / 戦術'), h('p', {}, c.combo), h('p', { class: 'muted' }, c.tactics), h('p', { class: 'muted' }, `得意: ${c.strongVs} / 苦手: ${c.weakVs} / 弱点: ${c.weakness}`)),
  );
  if (owned) {
    // gears
    const eq = s.equippedGears[c.id] ?? [];
    el.append(h('h3', {}, `ギア（装備 ${eq.length}/2） · 🪙 ${fmtNum(s.coins)}`), h('div', { class: 'gear-list' }, gearsFor(c.id).map(g => {
      const has = s.ownedGears.includes(g.id), on = eq.includes(g.key);
      return h('div', { class: `gear ${has ? 'own' : ''} ${on ? 'on' : ''} ${g.key === 'UNIQUE' ? 'uniq' : ''}` }, h('b', {}, g.name), h('p', {}, g.desc),
        !has ? h('button', { class: 'btn sm', onclick: () => confirmBox('ギア購入', `${g.name} を ${g.price} コインで購入しますか？`, () => { const r = buyGear(s, g.id); toast(r.msg, r.ok ? 'ok' : 'err'); ctx.save.save(true); rerender(); }) }, `🪙 ${g.price}`)
          : on ? h('button', { class: 'btn sm ghost', onclick: () => { unequipGear(s, c.id, g.key as GearKey); ctx.persist(); rerender(); } }, '外す')
            : h('button', { class: 'btn sm', onclick: () => { const r = equipGear(s, c.id, g.key as GearKey); toast(r.msg, r.ok ? 'ok' : 'err'); ctx.persist(); rerender(); } }, '装備'));
    })), h('p', { class: 'muted' }, 'ギアの変更は試合前のみ可能です（試合中は変更不可）。'));
    // skins
    el.append(h('h3', {}, 'スキン'), h('div', { class: 'skin-list' }, skinsFor(c.id).map(sk => {
      const has = s.ownedSkins.includes(sk.id), on = s.equippedSkin[c.id] === sk.id;
      return h('div', { class: `skin ${on ? 'on' : ''}`, style: { borderColor: RARITY_COLOR[sk.rarity] } }, portrait(c.id, sk.id, 64), h('small', { style: { color: RARITY_COLOR[sk.rarity] } }, sk.rarity), h('b', {}, THEMES[sk.themeId].name),
        has ? h('button', { class: 'btn sm', disabled: on, onclick: () => { equipSkin(s, sk.id); ctx.persist(); rerender(); } }, on ? '装備中' : '装備') : h('button', { class: 'btn sm ghost', onclick: () => ctx.go('shop', { tab: 'skins', char: c.id }) }, `💳 ${fmtNum(sk.price)}`));
    })));
  }
}

// ───────────── SHOP ─────────────
registerScreen('shop', (ctx, el, arg) => {
  const s = ctx.save.data;
  const a = (arg ?? {}) as { tab?: string; char?: number };
  let tab = a.tab ?? 'gears', charSel = a.char ?? s.selectedChar, rar: Rarity | 'ALL' = 'ALL', sort: 'price' | 'rarity' | 'char' = 'char', q = '', ownedFilter: 'all' | 'owned' | 'unowned' = 'all';
  const render = () => {
    el.innerHTML = '';
    el.append(topBar(ctx, 'ショップ'), tabs([['gears', '⚙ ギア（コイン）'], ['skins', '🎨 スキン（クレジット）']], tab, k => { tab = k; render(); }));
    if (tab === 'gears') {
      const sel = h('select', { onchange: (e: Event) => { charSel = Number((e.target as HTMLSelectElement).value); render(); } }, s.unlockedChars.slice().sort((x, y) => x - y).map(id => h('option', { value: id, selected: id === charSel }, getChar(id).key)));
      el.append(h('div', { class: 'filters' }, 'キャラクター: ', sel, h('span', { class: 'pill coin' }, `🪙 ${fmtNum(s.coins)}`), h('span', { class: 'muted' }, '1ギア＝1000コイン。購入後は永久所持。ヴィクトリーボックスから高確率でコインが出ます。')));
      const eq = s.equippedGears[charSel] ?? [];
      el.append(h('div', { class: 'gear-list wide' }, gearsFor(charSel).map(g => {
        const has = s.ownedGears.includes(g.id);
        return h('div', { class: `gear ${has ? 'own' : ''} ${eq.includes(g.key) ? 'on' : ''} ${g.key === 'UNIQUE' ? 'uniq' : ''}` }, h('b', {}, g.name), h('p', {}, g.desc), h('small', { class: 'muted' }, has ? (eq.includes(g.key) ? '装備中' : '所持') : `価格 ${g.price} コイン`),
          has ? null : h('button', { class: 'btn sm', disabled: s.coins < g.price, onclick: (e: Event) => { (e.target as HTMLButtonElement).disabled = true; confirmBox('購入確認', `${getChar(charSel).key} の ${g.name} を ${g.price} コインで購入しますか？`, () => { const r = buyGear(s, g.id); toast(r.msg, r.ok ? 'ok' : 'err'); ctx.save.save(true); render(); }); } }, '購入'));
      })));
    } else {
      el.append(h('div', { class: 'filters' },
        h('input', { class: 'search', placeholder: 'キャラ名検索', value: q, onchange: (e: Event) => { q = (e.target as HTMLInputElement).value; render(); } }),
        h('select', { onchange: (e: Event) => { rar = (e.target as HTMLSelectElement).value as Rarity; render(); } }, h('option', { value: 'ALL' }, '全レアリティ'), RARITIES.map(r => h('option', { value: r, selected: r === rar }, r))),
        h('select', { onchange: (e: Event) => { sort = (e.target as HTMLSelectElement).value as typeof sort; render(); } }, [['char', 'キャラ順'], ['price', '価格順'], ['rarity', 'レア度順']].map(([k, l]) => h('option', { value: k, selected: k === sort }, l))),
        h('select', { onchange: (e: Event) => { ownedFilter = (e.target as HTMLSelectElement).value as typeof ownedFilter; render(); } }, [['all', '全て'], ['owned', '所持'], ['unowned', '未所持']].map(([k, l]) => h('option', { value: k, selected: k === ownedFilter }, l))),
        h('span', { class: 'pill cr' }, `💳 ${fmtNum(s.credits)}`)));
      let list = SKINS.filter(sk => s.unlockedChars.includes(sk.charId) || q);
      if (a.char && !q) list = list.filter(sk => sk.charId === a.char);
      if (q) list = list.filter(sk => getChar(sk.charId).key.includes(q.toUpperCase()));
      if (rar !== 'ALL') list = list.filter(sk => sk.rarity === rar);
      if (ownedFilter !== 'all') list = list.filter(sk => s.ownedSkins.includes(sk.id) === (ownedFilter === 'owned'));
      if (sort === 'price') list = list.slice().sort((x, y) => x.price - y.price); else if (sort === 'rarity') list = list.slice().sort((x, y) => y.index - x.index);
      const shown = list.slice(0, 120);
      el.append(h('p', { class: 'muted' }, `${list.length}件${list.length > 120 ? '（先頭120件を表示。検索で絞り込み）' : ''} · スキンは見た目のみで性能差はありません。`),
        h('div', { class: 'skin-shop' }, shown.map(sk => {
          const has = s.ownedSkins.includes(sk.id); const ch = getChar(sk.charId);
          return h('div', { class: 'skin card-click', style: { borderColor: RARITY_COLOR[sk.rarity] }, onclick: () => previewSkin(ctx, sk.id, render) }, portrait(sk.charId, sk.id, 72), h('small', { style: { color: RARITY_COLOR[sk.rarity] } }, sk.rarity), h('b', {}, ch.key), h('small', {}, THEMES[sk.themeId].name), h('span', {}, has ? '所持' : `💳 ${fmtNum(sk.price)}`));
        })));
    }
  };
  render();
});

function previewSkin(ctx: Ctx, skinId: string, rerender: () => void) {
  const s = ctx.save.data; const sk = SKINS.find(x => x.id === skinId)!; const ch = getChar(sk.charId); const th = THEMES[sk.themeId];
  const has = s.ownedSkins.includes(sk.id);
  const fxLabel: Record<string, string> = { model: '外観', weapon: '武器', attackFx: '通常攻撃演出', skillFx: 'スキル演出', ultFx: '必殺技演出', killFx: 'キル演出', entranceFx: '登場演出', victoryFx: '勝利演出' };
  const body = h('div', { class: 'skin-preview' }, portrait(sk.charId, sk.id, 200, true),
    h('div', {}, h('b', { style: { color: RARITY_COLOR[sk.rarity] } }, sk.rarity), h('h3', {}, sk.name), h('p', {}, `テーマ: ${th.name}（アクセサリー: ${th.accessory} / 模様: ${th.pattern} / 武器: ${th.weapon}）`),
      h('ul', {}, Object.entries(sk.fx).map(([k, v]) => h('li', {}, `${fxLabel[k]}: ${v}`))),
      h('p', { class: 'muted' }, '演出プレビュー：外観・オーラ・軌跡は上の動くプレビューで確認できます。キル/登場演出は試合中に再生されます。性能差はありません。')));
  modal(`${ch.key} スキン`, body, [
    { label: '閉じる', kind: 'ghost' },
    ...(has ? [] : [{ label: `💳 ${fmtNum(sk.price)} で購入`, kind: 'primary' as const, onClick: () => { confirmBox('購入確認', `${sk.name} を ${sk.price} クレジットで購入しますか？`, () => { const r = buySkin(s, sk.id); toast(r.msg, r.ok ? 'ok' : 'err'); ctx.save.save(true); rerender(); }); } }]),
  ]);
}

// ───────────── GACHA ─────────────
registerScreen('gacha', (ctx, el) => {
  const s = ctx.save.data;
  let busy = false;
  const render = () => {
    el.innerHTML = '';
    el.append(topBar(ctx, 'ガチャ'), h('div', { class: 'filters' }, h('span', { class: 'pill' }, `🎁 ヴィクトリー権 ×${s.victoryRights}`), h('span', { class: 'pill' }, `📋 ミッション権 ×${s.missionRights}`), h('span', { class: 'pill cr' }, `💳 ${fmtNum(s.credits)}`), h('span', { class: 'pill coin' }, `🪙 ${fmtNum(s.coins)}`), h('span', { class: 'muted' }, `キャラポイント ${s.charPoints}`)));
    el.append(h('div', { class: 'gacha-grid' }, GACHA.map(g => {
      const one = canOpen(s, g.kind, 1), ten = canOpen(s, g.kind, 10);
      const cost = g.cost.type === 'credits' ? `💳 ${g.cost.amount}` : g.cost.type === 'victoryRight' ? '🎁 ×1' : g.cost.type === 'missionRight' ? '📋 ×1' : '無料';
      return h('div', { class: `gbox g-${g.kind.toLowerCase()}` }, h('div', { class: 'gicon' }, '🎁'), h('b', {}, g.name), h('p', {}, g.desc),
        h('small', { class: 'muted' }, `排出: キャラ${g.weights.character}% スキン${g.weights.skin}% クレジット${g.weights.credits}% 背景${g.weights.background}%${g.kind === 'VICTORY' ? ' + コイン90%' : ''} · 天井 ${g.pity < 9999 ? g.pity + '回でキャラ確定' : 'なし'}`),
        h('div', { class: 'row' }, h('button', { class: 'btn', disabled: !one.ok, title: one.msg, onclick: () => doOpen(g.kind, 1) }, `1回 ${cost}`), g.allowTen ? h('button', { class: 'btn primary', disabled: !ten.ok, title: ten.msg, onclick: () => doOpen(g.kind, 10) }, '10連') : null),
        !one.ok ? h('small', { class: 'muted' }, one.msg) : null);
    })));
  };
  const doOpen = (kind: GachaKind, n: number) => {
    if (busy) return; busy = true;
    const res = openGacha(s, kind, n, new Rng((Date.now() * 7919) >>> 0));
    ctx.save.save(true);
    if (!res.ok) { toast(res.msg, 'err'); busy = false; return; }
    ctx.audio.play('gacha');
    const rare = res.rewards.some(r => r.type === 'character' && !r.duplicate || r.rarity === 'LEGENDARY' || r.rarity === 'MYTHIC');
    setTimeout(() => ctx.audio.play(rare ? 'rare' : 'pickup'), 500);
    const list = h('div', { class: 'gacha-res' }, res.rewards.map((r, i) => h('div', { class: `gr ${r.type}`, style: { animationDelay: `${i * 0.08}s`, borderColor: r.rarity && r.rarity !== 'CHAR' ? RARITY_COLOR[r.rarity] : r.type === 'character' ? '#ff4fd8' : undefined } },
      r.type === 'character' ? portrait(Number(r.id), undefined, 56) : r.type === 'skin' ? portrait(Number(String(r.id).split('-')[0]), String(r.id), 56) : r.type === 'background' ? h('div', { class: 'bgthumb', style: { background: (getBackground(String(r.id)) ?? BG_BY_ID.get('col-1'))!.css } }) : h('div', { class: 'gicon sm' }, r.type === 'coins' ? '🪙' : '💳'),
      h('small', {}, r.label))));
    busy = false; render(); modal('開封結果', list, [{ label: 'OK', kind: 'primary' }]);
  };
  render();
});
