# Contributing

4人で安全に並行開発するための最低限のルールです。
ルール自体が開発を遅くする場合は、チームで変更してください。

## 基本フロー

1. Issue を1つ選ぶ
2. Issue の責務を超えない branch を切る
3. 実装する
4. test / lint / build を実行する
5. Pull Request を作る
6. 人間のレビューと CI を確認する
7. merge する

## Branch

例:

```text
feat/add-worker
fix/retry-task
docs/add-adr
chore/configure-ci
```

1 branch に複数の独立した目的を詰め込まないでください。

## Issue

原則として「1 Issue = 1つの完了条件を持つ責務」にします。

Issue が大きくなった場合は、着手前に分割してください。

## Pull Request

PR には最低限、次を書きます。

- なぜ変更したか
- 何を変更したか
- どう確認したか
- 設計判断への影響

PR を巨大化させず、レビューできるサイズを優先します。

## Review

CodeRabbit は補助レビュアーです。

CodeRabbit が担当する主な観点:

- 依存方向
- ADR との矛盾
- test 不足
- error handling
- retry / idempotency
- Kubernetes / CI/CD の危険な変更

ただし、CodeRabbit のコメントをすべて解消することを merge 条件にはしません。
最終判断はチームが行います。

## CI

将来的に GitHub Actions の次の項目を客観的な merge gate にします。

- test
- lint / format
- build
- 必要に応じて integration test

AI の判断より、再現可能な自動テスト結果を優先します。

## ADR

大きな設計判断を変更する PR は、必要に応じて ADR を追加してください。

既存の Accepted ADR を覆す場合は、元の ADR を書き換えるのではなく、新しい ADR で置き換えます。

## Pair / Mob

担当外の領域でも、詰まったら早めに一緒に見ます。
「その人しか触れない領域」を作らないことを優先します。

## Merge

現時点では squash merge を基本とします。
履歴上、1 PR = 1つの意味のある変更として追える状態を目指します。
