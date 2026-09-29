# ADR-0003: Electron・Node.js/TypeScript・Supabaseを採用する

- Status: Accepted
- Date: 2026-09-29
- Supersedes: ADR-0002のGoバックエンド案

## Context

恋面は、Zoomのカジュアル面談に恋愛ADV風の会話UIを重ねるデスクトップアプリである。MVPでは、透明オーバーレイ、字幕、イベント演出、面談ログ、面談後のAI要約を短期間で動かす必要がある。

旧案ではElectronとGoバックエンドを組み合わせていた。しかし、今回の価値の中心はデスクトップUIの見た目と操作感であり、HTML / CSSによる演出の試行速度を優先したい。また、Zoom RTMSには公式Node.js SDKがあるため、RTMS接続の検証にはNode.jsを使う方がMVPの不確実性を減らせる。

## Decision

- デスクトップアプリはElectron + TypeScriptで実装する。
- Electronのmain / preload / rendererの境界を設け、rendererへ秘密情報や任意のNode.js APIを公開しない。
- Zoom RTMS接続、字幕処理、イベント検出、ElectronへのWebSocket配信、面談終了後のAI要約はNode.js + TypeScriptで実装する。
- Supabase Postgresを面談・字幕・イベント・要約の保存先として利用する。
- Supabase AuthとRLSを利用してユーザー単位のアクセス制御を行う。
- RTMSの長時間接続はSupabase Edge Functionsではなく、長時間稼働できるNode.jsサービスで処理する。
- 音声・映像はMVPでは保存せず、字幕の保存・AI送信はユーザーの同意後に行う。
- MVPではGoとRustを使用しない。

## Alternatives

### Option A: Rust + egui

- 良い点
  - Rustの型安全性とネイティブUIを利用できる。
  - 透明・最前面・マウス透過のオーバーレイを試作できる。
- 採用しない理由
  - HTML / CSSほど恋愛ADV風の演出を素早く調整しにくい。
  - ElectronとNode.jsのTypeScript資産を共有できない。

### Option B: C# + WPF

- 良い点
  - Windowsの透明ウィンドウやアニメーションに向く。
  - XAMLでスタイル、テンプレート、データバインディングを構成できる。
- 採用しない理由
  - Windows専用になる。
  - RTMSサーバーのNode.jsとは別言語になり、MVPの責務が増える。

### Option C: Electron + Go

- 良い点
  - Goの並行処理、単一バイナリ、静的型付けを利用できる。
- 採用しない理由
  - Electronとバックエンドで2言語になる。
  - RTMSの公式Node.js SDKを利用できず、MVPで接続処理を自前実装する範囲が増える。

### Option D: Electronから直接Zoom・Supabase・LLMへ接続する

- 良い点
  - 構成が一見単純に見える。
- 採用しない理由
  - APIキーや秘密情報がクライアントに露出する。
  - 認証、業務ロジック、エラー処理がクライアントへ拡散する。

### Option E: SQLiteを主DBにする

- 良い点
  - ローカルで構築しやすく、オフラインでも動かせる。
- 採用しない理由
  - 認証、複数端末同期、バックアップ、ユーザーごとのデータ分離を自前実装する必要がある。
  - 必要になった場合は、Electron側のローカル一時保存として限定的に利用する。

## Consequences

### 得るもの

- HTML / CSSで恋愛ADV風の画面と演出を高速に試作できる。
- ElectronとNode.jsでTypeScriptの型・データ契約を共有できる。
- Zoom RTMSの公式Node.js SDKを利用して接続検証を始められる。
- Supabaseで認証、RLS、履歴保存をまとめて扱える。
- RTMS、UI、AI、保存の責務を分離できる。

### 受け入れるデメリット

- ElectronはChromiumとNode.jsを含むため、ネイティブアプリより配布サイズや実行時負荷が大きい。
- Zoom RTMSはDeveloper Pack、アプリ設定、ホスト・管理者の許可などの条件に左右される。
- 画面共有にオーバーレイが映らないことは、OSと共有方法ごとに実機検証が必要である。
- Supabaseと外部LLM APIへの依存、字幕に含まれる個人情報の取り扱いが残る。

## Validation

- fake字幕からElectronの会話枠・イベント・ハートを表示できる。
- 透明、最前面、クリック透過、ショートカット非表示がWindows上で動作する。
- Zoomのウィンドウ共有・画面全体共有で共有モードを確認できる。
- Node.jsでRTMSの日本語字幕、話者、時刻を受信できる。
- WebSocket切断後に面談状態を復元できる。
- AIが失敗しても字幕ログと面談終了処理が失われない。
- Supabase RLSで他ユーザーの面談を取得できない。
