import { h, modal, toast, fmtNum } from '../dom';
import { portrait, registerScreen, type Ctx } from '../app';
import { topBar, tabs, notify } from './common';
import { MODES, getMode, type ModeId } from '../../data/modes';
import { MAP_BY_ID } from '../../data/maps';
import { getChar, CHARACTERS } from '../../data/characters';
import { getBackground, champRank } from '../../data/backgrounds';
import { buildMatch, type BuiltMatch } from '../../meta/match';
import { runGame } from '../game';
import type { MatchResult, World } from '../../sim/types';
import { applyMatchRewards } from '../../meta/rewards';
import { trackMissions } from '../../meta/missions';
import { Rng } from '../../core/rng';
import { pickModeAndMap, newDraft, draftBan, draftPick, cpuChoose, currentActor, available, type DraftState } from '../../meta/championship';
import { PERSONALITY_JP } from '../../ai/profile';
import { rankDistribution, targetRating } from '../../ai/matchmaking';
import { RARITY_COLOR, SKIN_BY_ID } from '../../data/skins';

const MODE_ICON: Record<string, string> = { ffa: '💀', tdm: '⚔', duel: '🤺', boss: '🐉', 'br-solo': '🌪', 'br-duo': '👥', 'br-trio': '👪', 'br-mega': '🌋', gem: '💎', deathmatch: '☠', vault: '💰', territory: '🚩', goal: '⚽' };

registerScreen('modes', (ctx, el, arg) => {
  const s = ctx.save.data;
  let group = arg === 'championship' ? 'champ' : arg === 'practice' ? 'practice' : 'basic';
  const render = () => {
    el.innerHTML = '';
    el.append(topBar(ctx, 'モード選択'), tabs([['basic', '基本'], ['br', 'バトルロワイヤル'], ['team', 'チーム'], ['special', 'KILL & GOAL'], ['champ', '👑 CHAMPIONSHIP'], ['practice', '🎯 練習']], group, k => { group = k; render(); }));
    const grid = h('div', { class: 'mode-grid' });
    if (group === 'champ') {
      const c = s.championship.current; const rk = champRank(c.rating);
      grid.append(h('div', { class: 'champ-panel' },
        h('h2', {}, '👑 CHAMPIONSHIP — シーズン', String(c.season)),
        h('div', { class: 'champ-rank' }, h('b', {}, rk.name), h('span', {}, `${c.rating} pt`), h('small', {}, `最高 ${c.peak} · ${c.wins}勝${c.losses}敗${c.draws}分`)),
        h('p', { class: 'muted' }, '3対3ランク戦。モードとマップはランダムに選出され、BAN/PICK開始前に公開されます。'),
        h('p', { class: 'warn' }, '⚠ チャンピオンシップではヴィクトリーボックス・コイン・通常PT・キャラクター・スキンは一切獲得できません。獲得できるのは専用レート、ランク背景、シーズン競技実績のみです。'),
        Date.now() < s.championship.leaverPenaltyUntil ? h('p', { class: 'err' }, `退出ペナルティ中：あと${Math.ceil((s.championship.leaverPenaltyUntil - Date.now()) / 60000)}分`) : null,
        h('button', { class: 'btn primary big', disabled: Date.now() < s.championship.leaverPenaltyUntil, onclick: () => startChampionship(ctx) }, 'マッチング開始'),
      ));
    } else if (group === 'practice') {
      grid.append(
        modeCard('🎯', '練習場（ダミー）', '動かないダミーを相手に技を確認。報酬なし。', () => startMatch(ctx, 'ffa', { practice: true, dummies: true })),
        modeCard('🤖', '練習場（弱いCPU）', 'ROOKIEのCPUと自由に練習。報酬なし。', () => startMatch(ctx, 'ffa', { practice: true })),
        modeCard('⚽', 'KILL & GOAL チュートリアル', 'ボール操作の説明を表示してから練習試合。', () => goalTutorial(ctx)),
      );
    } else {
      for (const m of MODES.filter(m => m.group === group)) grid.append(modeCard(MODE_ICON[m.id], m.name, m.desc + `（${m.duration}秒）`, () => startMatch(ctx, m.id), m.maps.map(x => MAP_BY_ID.get(x)?.name ?? x).join(' / ')));
    }
    el.append(grid);
    const target = targetRating(s.skill, s.charSkill[s.selectedChar]);
    const dist = rankDistribution(target);
    el.append(h('div', { class: 'mm-info muted' }, `使用キャラ: ${getChar(s.selectedChar).key} · CPU配属目安: `, Object.entries(dist).filter(([, v]) => v > 0.03).map(([r, v]) => `${r} ${Math.round(v * 100)}%`).join(' / ')));
  };
  render();
});

