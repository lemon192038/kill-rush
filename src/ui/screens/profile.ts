import { h, toast, modal, fmtNum } from '../dom';
import { portrait, registerScreen } from '../app';
import { topBar, tabs } from './common';
import { CHARACTERS, getChar } from '../../data/characters';
import { BACKGROUNDS, BAND_NAMES, champRank, getBackground, TITLES } from '../../data/backgrounds';
import { MODE_BY_ID } from '../../data/modes';
import { charEstimate, estimatedDifficulty, overallEstimate, rankDistribution, targetRating } from '../../ai/matchmaking';
import { dailyMissions, ensureDay, claimMission } from '../../meta/missions';
import { Rng, hashStr } from '../../core/rng';
import { cpuName } from '../../meta/match';

registerScreen('profile', (ctx, el) => {
  const s = ctx.save.data;
  let tab = 'stats';
  const render = () => {
    el.innerHTML = '';
    el.append(topBar(ctx, 'プロフィール'), tabs([['stats', '戦績・実力'], ['chars', 'キャラ別熟練度'], ['card', 'バトルカード'], ['champ', 'チャンピオンシップ'], ['history', '対戦履歴']], tab, k => { tab = k; render(); }));
    const sk = s.skill;
    if (tab === 'stats') {
      const g = Math.max(1, sk.games);
      const target = targetRating(sk, s.charSkill[s.selectedChar]);
      const dist = rankDistribution(target);
      el.append(h('div', { class: 'prof-grid' },
        h('div', { class: 'panel' }, h('h3', {}, '総合実力'),
          kv('総合実力評価', `${Math.round(overallEstimate(sk))}（内部 ${Math.round(sk.rating)}）`), kv('総試合数', sk.games), kv('勝敗', `${sk.wins}勝 ${sk.losses}敗 ${sk.draws}分`), kv('総合勝率', `${((sk.wins / g) * 100).toFixed(1)}%`),
          kv('連勝/連敗', sk.streak >= 0 ? `${sk.streak}連勝中` : `${-sk.streak}連敗中`),
          kv('平均キル/デス/アシスト', `${(sk.sum.kills / g).toFixed(1)} / ${(sk.sum.deaths / g).toFixed(1)} / ${(sk.sum.assists / g).toFixed(1)}`),
          kv('平均与ダメージ', fmtNum(sk.sum.damage / g)), kv('平均被ダメージ', fmtNum(sk.sum.taken / g)), kv('平均生存時間', `${(sk.sum.survival / g).toFixed(0)}秒`),
          kv('CPU戦成績', `${sk.vsCpu.w}/${sk.vsCpu.g}勝 · 平均相手評価 ${sk.vsCpu.g ? Math.round(sk.vsCpu.oppSum / sk.vsCpu.g) : '-'}`),
          kv('チャンピオンシップ', `${champRank(s.championship.current.rating).name}（${s.championship.current.rating}pt） ※通常評価とは別管理`)),
        h('div', { class: 'panel' }, h('h3', {}, '直近20試合'), h('div', { class: 'recent' }, sk.recent.length ? sk.recent.map(r => h('i', { class: `r-${r}` }, r)) : h('span', { class: 'muted' }, 'まだ試合がありません')),
          h('h3', {}, 'モード別勝率'), Object.entries(sk.byMode).map(([m, v]) => kv(MODE_BY_ID.get(m as never)?.name ?? m, `${v.w}/${v.g}（${((v.w / Math.max(1, v.g)) * 100).toFixed(0)}%）`)),
          h('h3', {}, 'CPU難易度の推定'), kv('使用キャラ', getChar(s.selectedChar).key), kv('配属目標評価', Math.round(target)), kv('中心ランク', estimatedDifficulty(target)),
          h('div', { class: 'dist' }, Object.entries(dist).map(([r, v]) => h('div', { class: 'dbar' }, h('small', {}, r), h('i', { style: { width: `${Math.round(v * 100)}%` } }), h('small', {}, `${Math.round(v * 100)}%`)))),
          h('h3', {}, '直近のCPU配属記録'), s.cpuAssignments.slice(0, 5).map(a => h('div', { class: 'muted small' }, `${new Date(a.t).toLocaleTimeString()} ${MODE_BY_ID.get(a.mode)?.name} ${getChar(a.char).key} 目標${a.target}: ${a.ranks.join(',')}`)))));
    } else if (tab === 'chars') {
      const rows = CHARACTERS.filter(c => s.charSkill[c.id] || s.unlockedChars.includes(c.id));
      el.append(h('table', { class: 'res-table' }, h('tr', {}, ['キャラ', '試合', '勝率', 'キャラPT', '熟練度', '平均K/D/A', '平均DMG', '最高コンボ'].map(x => h('th', {}, x))),
        rows.map(c => { const cs = s.charSkill[c.id]; const g = Math.max(1, cs?.games ?? 0); return h('tr', {}, h('td', {}, c.key), h('td', {}, String(cs?.games ?? 0)), h('td', {}, cs ? `${((cs.wins / g) * 100).toFixed(0)}%` : '-'), h('td', {}, String(s.charPt[c.id] ?? 0)), h('td', {}, String(Math.round(charEstimate(sk, cs)))), h('td', {}, cs ? `${(cs.sum.kills / g).toFixed(1)}/${(cs.sum.deaths / g).toFixed(1)}/${(cs.sum.assists / g).toFixed(1)}` : '-'), h('td', {}, cs ? fmtNum(cs.sum.damage / g) : '-'), h('td', {}, String(cs?.sum.maxCombo ?? 0))); })));
    } else if (tab === 'card') {
      const preview = h('div', { class: 'bcard me big', style: { background: getBackground(s.profile.bg)?.css } }, portrait(s.selectedChar, s.equippedSkin[s.selectedChar], 110), h('b', {}, s.profile.name), s.profile.showOnCard.title ? h('small', {}, s.profile.title) : null, h('span', { class: 'ck' }, getChar(s.selectedChar).key), h('small', { class: 'pts' }, `${s.profile.showOnCard.charPt ? `キャラPT ${s.charPt[s.selectedChar] ?? 0}` : ''}${s.profile.showOnCard.totalPt ? ` 合計 ${s.pt}` : ''}`));
      const owned = BACKGROUNDS.filter(b => s.ownedBackgrounds.includes(b.id) || (b.category === 'ptReward' && s.ownedBackgrounds.includes(b.id)));
      const ptOwned = s.ownedBackgrounds.filter(id => id.startsWith('pt-') && !owned.some(b => b.id === id)).map(id => getBackground(id)!).filter(Boolean);
      const catName: Record<string, string> = { collection: '通常コレクション', ptReward: '通常PT累計報酬', championship: 'チャンピオンシップ', event: 'イベント限定', special: '特別報酬' };
      el.append(h('div', { class: 'prof-grid' }, h('div', { class: 'panel' }, h('h3', {}, 'プレビュー'), preview,
        h('label', {}, '名前 ', h('input', { value: s.profile.name, maxlength: 14, onchange: (e: Event) => { s.profile.name = ((e.target as HTMLInputElement).value || 'PLAYER').slice(0, 14); ctx.persist(); render(); } })),
        h('label', {}, '称号 ', h('select', { onchange: (e: Event) => { s.profile.title = (e.target as HTMLSelectElement).value; ctx.persist(); render(); } }, [...new Set([...s.ownedTitles, ...TITLES.slice(0, 3)])].map(tt => h('option', { selected: tt === s.profile.title }, tt)))),
        ...(['title', 'charPt', 'totalPt'] as const).map(k => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: s.profile.showOnCard[k], onchange: (e: Event) => { s.profile.showOnCard[k] = (e.target as HTMLInputElement).checked; ctx.persist(); render(); } }), { title: '称号を表示', charPt: 'キャラPTを表示', totalPt: '合計PTを表示' }[k]))),
        h('div', { class: 'panel' }, h('h3', {}, '背景'), [...owned, ...ptOwned].reduce((acc: HTMLElement[], b) => { acc.push(h('div', { class: `bgopt card-click ${b.id === s.profile.bg ? 'on' : ''}`, style: { background: b.css }, onclick: () => { s.profile.bg = b.id; ctx.persist(); render(); } }, h('small', {}, `${catName[b.category]}`), h('b', {}, b.name), b.band !== undefined && s.championship.current.stars[b.band] ? h('i', {}, '★'.repeat(s.championship.current.stars[b.band])) : null)); return acc; }, []))));
    } else if (tab === 'champ') {
      const c = s.championship.current;
      el.append(h('div', { class: 'prof-grid' }, h('div', { class: 'panel' }, h('h3', {}, `シーズン ${c.season}`),
        kv('現在ランク', `${champRank(c.rating).name}（${c.rating}pt）`), kv('シーズン最高', `${champRank(c.peak).name}（${c.peak}pt）`), kv('勝敗', `${c.wins}勝 ${c.losses}敗 ${c.draws}分`), kv('勝率', `${((c.wins / Math.max(1, c.wins + c.losses + c.draws)) * 100).toFixed(1)}%`), kv('最大連勝', c.bestStreak),
        h('h3', {}, 'ランク背景 / 星'), BAND_NAMES.map((n, b) => kv(n, s.ownedBackgrounds.includes(`champ-${b}`) ? `獲得済 ${'★'.repeat(c.stars[b] ?? 0)}` : '未獲得')),
        h('p', { class: 'muted' }, '27段階（1ランク333pt）。降格しても獲得済み背景は永久保持。シーズン報酬は称号・背景・エモート等（性能差なし）。シーズン切替は未実装（現在シーズン1固定）。')),
        h('div', { class: 'panel' }, h('h3', {}, '履歴'), c.history.length ? c.history.slice(0, 20).map(x => h('div', { class: `hist ${x.result}` }, `${new Date(x.t).toLocaleDateString()} ${MODE_BY_ID.get(x.mode as never)?.name} · ${x.result.toUpperCase()} ${x.delta >= 0 ? '+' : ''}${x.delta} → ${x.rating}`)) : h('p', { class: 'muted' }, 'まだ試合がありません'))));
    } else {
      el.append(h('div', { class: 'panel' }, s.history.length ? s.history.map(x => h('div', { class: `hist ${x.outcome}` }, `${new Date(x.t).toLocaleString()} · ${x.champ ? '👑 ' : ''}${MODE_BY_ID.get(x.mode as never)?.name} · ${getChar(x.char).key} · ${x.outcome.toUpperCase()} · ${x.kills}K/${x.deaths}D${x.champ ? '' : ` · ${x.ptDelta >= 0 ? '+' : ''}${x.ptDelta}PT`}`)) : h('p', { class: 'muted' }, '履歴はありません')));
    }
  };
  render();
});
const kv = (k: string, v: string | number) => h('div', { class: 'kv' }, h('span', {}, k), h('b', {}, String(v)));

