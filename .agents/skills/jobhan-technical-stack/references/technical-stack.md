# じょぶはん 技術構成メモ

## Canva図に描かれている構成

ユーザーが共有した[Canva資料](https://www.canva.com/design/DAHYbhRVVvc/Z1-PoHX6QL5Mgc7bZ1RmEg/edit)の技術構成図には、次のロゴ・ラベルがある。

- フロントエンド: React、TypeScript、Electron
- バックエンド: Node.js、TypeScript
- DB: SQLite
- API: OpenAI

これは構成図の記録であり、全コンポーネントの採用決定や実装完了を示すものではない。

## 現行READMEとの照合

現行READMEの暫定構成はWindows向けElectron + React + TypeScriptアプリと端末内SQLite。初期のローカル練習にはバックエンド、ログイン、クラウドDBを設けない。外部AI APIを採用する場合は、APIキーをアプリに含めないためNode.js + TypeScript + Express APIを後から検討する。OpenAI APIの導入は別途判断する。

READMEのStatusでは、録音、文字起こし、SQLiteへのログ保存、AIによる振り返りは未実装とされている。Canva図だけを根拠に実装済みとは記述しない。

## 実装タスクでの使い方

実装時は最新README、Issue、package.json、実際のソースを確認し、現行構成と将来案を区別する。外部APIを追加するときは必要性と送信内容を確認し、APIキーをRendererや配布物へ含めない。