function modeCard(icon: string, name: string, desc: string, onClick: () => void, maps?: string) {
  return h('div', { class: 'mode-card card-click', onclick: onClick }, h('div', { class: 'mi' }, icon), h('div', {}, h('b', {}, name), h('p', {}, desc), maps ? h('small', { class: 'muted' }, '🗺 ' + maps) : null));
}

function goalTutorial(ctx: Ctx) {
  modal('KILL & GOAL の遊び方', h('div', { class: 'tut' },
    h('p', {}, '⚽ ボールに触れると保持。保持中は攻撃ボタンが「シュート」に変わります（長押しで強く・ドラッグ/マウスで方向）。'),
    h('p', {}, '🤝 パス：PC=Fキー／スマホ=PASSボタン。照準方向に近い味方へパスします。'),
    h('p', {}, '💥 攻撃を受けるとボールを落とすことがあります。スキルで敵を妨害しよう。'),
    h('p', {}, '🏁 先に2点で勝利。180秒で同点なら先取1点の延長戦（90秒）。'),
  ), [{ label: '練習試合を始める', kind: 'primary', onClick: () => { ctx.save.data.settings.tutorialDone.goal = true; startMatch(ctx, 'goal', { practice: true }); } }]);
}

export function startMatch(ctx: Ctx, mode: ModeId, o: { practice?: boolean; dummies?: boolean } = {}) {
  const s = ctx.save.data;
  if (mode === 'goal' && !s.settings.tutorialDone.goal && !o.practice) { s.settings.tutorialDone.goal = true; ctx.persist(); goalTutorial(ctx); return; }
  const built = buildMatch(s, mode, { practice: o.practice });
  if (o.dummies) for (const r of built.cfg.roster) if (!r.isPlayer) r.cpu = null;
  ctx.persist();
  battleCard(ctx, built, () => launch(ctx, built));
}

function launch(ctx: Ctx, built: BuiltMatch) {
  ctx.go('game', { built });
}

registerScreen('game', (ctx, el, arg) => {
  const { built } = arg as { built: BuiltMatch };
  const g = runGame(el, built.cfg, ctx.save.data, ctx.audio, (r, w, aborted) => onMatchEnd(ctx, built, r, w, aborted));
  return () => g.stop();
});

function onMatchEnd(ctx: Ctx, built: BuiltMatch, r: MatchResult, w: World, aborted: boolean) {
  const s = ctx.save.data; const cfg = built.cfg;
  const player = cfg.roster.find(x => x.isPlayer)!;
  if (cfg.championship && aborted) s.championship.leaverPenaltyUntil = Date.now() + 5 * 60e3;
  const summary = applyMatchRewards(s, { matchId: built.matchId, mode: cfg.mode.id, mapId: cfg.mapId, charId: player.charId, championship: cfg.championship, practice: cfg.practice, result: r, oppRating: built.oppRating });
  if (!cfg.championship && !cfg.practice) trackMissions(s, r);
  if (summary && summary.kind === 'normal' && summary.newBackgrounds.length) notify(ctx, `通常PT累計報酬：背景「${summary.newBackgrounds.join('、')}」を獲得！`);
  if (summary && summary.kind === 'championship' && summary.newBackgrounds.length) notify(ctx, `チャンピオンシップ：${summary.newBackgrounds.join('、')} を獲得！`);
  ctx.save.save(true);
  showResult(ctx, built, r, w, summary);
}

