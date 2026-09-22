# Architecture Decision Records

重要な設計判断を ADR として保存します。

## なぜ残すのか

コードだけを見ると「何を選んだか」は分かっても、「なぜそうしたか」は消えやすいためです。

このプロジェクトでは、授業終了時に技術選定の理由や失敗した判断まで振り返れる状態を目指します。

## ADR にする判断

すべての実装判断を ADR にする必要はありません。次のような、後から理由を知りたくなりそうな判断を対象にします。

- アーキテクチャ構成
- 言語・主要ライブラリ
- DB / Queue の選定
- Kubernetes を採用する理由
- CI/CD の方針
- 大きな責務境界の変更
- 以前の判断を覆す変更

## ファイル名

```text
NNNN-short-title.md
```

例:

```text
0001-use-go-for-backend.md
0002-use-modular-monolith.md
```

## Status

- Proposed: 提案中
- Accepted: 採用
- Superseded: 新しい ADR に置き換えられた
- Rejected: 不採用

## 更新ルール

Accepted な ADR の結論を後から書き換えて歴史を消さないでください。
判断を変える場合は新しい ADR を追加し、古い ADR を Superseded にします。

テンプレートは [0000-template.md](./0000-template.md) をコピーして使います。
