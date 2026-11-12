import { h, toast, confirmBox, modal } from '../dom';
import { registerScreen, type Ctx } from '../app';
import { topBar, tabs } from './common';
import { DEFAULT_KEYS, DEFAULT_TOUCH, type TouchLayout } from '../../meta/save';
import { setLang } from '../i18n';
import { validateSkins, SKINS } from '../../data/skins';
import { validateData } from '../../data/validate';

registerScreen('settings', (ctx, el) => {
  const s = ctx.save.data; const st = s.settings;
  let tab = 'controls';
  const render = () => {
    el.innerHTML = '';
    el.append(topBar(ctx, '設定'), tabs([['controls', '操作'], ['touch', 'タッチ配置'], ['audio', 'サウンド'], ['video', '画質・演出'], ['general', '一般'], ['data', 'セーブ・データ']], tab, k => { tab = k; render(); }));
    const p = h('div', { class: 'panel settings' });
    const range = (label: string, v: number, min: number, max: number, step: number, on: (x: number) => void) => h('label', { class: 'set' }, h('span', {}, label), h('input', { type: 'range', min, max, step, value: v, oninput: (e: Event) => { on(Number((e.target as HTMLInputElement).value)); ctx.persist(); } }));
    const toggle = (label: string, v: boolean, on: (x: boolean) => void) => h('label', { class: 'set chk' }, h('input', { type: 'checkbox', checked: v, onchange: (e: Event) => { on((e.target as HTMLInputElement).checked); ctx.persist(); } }), h('span', {}, label));
    const select = <T extends string | number>(label: string, v: T, opts: [T, string][], on: (x: T) => void) => h('label', { class: 'set' }, h('span', {}, label), h('select', { onchange: (e: Event) => { const raw = (e.target as HTMLSelectElement).value; on((typeof v === 'number' ? Number(raw) : raw) as T); ctx.persist(); render(); } }, opts.map(([k, l]) => h('option', { value: k, selected: k === v }, l))));
    if (tab === 'controls') {
      const names: Record<string, string> = { up: '上移動', down: '下移動', left: '左移動', right: '右移動', skill1: 'スキル1', skill2: 'スキル2', ult: '必殺技', dodge: '回避', score: 'スコア', menu: 'メニュー', pass: 'パス（KILL&GOAL）' };
      p.append(h('p', { class: 'muted' }, 'PC：マウスで照準、左クリックで通常攻撃。キーをクリックして新しいキーを押すと変更できます。'),
        ...Object.keys(names).map(k => h('div', { class: 'set' }, h('span', {}, names[k]), h('button', { class: 'btn sm keybtn', onclick: (e: Event) => {
          const b = e.target as HTMLButtonElement; b.textContent = '…キーを押す'; const onKey = (ev: KeyboardEvent) => { ev.preventDefault(); (st.keys as unknown as Record<string, string>)[k] = ev.code; window.removeEventListener('keydown', onKey, true); ctx.persist(); render(); }; window.addEventListener('keydown', onKey, true);
        } }, (st.keys as unknown as Record<string, string>)[k]))),
        toggle('照準アシスト（PC手動エイム）', st.aimAssist, v => (st.aimAssist = v)),
        h('button', { class: 'btn ghost', onclick: () => { st.keys = { ...DEFAULT_KEYS }; ctx.persist(); render(); } }, 'キー設定を初期化'));
    } else if (tab === 'touch') {
      p.append(touchEditor(ctx, render));
    } else if (tab === 'audio') {
      p.append(range('マスター音量', st.volume, 0, 1, 0.05, v => { st.volume = v; ctx.audio.setVolumes(st.volume, st.sfx, st.music); }), range('効果音', st.sfx, 0, 1, 0.05, v => { st.sfx = v; ctx.audio.setVolumes(st.volume, st.sfx, st.music); }), range('BGM', st.music, 0, 1, 0.05, v => { st.music = v; ctx.audio.setVolumes(st.volume, st.sfx, st.music); }));
    } else if (tab === 'video') {
      p.append(select('画質', st.quality, [['low', '低（軽量）'], ['medium', '中'], ['high', '高']], v => (st.quality = v)),
        select('FPS上限', st.fpsCap, [[30, '30'], [60, '60'], [120, '120（端末依存）']], v => (st.fpsCap = v as 30 | 60 | 120)),
        toggle('FPS表示', st.showFps, v => (st.showFps = v)), range('カメラ揺れ', st.shake, 0, 1.5, 0.1, v => (st.shake = v)), toggle('ダメージ数字', st.damageNumbers, v => (st.damageNumbers = v)));
    } else if (tab === 'general') {
      p.append(select('言語（UIの一部）', st.language, [['ja', '日本語'], ['en', 'English (partial)']], v => { st.language = v; setLang(v); }),
        toggle('試合前にCPUの実力ランク・性格を表示', st.showCpuInfo, v => (st.showCpuInfo = v)), toggle('通知を受け取る', st.notifications, v => (st.notifications = v)),
        h('button', { class: 'btn ghost', onclick: () => ctx.go('profile') }, 'プロフィール設定へ'),
        h('button', { class: 'btn ghost', onclick: () => modal('利用規約・注意事項', h('div', { class: 'terms' },
          h('p', {}, 'KILL RUSH は無料のブラウザゲームです（MITライセンスのオープンソース）。課金要素はありません。'),
          h('p', {}, 'ゲーム内通貨（クレジット・コイン）は現金で購入できず、現実の価値はありません。'),
          h('p', {}, 'セーブデータはお使いのブラウザ（IndexedDB/localStorage）に保存されます。ブラウザのデータ消去・シークレットモード・端末変更で消える可能性があります。定期的に「データ引継ぎ」でバックアップしてください。'),
          h('p', {}, 'オンライン対戦・フレンド・チャット・クラン等は未実装です。対戦相手はすべてCPUです。'),
          h('p', {}, '本作のキャラクター・名称・画像・音声はすべて独自制作です。')), [{ label: '閉じる' }]) }, '利用規約'));
    } else {
      p.append(
        h('p', { class: 'muted' }, `自動セーブ：有効（IndexedDB優先＋localStorageバックアップ） · バージョン ${s.version} · 最終保存 ${new Date(s.updatedAt).toLocaleString()}`),
        h('p', { class: 'warn' }, '⚠ ブラウザのデータを消去するとセーブも消えます。引継ぎコードでバックアップしてください。'),
        h('button', { class: 'btn', onclick: () => { const code = ctx.save.exportString(); modal('引継ぎコード（バックアップ）', h('div', {}, h('textarea', { class: 'code', readonly: true, rows: 6 }, code), h('p', { class: 'muted' }, 'このコードを安全な場所に保存してください。他人に渡すとデータを複製されます。')), [{ label: 'コピー', kind: 'primary', onClick: () => { void navigator.clipboard?.writeText(code).then(() => toast('コピーしました', 'ok')); return true; } }, { label: '閉じる' }]); } }, '引継ぎコードを発行'),
        h('button', { class: 'btn', onclick: () => { const ta = h('textarea', { class: 'code', rows: 6, placeholder: 'コードを貼り付け' }); modal('データ復元', ta, [{ label: 'キャンセル', kind: 'ghost' }, { label: '復元', kind: 'danger', onClick: () => { if (ctx.save.importString(ta.value)) { toast('復元しました', 'ok'); ctx.go('home'); } else toast('コードが不正か破損しています', 'err'); } }]); } }, '引継ぎコードから復元'),
        h('button', { class: 'btn ghost', onclick: () => { const issues = [...validateSkins(), ...validateData()]; modal('データ検証', h('div', {}, h('p', {}, `スキン ${SKINS.length} 件 · 問題 ${issues.length} 件`), h('pre', { class: 'code' }, issues.length ? issues.slice(0, 50).map(i => `${i.kind}: ${i.detail}`).join('\n') : 'OK — 重複・不足・テーマ超過・性能差なし')), [{ label: '閉じる' }]); } }, 'データ検証を実行'),
        h('button', { class: 'btn danger', onclick: () => confirmBox('データ削除', 'すべてのセーブデータを削除して初期化します。元に戻せません。本当によろしいですか？', () => confirmBox('最終確認', '本当に削除しますか？', () => { void ctx.save.reset().then(() => { toast('初期化しました', 'ok'); ctx.go('home'); }); }, '削除する', true), '次へ', true) }, 'データを削除'));
    }
    el.append(p);
  };
  render();
});