function showResult(ctx: Ctx, built: BuiltMatch, r: MatchResult, w: World, summary: ReturnType<typeof applyMatchRewards>) {
  ctx.go('home');
  const s = ctx.save.data; const cfg = built.cfg;
  const me = r.perFighter.find(f => f.isPlayer)!;
  const mvp = r.perFighter.find(f => f.id === r.mvpId);
  const title = r.outcome === 'win' ? 'VICTORY' : r.outcome === 'loss' ? 'DEFEAT' : 'DRAW';
  const rows = r.perFighter.slice().sort((a, b) => a.team - b.team || b.stats.kills - a.stats.kills);
  let rewards: HTMLElement;
  if (cfg.practice) rewards = h('div', { class: 'rew muted' }, '練習のため報酬・評価変動はありません。');
  else if (!summary) rewards = h('div', { class: 'rew muted' }, 'この試合の報酬は処理済みです。');
  else if (summary.kind === 'championship') rewards = h('div', { class: 'rew champ' },
    h('div', { class: 'big' }, `👑 ${summary.delta >= 0 ? '+' : ''}${summary.delta} pt`),
    h('div', {}, `${summary.rankBefore} → ${summary.rankAfter}（${summary.ratingAfter} pt）`),
    h('div', { class: 'muted' }, `貢献度 ${Math.round(summary.contribution * 100)}% · 競技実績のみ反映`),
    summary.newBackgrounds.length ? h('div', {}, '🎖 獲得：', summary.newBackgrounds.join('、')) : null,
    h('div', { class: 'muted' }, 'チャンピオンシップではボックス・コイン・通常PTは獲得できません。'));
  else rewards = h('div', { class: 'rew' },
    h('div', { class: 'big' }, `🏆 ${summary.ptDelta >= 0 ? '+' : ''}${summary.ptDelta} PT`),
    summary.victoryRight ? h('div', { class: 'gold' }, '🎁 ヴィクトリーボックス権 +1') : null,
    summary.newBackgrounds.length ? h('div', {}, '🖼 背景獲得：', summary.newBackgrounds.join('、')) : null,
    h('div', { class: 'muted' }, `総合評価 ${summary.ratingDelta >= 0 ? '+' : ''}${summary.ratingDelta.toFixed(1)} · キャラ評価 ${summary.charRatingDelta >= 0 ? '+' : ''}${summary.charRatingDelta.toFixed(1)}`));
  const body = h('div', { class: 'result' },
    h('div', { class: `res-title ${r.outcome}` }, title),
    h('div', { class: 'muted' }, `${cfg.mode.name} · ${MAP_BY_ID.get(cfg.mapId)?.name} · ${r.reason}${r.totalTeams > 2 ? ` · ${r.placement}位/${r.totalTeams}` : ''}`),
    h('div', { class: 'res-stats' },
      stat('キル', me.stats.kills), stat('デス', me.stats.deaths), stat('アシスト', me.stats.assists), stat('与ダメージ', fmtNum(me.stats.damage)), stat('被ダメージ', fmtNum(me.stats.taken)),
      stat('最大連続キル', me.stats.maxStreak), stat('最高コンボ', me.stats.maxCombo), stat('回復', fmtNum(me.stats.healing)), stat('目標貢献', fmtNum(me.stats.objective))),
    mvp ? h('div', { class: 'mvp' }, '⭐ MVP: ', h('b', {}, mvp.name), ` (${mvp.charKey})`) : null,
    rewards,
    h('table', { class: 'res-table' }, h('tr', {}, h('th', {}, ''), h('th', {}, 'プレイヤー'), h('th', {}, 'K'), h('th', {}, 'D'), h('th', {}, 'A'), h('th', {}, 'DMG')),
      rows.map(f => h('tr', { class: f.isPlayer ? 'me' : f.team === r.playerTeam ? 'ally' : 'enemy' }, h('td', {}, f.team === r.playerTeam ? '🔵' : '🔴'), h('td', {}, `${f.name} [${f.charKey}]`, f.cpuRank && s.settings.showCpuInfo ? h('small', { class: 'muted' }, ` CPU·${f.cpuRank}`) : !f.isPlayer ? h('small', { class: 'muted' }, ' CPU') : null), h('td', {}, String(f.stats.kills)), h('td', {}, String(f.stats.deaths)), h('td', {}, String(f.stats.assists)), h('td', {}, fmtNum(f.stats.damage))))),
  );
  void w;
  modal('リザルト', body, [
    { label: 'ホーム', kind: 'ghost', onClick: () => ctx.go('home') },
    ...(cfg.practice || cfg.championship ? [] : [{ label: '再戦', kind: 'primary' as const, onClick: () => startMatch(ctx, cfg.mode.id) }]),
    ...(cfg.championship ? [{ label: '次の試合', kind: 'primary' as const, onClick: () => startChampionship(ctx) }] : []),
  ]);
}
const stat = (k: string, v: string | number) => h('div', { class: 'st' }, h('small', {}, k), h('b', {}, String(v)));

