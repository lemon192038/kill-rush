const EN: Record<string, string> = {
  '対戦': 'PLAY', '練習': 'PRACTICE', 'キャラクター': 'BRAWLERS', 'ショップ': 'SHOP', 'ガチャ': 'BOXES', 'ミッション': 'MISSIONS', 'ランキング': 'RANKING',
  'プロフィール': 'PROFILE', '設定': 'SETTINGS', '通知': 'NEWS', '戻る': 'BACK', 'モード選択': 'SELECT MODE', '開始': 'START',
};
let lang: 'ja' | 'en' = 'ja';
export function setLang(l: 'ja' | 'en') { lang = l; }
/** UI chrome translation (game data text remains Japanese). */
export function t(s: string): string { return lang === 'en' ? EN[s] ?? s : s; }
