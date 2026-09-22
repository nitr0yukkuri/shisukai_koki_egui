# Contributing

4人で安全に並行開発するための最低限のルールです。
ルール自体が開発を遅くする場合は、チームで変更してください。

## 基本フロー

1. 取り組む Issue を選ぶ
2. 1つの変更目的を表す branch を切る
3. 必要なら複数 Issue を横断して実装する
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

branch は Issue の個数ではなく、変更目的で区切ります。
複数 Issue をまとめても、1つの目的として説明できるなら同じ branch で扱って構いません。

## Issue

原則として「1 Issue = 1つの完了条件を持つ責務」にします。

Issue は作業や判断を分解し、担当・進捗・依存関係を追いやすくするための単位です。
Issue が大きくなった場合は、着手前に分割してください。

## Pull Request

PR と Issue は 1:1 である必要はありません。

1つの変更を成立させるために API、domain、Worker、infra、test、docs など複数領域を横断することは許容します。
複数の単一責任 Issue が、同じ目的・同じ変更ストーリーに属する場合は、1つの PR でまとめて完了させても構いません。

例:

```text
Issue #21 APIからTaskをpublishする
Issue #22 WorkerがTaskをconsumeする
Issue #23 retry / 冪等性を実装する

↓ これらを「非同期処理を一通り成立させる」という1つのPRで横断するのはOK
```

PR を分割するかどうかは「Issue の個数」ではなく、次の観点で判断します。

- 1つの目的として説明できるか
- 差分全体をまとめてレビューする意味があるか
- test や動作確認を一続きで行えるか
- 一緒に merge / rollback したい変更か
- 無関係な変更が混ざっていないか

PR の小ささ自体を目的にはしません。
レビューしづらい、CI が重すぎる、競合しやすい、途中成果を先に merge した方が安全、といった具体的な理由がある場合に分割します。

PR には最低限、次を書きます。

- なぜ変更したか
- 関連する Issue
- 何を変更したか
- どう確認したか
- 設計判断への影響

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
