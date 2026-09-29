# 恋面 技術構成・アーキテクチャ設計

- Status: Accepted for MVP
- Date: 2026-09-29
- Scope: 就活恋愛ADV「恋面（れいめん）」のMVP

## 1. 結論

| 領域 | 採用技術 | 主な責務 |
| --- | --- | --- |
| デスクトップアプリ | Electron + TypeScript | Zoom上の透明オーバーレイ、会話UI、演出、総評画面 |
| RTMSサーバー | Node.js + TypeScript | Zoom RTMS接続、字幕処理、イベント検出、Electronへの配信 |
| データ基盤 | Supabase Postgres | 面談、字幕、イベント、要約、スコアの保存 |
| 認証・アクセス制御 | Supabase Auth + RLS | ユーザー認証とユーザーごとのデータ分離 |
| AI処理 | Node.jsから外部LLM API | 面談終了後の要約、魅力、懸念、確認事項の整理 |
| CI・レビュー | GitHub Actions + CodeRabbit | 再現可能な検証と補助レビュー |

MVPではGoとRustは使用しない。ElectronとNode.jsでTypeScriptを共有し、UIの試作速度とZoom RTMSの公式Node.js SDKの利用を優先する。

## 2. 採用理由

### Electron + TypeScript

この作品の中心は、Zoomの上に重ねる恋愛ADV風の体験である。HTML / CSSを使えるElectronなら、次のUIを短いサイクルで試作できる。

- 画面下部の恋愛ゲーム風テキストボックス
- 発話者名、字幕、選択肢、企業カード
- 好感度ゲージ、ハート、キラキラ、フェード、テーマ切り替え
- 面談中の控えめな表示と、面談後の総評画面

Electronの`BrowserWindow`には透明ウィンドウ、最前面表示、マウスイベント無視などのデスクトップ向けAPIがある。オーバーレイはZoomの映像を加工するものではなく、利用者のPC上に別ウィンドウを重ねる。