registerScreen('missions', (ctx, el) => {
  const s = ctx.save.data;
  const render = () => {
    ensureDay(s);
    el.innerHTML = '';
    el.append(topBar(ctx, 'ミッション'), h('p', { class: 'muted' }, '毎日更新。通常対戦の結果のみ進行します（チャンピオンシップ・練習は対象外）。'),
      h('div', { class: 'mission-list' }, dailyMissions(s.missions.day).map(m => {
        const p = Math.min(m.goal, s.missions.progress[m.key] ?? 0); const done = p >= m.goal; const claimed = s.missions.claimed.includes(m.id);
        return h('div', { class: `mission ${done ? 'done' : ''}` }, h('b', {}, m.text), h('div', { class: 'pbar' }, h('i', { style: { width: `${(p / m.goal) * 100}%` } })), h('small', {}, `${fmtNum(p)} / ${fmtNum(m.goal)} · 報酬: ミッションボックス権×${m.reward.missionRights}・💳${m.reward.credits}`),
          h('button', { class: 'btn sm primary', disabled: !done || claimed, onclick: () => { if (claimMission(s, m.id)) { toast('報酬を受け取りました', 'ok'); ctx.save.save(true); render(); } } }, claimed ? '受取済' : '受け取る'));
      })));
  };
  render();
});

