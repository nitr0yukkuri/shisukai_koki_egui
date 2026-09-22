# CodeRabbit 運用方針

CodeRabbit は、このリポジトリでは設計・品質レビューを補助するために使います。

## 役割

CodeRabbit に期待すること:

- モジュール境界・依存方向の違反の指摘
- ADR と実装の矛盾の指摘
- テスト不足やエラー処理不足の指摘
- 非同期処理の retry、冪等性、重複配送、timeout の観点チェック
- Kubernetes、CI/CD、secret 周りのレビュー
- 必要に応じた unit test の生成補助

CodeRabbit に任せないこと:

- merge 可否の最終判断
- テストの実行結果そのもの
- lint や build の成否判定
- アーキテクチャ判断の最終決定

客観的な merge gate は GitHub Actions の test / lint / build などに置きます。
CodeRabbit のコメントが残っていることだけを理由に merge を止める運用にはしません。

## PR で使うコマンド

CodeRabbit が GitHub App としてこのリポジトリにインストールされていることが前提です。

- @coderabbitai review
  - 差分レビューを依頼する
- @coderabbitai full review
  - PR 全体のレビューを依頼する
- @coderabbitai generate unit tests
  - 変更内容をもとに unit test 生成を依頼する

## 設定

リポジトリ直下の .coderabbit.yaml でレビュー観点を管理します。

現時点では、Go、モジュール境界、Worker / Queue、Kubernetes、GitHub Actions、ADR、テストを重点的に見ます。
ディレクトリ構成が固まったら path instruction は実際の構成に合わせて更新します。

## 注意

CodeRabbit のレビューを待つことで開発が止まる場合は、人間のレビューと GitHub Actions の結果を優先します。
AI レビューは補助であり、チームの判断を置き換えるものではありません。