参考: [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window)、[Electronの構成](https://www.electronjs.org/docs/latest/)

### Node.js + TypeScript

Zoom RTMSの公式Node.js SDKを利用できるため、RTMSのWebhook、セッション接続、イベント処理をMVPで実装しやすい。Electron側と型やデータ契約を共有できる点も、4人チームの開発速度に合う。

GoやRustでもWebSocketを直接扱うことはできるが、MVPでは公式SDKの利用とTypeScriptの共有を優先し、別言語のサービスを増やさない。

参考: [Zoom RTMS SDK](https://developers.zoom.us/docs/rtms/sdk/)、[RTMS WebSocketクイックスタート](https://developers.zoom.us/docs/rtms/meetings/quickstart-websockets/)

### Supabase

SupabaseはPostgres、Auth、RLSを担当する。面談履歴を複数端末から確認する要件が必要になった場合でも、認証とユーザー単位のデータ分離を追加しやすい。

ただし、Supabase Edge FunctionsをRTMSの長時間接続先にはしない。RTMS接続は長時間稼働できるNode.jsサービスに置く。

## 3. 全体構成

```text
Zoom Meeting
    │
    │ RTMS transcript
    ▼
Node.js / TypeScript
  ├─ Zoom RTMS接続・Webhook
  ├─ 字幕の正規化・イベント検出
  ├─ ElectronへのWebSocket配信
  ├─ 面談終了後のAI要約
  └─ Supabaseへの保存
       ├─ Postgres / Auth / RLS
       └─ Electronの履歴表示

Node.js ── WebSocket ──> Electron Desktop
                         ├─ Zoom上の透明オーバーレイ
                         ├─ 会話ログ・企業カード
                         └─ 面談後の総評
```

基本方針:

1. Zoomのカメラ映像そのものは加工せず、Electronの別ウィンドウを利用者の画面上に重ねる。
2. Zoomの秘密情報、LLM APIキー、Supabaseのservice role keyをElectronへ渡さない。
3. 元字幕と演出後字幕を分離し、元の発言を上書きしない。
4. リアルタイム表示と、面談終了後のAI要約を分離する。
5. 外部サービスが使えない場合でも、fake字幕でUIデモができるようにする。

## 4. ElectronのUI構成

```text
apps/desktop/
  electron/
    main.ts                 # BrowserWindow、ライフサイクル
    preload.ts              # rendererへ公開する最小限のAPI
    overlay-window.ts       # 透明・最前面・クリック透過
    tray.ts                 # 常駐・表示切替・共有モード
  src/
    components/             # 会話枠、字幕、ハート、通知
    features/meeting/       # 面談開始・終了・同意
    features/summary/       # 総評
    stores/                 # 表示状態
    client/                 # REST / WebSocket client
    contracts/              # Node.jsと共有する型
```

面談中は次の表示モードを切り替える。

- **通常モード**: 字幕、発話者名、控えめなイベントだけを表示する。
- **恋愛ADVモード**: 会話枠、ハート、キラキラ、選択肢などを表示する。
- **最小表示モード**: 字幕だけを表示し、集中を妨げる演出を止める。
- **共有モード**: オーバーレイを隠し、画面共有前に安全確認を表示する。

クリック透過は常時有効にせず、操作が必要なときだけ無効化する。共有モードはショートカットで一発切り替えできるようにする。

Zoomのウィンドウ共有・画面全体共有でオーバーレイがどう扱われるかはOSと共有方法に依存する。相手に絶対見えないとは約束せず、対象OSで実機検証する。

Electronのプロセス境界は次のとおり。

- **main**: ウィンドウ、トレイ、ショートカット、アプリのライフサイクルを管理する。
- **preload**: rendererへ必要な操作だけを明示的に公開する。
- **renderer**: HTML / CSS / TypeScriptでUIを表示する。

rendererへNode.jsのfilesystemや任意のIPCを直接公開しない。外部から届いた字幕やAI結果は、表示前にスキーマを検証する。

## 5. Node.jsサーバーの責務

Node.jsサーバーは、RTMSの長時間接続とElectronへの配信を担当するモジュラーモノリスとして開始する。最初から複数サービスやKubernetesには分割しない。

```text
apps/server/
  src/
    main.ts                 # 起動と依存関係の組み立て
    http/                   # Webhook / REST / health check
    rtms/                   # Zoom RTMS SDKの接続と切断
    transcript/             # 正規化・重複排除・表示変換
    events/                 # ルールベースのイベント検出
    meeting/                # 面談状態の遷移
    summary/                # 面談終了後のAI要約
    repository/             # 保存インターフェース
    infra/supabase/         # Supabase実装
    infra/llm/              # LLM API実装
    contracts/              # Electronと共有する型
```

担当する処理:

- RTMS Webhookの検証とセッション管理
- 字幕パケットの話者・時刻・順序の確認
- 字幕の重複排除と再接続時の復旧
- 元字幕を保持したまま表示用テキストを生成
- 企業情報・技術名・仕事内容などのイベント検出
- ElectronへのWebSocket配信
- 面談終了後のAI要約とスコア補助
- Supabaseへの保存と削除
- timeout、retry、graceful shutdown、構造化ログ

RTMSはZoom側のアプリ設定、Developer Pack、ホスト・管理者の許可が必要になる場合がある。就活生が企業主催の会議に参加する場合も含めて実機検証し、使えない場合に備えてfake字幕入力を残す。

## 6. 字幕と演出の設計

Zoomから受け取った元字幕と、画面表示用の字幕を別の値として扱う。

```text
source_text
  -> 空白・句読点の正規化
  -> 間・表示上の装飾ルール
  -> display_text
```

字幕の演出は意味を変更しない。リアルタイム表示でLLMに自由変換させず、MVPでは決定的なルールを使う。疑問文でない発言を疑問形に変える、発言内容を誇張する、といった変換は禁止する。

保存する値:

- `source_text`: Zoomから受信した元字幕
- `display_text`: オーバーレイ表示用
- `transform_version`: 表示変換ルールの版
- 話者、時刻、`sequence`: ログと重複排除用

## 7. データ設計

MVPで扱う主なテーブルは次のとおり。

### `meetings`

面談ID、ユーザーID、企業ID、状態、開始・終了時刻、字幕取得への同意、保存への同意を持つ。

### `transcript_segments`

面談ID、話者、元字幕、表示用字幕、時刻、sequence、表示変換ルールの版を持つ。

### `meeting_events`

`company_info_found`などの演出イベント、表示文言、発生時刻、根拠字幕を持つ。

### `meeting_summaries` / `meeting_scores`

要約、魅力、気になった点、次の確認事項、自分の企業への関心度、企業理解度、根拠、使用モデルを持つ。

好感度は「企業がユーザーをどう評価したか」ではなく、**ユーザー自身がその企業をどれくらい気になったか**を表す。AIだけで数値を確定せず、ユーザー入力を優先し、根拠を表示する。

音声・映像はMVPでは保存しない。字幕の保存とAI送信は同意した場合だけ行い、面談単位で削除できるようにする。

## 8. Electronとの通信契約

### REST

```text
POST /v1/meetings
GET  /v1/meetings/{meeting_id}
POST /v1/meetings/{meeting_id}/finish
GET  /v1/meetings/{meeting_id}/summary
DELETE /v1/meetings/{meeting_id}
GET  /healthz
GET  /readyz
```

### WebSocket

```json
{
  "type": "transcript.segment",
  "meeting_id": "meeting-id",
  "segment_id": "segment-id",
  "speaker": "interviewer",
  "source_text": "新卒でもGoを触れます",
  "display_text": "新卒でも……Go、触れます……",
  "sequence": 42,
  "occurred_at": "2026-09-29T10:00:00Z"
}
```

WebSocketは再接続を前提にする。Electronは最後に受信した`sequence`を保持し、再接続後に現在状態をRESTで取得できるようにする。MVPでは、再送よりも状態の再取得を優先して実装を単純にする。

## 9. AI要約

AIはリアルタイム字幕の必須経路に置かず、面談終了後の処理に限定する。入力は同意された字幕、ユーザーの反応、企業情報、イベントとする。出力は要約、魅力、気になった点、次に確認したい点、理解度と関心度の根拠とする。

LLMの出力は構造化データとして検証する。AIが失敗しても字幕ログと面談終了処理は失敗扱いにせず、総評だけ再実行できるようにする。使用モデル、prompt version、実行時刻、成功・失敗状態を保存する。

## 10. セキュリティとプライバシー

- Zoomの秘密情報、LLM APIキー、Supabase service role keyをElectronに埋め込まない。
- Supabase RLSでユーザーが自分の面談だけ読めるようにする。
- Node.js側でも、認証済みユーザーと`meeting_id`の所有関係を確認する。
- ログに字幕全文、JWT、APIキーを出力しない。
- HTTPS / WSSを使用する。
- 字幕取得、保存、AI送信の状態を画面に表示する。
- 保持期間、削除方法、参加者への通知・同意を明示する。
- Zoom RTMSの利用条件と利用規約を実装前に確認する。

## 11. 段階導入

### Phase 0: UI技術検証

- Electronの透明オーバーレイ
- 最前面表示、クリック透過、ショートカット非表示
- fake字幕から会話枠・イベント・ハートを表示
- Zoomのウィンドウ共有・画面全体共有を確認

### Phase 1: ローカルMVP

- 字幕モックによる会話ログ
- 決定的な演出変換
- 面談後の要約・関心度・理解度画面
- ローカル保存と削除

### Phase 2: RTMS実証

- Zoomアプリ設定とDeveloper Packの確認
- 自分がホストの会議でRTMS字幕を受信
- 企業主催を想定した参加者側のホスト承認を確認
- 日本語字幕、話者、時刻、再接続、同意フローを確認

### Phase 3: Supabase接続

- Auth、Postgres migration、RLS
- 面談・字幕・イベント・要約の保存
- 面談単位の削除

### Phase 4: 発表耐性

- RTMS停止時のfake字幕への切り替え
- AI失敗時の再実行
- WebSocket切断からの復旧
- Electronの配布と起動手順

## 12. Non-goalと重要なリスク

MVPでは次を扱わない。

- Zoomへ送信するカメラ映像の加工
- 相手の顔への自動追従フィルター
- 音声・映像ファイルの保存
- 本選考の評価や合否を判定する機能
- 最初からのマイクロサービス化、Kubernetes運用

| リスク | 対策 |
| --- | --- |
| RTMSが企業側の会議で使えない | ホスト承認を含む実機検証、fake字幕のデモ経路 |
| 字幕の分割・誤認識 | 仮表示、話者・時刻保存、元字幕保持 |
| AIが発言の意味を変える | リアルタイム変換は決定的ルール、要約は根拠付きで表示 |
| オーバーレイが画面共有に映る | 共有モードと一発非表示、共有方法ごとの検証 |
| 機密情報が外部送信される | 同意表示、保存範囲の選択、音声・映像を保存しない |
| SupabaseやAIが停止する | UIデモをローカルで成立させ、外部処理を後段に分離 |

## 13. 検証条件

- 初見ユーザーがオーバーレイの表示・非表示を発見できる。
- Zoom操作を妨げずに字幕とイベントを表示できる。
- fake字幕で2〜3分のデモを最後まで実行できる。
- RTMSの字幕が話者・時刻付きでNode.jsに届くことを確認できる。
- WebSocket再接続後も面談状態を復元できる。
- AIが失敗しても字幕ログと面談終了処理を失わない。
- ユーザーが面談単位で保存データを削除できる。

## 14. 参考資料

- [Zoom RTMS](https://developers.zoom.us/docs/rtms/)
- [Zoom RTMS SDK](https://developers.zoom.us/docs/rtms/sdk/)
- [RTMSの字幕データ](https://developers.zoom.us/docs/rtms/meetings/media/)
- [RTMSホスト・管理者の制御](https://developers.zoom.us/docs/rtms/meetings/ux-host-admin-tools-ctrls/)
- [Supabase Database](https://supabase.com/docs/guides/database/overview)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window)
- [Electronの構成](https://www.electronjs.org/docs/latest/)
