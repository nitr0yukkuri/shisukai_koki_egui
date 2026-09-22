# shisukai_koki_egui

授業の4人チーム開発用リポジトリです。

現在はプロダクト題材とMVPを決める前の、開発基盤・設計ルールを整備している段階です。

## Documents

- [用語集](./docs/glossary.md)
- [ADR](./docs/adr/README.md)
- [CodeRabbit運用方針](./docs/coderabbit.md)
- [Contributing](./CONTRIBUTING.md)

## Development policy

- 1 Issue = 1つの責務を基本にする
- 大きな設計判断は ADR に残す
- CodeRabbit は補助レビュアーとして使う
- test / lint / build など再現可能なCIを客観的な品質ゲートにする
- 4人チームなので、過度な分散システム化より責務境界の明確さを優先する

## Status

プロダクト要件、Go構成、DB、Queue、Kubernetes構成などは未決定です。
決定前に実装を固定せず、Issue / ADR で合意してから進めます。
