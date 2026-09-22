# Contributing

4人で開発を進めるための最低限のルールです。
ルールを守ること自体が作業になり始めたら、チームで変えてください。

## 基本フロー

1. 取り組む Issue を選ぶ
2. branch を切る
3. 実装する
4. test / lint / build を確認する
5. Pull Request を作る
6. 必要なレビューをして merge する

## Issue

原則として「1 Issue = 1つの責務」にします。

Issue は作業や判断を分解し、担当・進捗・依存関係を追いやすくするための単位です。
大きすぎる場合は着手前に分割します。

## Branch

branch 名は変更内容がだいたい分かればOKです。

例:

```text
feat/add-worker
fix/retry-task
docs/add-adr
chore/configure-ci
```

Issue と branch を1:1にする必要はありません。

## Pull Request

PR は変更を共有・レビューするための単位です。

サイズ、Issue数、変更レイヤーについて厳密なルールは設けません。
API、domain、Worker、infra、test、docs などを横断しても問題ありません。
レビューできる範囲なら、関連する変更をある程度まとめてOKです。

最低限、次が分かれば十分です。

- 何をやったか
- 必要なら関連 Issue
- 動作確認できているか

PRを細かく分けること自体を目的にはしません。
レビューしづらい、競合しやすい、別々にrollbackしたい、途中成果を先にmergeしたい、といった具体的な理由があるときに分割します。

## Review

CodeRabbit は補助レビュアーです。

主に次の観点を見てもらいます。

- 依存方向
- ADR との矛盾
- test 不足
- error handling
- retry / idempotency
- Kubernetes / CI/CD の危険な変更

CodeRabbit のコメントをすべて直すことは merge 条件にしません。
最終判断はチームが行います。

## CI

GitHub Actions の test / lint / build など、再現可能なチェックを品質ゲートにします。

AI の判断より、自動テスト結果を優先します。

## ADR

大きな設計判断を変更するときは、必要に応じて ADR を追加します。

既存の Accepted ADR を覆す場合は、元の ADR を書き換えず、新しい ADR で置き換えます。

## Pair / Mob

担当外の領域でも、詰まったら早めに一緒に見ます。
「その人しか触れない領域」を作らないことを優先します。

## Merge

現時点では squash merge を基本とします。