function touchEditor(ctx: Ctx, rerender: () => void): HTMLElement {
  const st = ctx.save.data.settings;
  const layout: TouchLayout = st.touchLayouts[st.activeLayout] ?? structuredClone(DEFAULT_TOUCH);
  for (const k of Object.keys(DEFAULT_TOUCH)) if (!layout[k]) layout[k] = { ...DEFAULT_TOUCH[k] };
  let selected = 'attack';
  const stage = h('div', { class: 'touch-edit' });
  const labels: Record<string, string> = { stick: '移動', attack: '攻撃', skill1: 'S1', skill2: 'S2', ult: '必殺', dodge: '回避', pass: 'PASS' };
  const draw = () => {
    stage.innerHTML = '';
    for (const [k, L] of Object.entries(layout)) {
      const size = (k === 'stick' ? 130 : 70) * L.size;
      const b = h('div', { class: `te-btn ${k === selected ? 'sel' : ''}`, style: { left: `calc(${L.x * 100}% - ${size / 2}px)`, top: `calc(${L.y * 100}% - ${size / 2}px)`, width: `${size}px`, height: `${size}px`, opacity: String(Math.max(0.25, L.opacity)) } }, labels[k]);
      b.addEventListener('pointerdown', e => {
        e.preventDefault(); selected = k; b.setPointerCapture(e.pointerId); const rc = stage.getBoundingClientRect();
        const move = (ev: PointerEvent) => { L.x = Math.min(0.97, Math.max(0.03, (ev.clientX - rc.left) / rc.width)); L.y = Math.min(0.97, Math.max(0.05, (ev.clientY - rc.top) / rc.height)); b.style.left = `calc(${L.x * 100}% - ${size / 2}px)`; b.style.top = `calc(${L.y * 100}% - ${size / 2}px)`; };
        const up = () => { b.removeEventListener('pointermove', move); b.removeEventListener('pointerup', up); st.touchLayouts[st.activeLayout] = layout; ctx.persist(); draw(); ctrl(); };
        b.addEventListener('pointermove', move); b.addEventListener('pointerup', up);
      });
      stage.append(b);
    }
  };
  const ctrlBox = h('div', { class: 'te-ctrl' });
  const ctrl = () => {
    const L = layout[selected];
    ctrlBox.innerHTML = '';
    ctrlBox.append(h('b', {}, `選択中: ${labels[selected]}`),
      h('label', { class: 'set' }, h('span', {}, '大きさ'), h('input', { type: 'range', min: 0.5, max: 1.8, step: 0.05, value: L.size, oninput: (e: Event) => { L.size = Number((e.target as HTMLInputElement).value); st.touchLayouts[st.activeLayout] = layout; ctx.persist(); draw(); } })),
      h('label', { class: 'set' }, h('span', {}, '透明度'), h('input', { type: 'range', min: 0.15, max: 1, step: 0.05, value: L.opacity, oninput: (e: Event) => { L.opacity = Number((e.target as HTMLInputElement).value); st.touchLayouts[st.activeLayout] = layout; ctx.persist(); draw(); } })));
  };
  const layouts = Object.keys(st.touchLayouts);
  const bar = h('div', { class: 'row' },
    h('span', {}, 'レイアウト: '), h('select', { onchange: (e: Event) => { st.activeLayout = (e.target as HTMLSelectElement).value; ctx.persist(); rerender(); } }, layouts.map(l => h('option', { selected: l === st.activeLayout }, l))),
    h('button', { class: 'btn sm', onclick: () => { const name = `layout${layouts.length + 1}`; st.touchLayouts[name] = structuredClone(layout); st.activeLayout = name; ctx.persist(); toast(`${name} として保存`, 'ok'); rerender(); } }, '複製して新規保存'),
    h('button', { class: 'btn sm ghost', onclick: () => { st.touchLayouts[st.activeLayout] = structuredClone(DEFAULT_TOUCH); ctx.persist(); rerender(); } }, 'このレイアウトを初期化'),
    st.activeLayout !== 'default' ? h('button', { class: 'btn sm danger', onclick: () => { delete st.touchLayouts[st.activeLayout]; st.activeLayout = 'default'; ctx.persist(); rerender(); } }, '削除') : null);
  draw(); ctrl();
  return h('div', {}, h('p', { class: 'muted' }, 'ボタンをドラッグして配置を変更。横画面のプレビューです。移動スティックの当たり判定は見た目より大きく設定されています。'), bar, stage, ctrlBox);
}