// ───────────── Battle card (5 seconds) ─────────────
export function battleCard(ctx: Ctx, built: BuiltMatch, done: () => void) {
  const s = ctx.save.data; const cfg = built.cfg;
  const ov = h('div', { class: 'bc-ov' });
  const teams = new Map<number, typeof cfg.roster>();
  for (const r of cfg.roster) { if (!teams.has(r.team)) teams.set(r.team, []); teams.get(r.team)!.push(r); }
  const showTeams = [...teams.entries()].slice(0, cfg.mode.teams > 6 ? 99 : 6);
  const card = (r: typeof cfg.roster[number]) => {
    const bg = getBackground(r.bg);
    const ch = getChar(r.charId);
    const showTitle = r.isPlayer ? s.profile.showOnCard.title : true;
    const pts = r.isPlayer ? `キャラPT ${s.charPt[r.charId] ?? 0}${s.profile.showOnCard.totalPt ? ` · 合計 ${s.pt}` : ''}` : '';
    const sk = SKIN_BY_ID.get(r.skinId);
    return h('div', { class: `bcard ${r.isPlayer ? 'me' : ''} ${r.team === cfg.playerTeam ? 'ally' : 'enemy'}`, style: { background: bg?.css } },
      portrait(r.charId, r.skinId, cfg.roster.length > 12 ? 56 : 84),
      h('b', {}, r.name), showTitle ? h('small', {}, r.title) : null, h('span', { class: 'ck' }, ch.key, sk && sk.index > 0 ? h('i', { style: { color: RARITY_COLOR[sk.rarity] } }, ' ◆') : null),
      r.isPlayer && s.profile.showOnCard.charPt ? h('small', { class: 'pts' }, pts) : null,
      !r.isPlayer ? h('small', { class: 'cpu-tag' }, s.settings.showCpuInfo && r.cpu ? `CPU · ${r.cpu.rank} · ${r.cpu.personality}` : 'CPU') : null,
    );
  };
  ov.append(h('div', { class: 'bc-head' }, h('b', {}, cfg.mode.name), h('span', {}, MAP_BY_ID.get(cfg.mapId)?.name ?? ''), cfg.championship ? h('span', { class: 'pill champ' }, '👑 CHAMPIONSHIP') : null),
    h('div', { class: `bc-teams n${showTeams.length}` }, showTeams.map(([t, rs]) => h('div', { class: 'bc-team' }, rs.map(card), t === 0 && showTeams.length === 2 ? h('div', { class: 'vs' }, 'VS') : null))),
    h('div', { class: 'bc-foot' }, h('div', { class: 'bc-bar' }, h('i', {})), h('button', { class: 'btn ghost sm', onclick: () => finish() }, 'スキップ ▶')));
  document.body.appendChild(ov);
  let doneCalled = false;
  const finish = () => { if (doneCalled) return; doneCalled = true; ov.remove(); done(); };
  setTimeout(finish, 5000);
}

// ───────────── Championship: matchmaking & BAN/PICK ─────────────
function startChampionship(ctx: Ctx) {
  const s = ctx.save.data;
  if (Date.now() < s.championship.leaverPenaltyUntil) { toast('退出ペナルティ中です。', 'err'); return; }
  const rng = new Rng((Date.now() ^ 0x5bd1e995) >>> 0);
  const recent = s.championship.current.history.map(h0 => h0.map);
  const { mode, map } = pickModeAndMap(rng, recent);
  // matchmaking simulation (CPU opponents near rating; widening range with wait)
  const ov = h('div', { class: 'bc-ov' }, h('div', { class: 'mm-box' }, h('h2', {}, 'マッチング中…'), h('p', {}, `レート ${s.championship.current.rating} ±`, h('b', { id: 'mmr' }, '100')), h('p', { class: 'muted' }, 'CPU対戦（オンラインマッチングは未実装）')));
  document.body.appendChild(ov);
  let range = 100; const iv = setInterval(() => { range += 150; const e = document.getElementById('mmr'); if (e) e.textContent = String(range); }, 400);
  setTimeout(() => { clearInterval(iv); ov.remove(); draftScreen(ctx, newDraft(rng, mode, map, s.championship.current.rating), rng); }, 1500);
}

