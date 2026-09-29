# CodeRabbit 運用方針

CodeRabbitは、恋面の設計・実装・品質レビューを補助するために使います。最終判断やCIの代わりではありません。

## 役割

CodeRabbitに期待すること:

- Electronのmain / preload / renderer境界、IPC、BrowserWindow設定のレビュー
- 透明オーバーレイ、クリック透過、共有モード、UI状態のレビュー
- Node.js / TypeScriptの責務分離、RTMS接続、WebSocket、再接続、timeout、retryのレビュー
- 元字幕と表示用字幕の分離、重複排除、順序、話者・時刻の扱いのレビュー
- Supabase migration、RLS、同意、保持期間、面談単位の削除のレビュー
- AI要約の構造化出力、失敗時の再実行、secretと個人情報の扱いのレビュー
- TypeScriptのunit / integration testにおける境界値、エラー経路、外部サービス依存のレビュー
- README・ADR・実装方針の矛盾、古いGo前提の記述の指摘

CodeRabbitに任せないこと:

- merge可否の最終判断
- test、lint、buildの実行結果そのもの
- Zoom RTMSが実際の企業主催会議で利用できるかの実機確認
- 画面共有時にオーバーレイが相手へ見えないことの保証
- アーキテクチャ判断、プライバシー方針、参加者への同意判断の最終決定

客観的なmerge gateはGitHub Actionsのtest / lint / buildなどに置きます。CodeRabbitのコメントが残っていることだけを理由にmergeを止める運用にはしません。

## PRで使うコマンド

CodeRabbitがGitHub Appとしてこのリポジトリにインストールされていることが前提です。

- '@coderabbitai review'
  - 差分レビューを依頼する
- '@coderabbitai full review'
  - PR全体のレビューを依頼する
- '@coderabbitai generate unit tests'
  - 変更内容をもとにunit test生成を依頼する

## 設定

リポジトリ直下の .coderabbit.yaml で、現行のディレクトリ構成に合わせてレビュー観点を管理します。

- apps/desktop/**: Electronのmain / preload / renderer、オーバーレイ、UIセキュリティ
- apps/server/**: Zoom RTMS、字幕処理、WebSocket、AI処理、非同期処理
- packages/contracts/**: ElectronとNode.js間の型・スキーマ・通信契約
- supabase/**: migration、RLS、保存、削除、個人情報
- docs/**: README・ADR・技術構成の整合性
- .github/workflows/**: CIの権限、secret、再現性
- **/*.test.ts / **/*.test.tsx / **/*.spec.ts / **/*.spec.tsx: TypeScriptのテスト方針

旧Go構成の internal/**、cmd/**、*_test.go を中心にした設定は、Electron + Node.js構成への移行に合わせて廃止しました。今後Goのコードを再導入する場合は、別のADRとレビュー方針を追加します。

## 注意

CodeRabbitのレビューを待つことで開発が止まる場合は、人間のレビューとGitHub Actionsの結果を優先します。AIレビューは補助であり、チームの判断を置き換えません。
