# KILL RUSH

ブラウザで遊べる、オリジナルの見下ろし型2Dリアルタイム対戦アクションゲームです。
PC・スマートフォン・iPad 対応。インストール不要・完全無料・課金要素なし。現在は **CPU対戦（オフライン）版** です。

- 公開URL（GitHub Pages）: https://lemon192038.github.io/kill-rush/
- 進捗と未実装機能の正確な一覧: [PROJECT_STATUS.md](PROJECT_STATUS.md)

> キャラクター・名称・画像（Canvas描画）・効果音（WebAudio合成）・UIはすべて独自制作です。既存ゲームの素材は使用していません。

## 遊び方

### 起動
公開URLを開くだけで起動します。ローカルでは下記「ローカル開発」を参照。

### 操作（PC）
| 操作 | キー |
|---|---|
| 移動 | WASD |
| 照準 | マウス |
| 通常攻撃 | 左クリック（長押しで連射／チャージ型は離して発射） |
| スキル1 / スキル2 | Q / E |
| 必殺技 | R |
| 回避 | Space |
| スコア | Tab（押している間） |
| メニュー | Esc |
| パス（KILL & GOAL） | F |

キーは「設定 → 操作」で変更できます。照準アシストのON/OFFも可能です。

### 操作（スマートフォン・iPad、横画面推奨）
- 左下：移動スティック（当たり判定は見た目より大きく、指が外れても追従）
- 右下：攻撃 / S1 / S2 / ★必殺 / 回避（KILL & GOAL では PASS ボタン追加）
- **タップ＝自動照準**（距離・HP・射線を考慮。必中ではありません）、**ドラッグ＝手動照準**して離すと発動
- 移動と照準は独立、複数指で同時操作可能
- 「設定 → タッチ配置」でボタンをドラッグ移動、大きさ・透明度変更、複数レイアウト保存・初期化

## 主な内容
- 200キャラクター（A〜G 7カテゴリー）。うち SHADOW / TITAN / FROST / VOLT / BLAZE / AETHER の6体は完成キット、残り194体はプリセット構成の試作キット（すべて異なる組み合わせ・実際に動作）
- 13モード：FREE FOR ALL, TEAM DEATHMATCH, DUEL, BOSS HUNT, SOLO/DUO/TRIO/MEGA BATTLE ROYALE, GEM HUNT, DEATHMATCH, VAULT BREAK, TERRITORY BATTLE, KILL & GOAL
- CHAMPIONSHIP（3対3ランク戦、BAN/PICK、27段階レート、ランク背景）— **ボックス・コイン・通常PT・キャラ・スキンは一切獲得不可**
- 草むら潜伏、⚡パワーキューブ（BRのみ）、状態異常、ノックバック、ヒットストップ、コンボ、キルログ
- CPU AI：7能力 × 20性格 × 8実力ランク。プレイヤーの総合実力・使用キャラ熟練度・直近戦績から適切な強さのCPUを配属
- ギア（1キャラ7種、計1400、1つ1000コイン）、スキン（計1400、7レアリティ、性能差なし）、8種のガチャ、ミッション、バトルカード

## ローカル開発
必要環境：Node.js 20 以上

```bash
npm install
```

```bash
npm run dev
```

ブラウザで表示されたURL（例: http://localhost:5173/kill-rush/ ）を開きます。

## ビルド・テスト
```bash
npm run build
```

```bash
npm test
```

```bash
npm run lint
```

`npm run build` は型チェック（tsc）→ Vite ビルドを行い、`dist/` に静的ファイルを出力します。
`npm run zip` でソース＋ビルド済み `dist/` を含む `kill-rush.zip` を作成します（node_modules は含みません）。

## GitHub Pages 公開
1. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定
2. `main` ブランチへ push すると `.github/workflows/deploy.yml` が lint → test → build → デプロイを自動実行
3. ベースパスはリポジトリ名から自動設定（`BASE_PATH=/<repo名>/`）。別の場所に置く場合は `BASE_PATH=/ npm run build` のように指定
4. 単一ページ構成のため、リロードや直接URLアクセスでも表示されます（`404.html` も同じ内容を配置）