registerScreen('ranking', (ctx, el) => {
  const s = ctx.save.data;
  let tab = 'champ';
  const render = () => {
    el.innerHTML = '';
    el.append(topBar(ctx, 'ランキング'), tabs([['champ', 'チャンピオンシップ'], ['pt', '通常PT']], tab, k => { tab = k; render(); }),
      h('p', { class: 'warn' }, '⚠ オフライン版のため、ランキングの他プレイヤーは参考用のCPU（架空）です。実在ユーザーの記録ではありません。オンラインランキングは未実装。'));
    const rng = new Rng(hashStr('ranking-' + tab));
    const mine = tab === 'champ' ? s.championship.current.rating : s.pt;
    const rows = Array.from({ length: 49 }, () => ({ name: cpuName(rng) + ' (CPU)', v: Math.round(tab === 'champ' ? rng.range(0, 9000) ** 1 : rng.range(0, 20000)), me: false }));
    rows.push({ name: s.profile.name, v: mine, me: true });
    rows.sort((a, b) => b.v - a.v);
    el.append(h('table', { class: 'res-table' }, h('tr', {}, h('th', {}, '#'), h('th', {}, 'プレイヤー'), h('th', {}, tab === 'champ' ? 'レート' : 'PT'), tab === 'champ' ? h('th', {}, 'ランク') : null),
      rows.map((r, i) => h('tr', { class: r.me ? 'me' : '' }, h('td', {}, String(i + 1)), h('td', {}, r.name), h('td', {}, fmtNum(r.v)), tab === 'champ' ? h('td', {}, champRank(r.v).name) : null))));
  };
  render();
  void modal;
});