function draftScreen(ctx: Ctx, d: DraftState, rng: Rng) {
  const s = ctx.save.data;
  const pool = CHARACTERS.map(c => c.id);
  const playerPool = s.unlockedChars;
  const ov = h('div', { class: 'draft-ov' });
  document.body.appendChild(ov);
  let filter = '';
  const render = () => {
    ov.innerHTML = '';
    const actor = currentActor(d);
    const header = h('div', { class: 'draft-head' },
      h('div', {}, h('b', {}, getMode(d.mode).name), ' · ', MAP_BY_ID.get(d.map)?.name),
      h('div', { class: 'phase' }, d.phase === 'ban' ? `BANフェーズ（${d.bans.length}/4）` : d.phase === 'pick' ? `PICKフェーズ（${d.turn}/6）` : '確定'),
      h('div', { class: 'timer' }, `${Math.ceil(d.timer)}`),
      h('div', { class: actor.isPlayer ? 'your-turn' : 'muted' }, actor.isPlayer ? 'あなたの番です' : actor.team === 0 ? '味方CPUが選択中…' : '敵CPUが選択中…'));
    const teamCol = (team: number) => h('div', { class: `draft-team t${team}` }, h('h3', {}, team === 0 ? '味方' : '敵'),
      d.picks.filter(p => p.team === team).map(p => h('div', { class: 'draft-slot' }, p.charId ? portrait(p.charId, undefined, 48) : h('div', { class: 'empty' }, '?'), h('div', {}, h('b', {}, p.isPlayer ? s.profile.name : 'CPU'), h('small', {}, p.charId ? getChar(p.charId).key : '未選択'), !p.isPlayer && p.cpu && s.settings.showCpuInfo ? h('small', { class: 'muted' }, ` ${p.cpu.rank}·${p.cpu.personality}`) : null))),
      h('div', { class: 'bans' }, 'BAN: ', d.bans.filter((_, i) => d.banOrder[i] === team).map(b => h('span', { class: 'ban' }, getChar(b).key))));
    const av = new Set(available(d, pool));
    const canPick = (id: number) => av.has(id) && (d.phase === 'ban' || playerPool.includes(id));
    const list = h('div', { class: 'draft-grid' }, CHARACTERS.filter(c => !filter || c.key.includes(filter.toUpperCase())).map(c => h('div', {
      class: `dg ${canPick(c.id) ? '' : 'off'} ${c.status === 'complete' ? 'done' : ''}`,
      onclick: () => { if (!actor.isPlayer || !canPick(c.id)) return; if (d.phase === 'ban') draftBan(d, c.id); else draftPick(d, c.id, pool); advanceCpu(); render(); },
    }, portrait(c.id, undefined, 44), h('small', {}, c.key))));
    ov.append(header, h('div', { class: 'draft-body' }, teamCol(0), h('div', { class: 'draft-center' }, h('input', { class: 'search', placeholder: 'キャラ検索', value: filter, oninput: (e: Event) => { filter = (e.target as HTMLInputElement).value; render(); } }), h('p', { class: 'muted' }, d.phase === 'pick' ? '解放済みキャラクターのみPICK可能 · 重複不可 · 確定後変更不可' : '各チーム2体BAN（重複不可）'), list), teamCol(1)));
    if (d.phase === 'done') {
      clearInterval(iv);
      setTimeout(() => {
        ov.remove();
        const picks = d.picks.map(p => ({ team: p.team, charId: p.charId!, isPlayer: p.isPlayer, cpu: p.cpu }));
        s.selectedChar = picks.find(p => p.isPlayer)!.charId;
        const built = buildMatch(s, d.mode, { mapId: d.map, championship: true, picks });
        battleCard(ctx, built, () => launch(ctx, built));
      }, 900);
    }
  };
  const advanceCpu = () => {
    // CPU actors act after a short "thinking" delay handled by timer loop
  };
  const iv: ReturnType<typeof setInterval> = setInterval(() => {
    if (d.phase === 'done') return;
    d.timer -= 0.5;
    const actor = currentActor(d);
    const cpuReady = !actor.isPlayer && d.timer < (d.phase === 'ban' ? 13.5 : 18.5);
    if (cpuReady || d.timer <= 0) {
      if (d.phase === 'ban') draftBan(d, actor.isPlayer ? cpuChoose(rng, d, pool, true) : cpuChoose(rng, d, pool, true));
      else {
        const usable = actor.isPlayer ? playerPool : pool;
        const pick = cpuChoose(rng, d, usable.filter(id => available(d, pool).includes(id)).length ? usable : pool, false);
        draftPick(d, pick, pool);
      }
    }
    render();
  }, 500);
  render();
  void PERSONALITY_JP;
}