## セーブの仕組み
- 自動セーブ：IndexedDB を優先し、localStorage にもバックアップ。両方使えない環境（一部のプライベートモード）ではメモリ保存となり、タブを閉じると消えます
- データにはバージョン番号とチェックサムがあり、破損を検出すると通知して初期データで起動します
- 旧バージョンのデータは自動移行（不足項目の補完・不正値の修正）
- 「設定 → セーブ・データ」で **引継ぎコードの発行／復元**、データ検証、データ削除（2段階確認）
- ⚠ **ブラウザのデータ消去・端末変更でセーブは消えます。** 引継ぎコードでバックアップしてください
- 報酬はマッチIDで二重加算を防止しています

## 対応端末
- PC：最新の Chrome / Edge / Firefox / Safari
- スマートフォン：iOS Safari 15+ / Android Chrome（横画面推奨）
- iPad：Safari（横画面推奨）

## 実装済み / 未実装
概要のみ記載します。詳細は [PROJECT_STATUS.md](PROJECT_STATUS.md)。

**未実装（主なもの）**：オンライン対戦一式（認証・マッチング・通信・サーバー判定・不正対策・再接続・観戦・チャット・フレンド・クラン・パーティー）、オンラインランキング（現在は参考用CPU表示）、シーズン切替、イベント運用、エモート、194体の専用モーション・専用演出、ゴールのリプレイ演出、独自戦闘システムの一部（RUSH MODE 等7種）。

## 既知の問題
- CPUがまれに地形で一時的に詰まることがあります（自動復帰あり）
- KILL & GOAL のCPUは得点力が低めで、引き分け（延長戦）になりやすい
- 試作キャラクター194体は数値・演出が未調整です
- 詳細は PROJECT_STATUS.md 参照

## オンライン化の将来構成（無料枠で開始可能な案）
GitHub Pages は静的ホスティングのみのため、安全なオンライン対戦サーバーは提供できません。将来は次の構成を想定しています。

| 役割 | 候補（無料枠あり） |
|---|---|
| 認証・プロフィール・セーブ同期 | Supabase Auth + Postgres / Firebase Auth + Firestore |
| リアルタイム対戦サーバー（サーバー権威） | Cloudflare Workers + Durable Objects（WebSocket）／ Fly.io 上の Node.js + Colyseus |
| マッチング・ランキング | Durable Objects / Supabase のテーブル＋Edge Functions |
| 不正対策 | サーバー側で `src/sim`（決定論的シミュレーション）を実行し、クライアントは入力のみ送信 |

本プロジェクトのシミュレーション（`src/sim`）は描画・UIから分離され、シード付きRNGで決定論的に動作するため、そのままサーバー側で実行できる設計です。

## ディレクトリ構成
```
src/
  core/      数学・RNG・定数
  data/      キャラクター・プリセット・ギア・スキン・マップ・モード・経済設定・検証
  sim/       戦闘シミュレーション（描画非依存）・モードルール・物理・視界
  ai/        CPU AI（性格・能力・ランク）、実力評価とCPU配属
  meta/      セーブ、報酬、経済、ガチャ、チャンピオンシップ、ミッション
  render/    Canvas描画、キャラクター描画、パーティクル
  input/     キーボード・マウス・タッチ
  audio/     WebAudio効果音・BGM
  ui/        画面（ホーム、モード、BAN/PICK、キャラ、ショップ、ガチャ、プロフィール、設定）
tests/       Vitest
```

## 将来の開発手順
1. キャラクター完成：`src/data/characters.ts` の `complete()` に手調整キットを追加すると `status: 'complete'` になります。新しい技は `src/data/presets.ts` の Op を組み合わせて定義
2. 新しい技の動作：`src/data/types.ts` の `Op` に種類を追加し、`src/sim/abilities.ts` の `runOp` に処理を追加
3. 新モード：`src/data/modes.ts` に定義、`src/sim/modes.ts` に `ModeRules` を実装
4. 新マップ：`src/data/maps.ts` の `MAPS` に追加（シード付き自動生成）
5. 調整値：経済・ガチャは `src/data/config.ts`、CPU配属の重みは `src/ai/matchmaking.ts` の `MM_WEIGHTS`
6. 変更後は `npm test` と `npm run lint` を実行

## ライセンス
MIT License（[LICENSE](LICENSE)）
