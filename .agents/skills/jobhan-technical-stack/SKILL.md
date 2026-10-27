---
name: jobhan-technical-stack
description: じょぶはんの技術構成を調査・実装・レビューするときに使う。
---

# じょぶはん 技術構成

[技術構成メモ](references/technical-stack.md)に、Canva図と現行READMEの技術スタックの差をまとめている。

## 進め方

- 着手時にREADME、package.json、実際のソース、関連Issueを確認し、図の候補と採用済み構成を区別する。
- 初期のローカル構成はElectron + React + TypeScriptと端末内SQLite。ローカル練習にバックエンドやクラウドDBを追加しない。
- 外部AI APIは別途採用が決まった場合に限り、Node.js + TypeScript + Express等のサーバー経由で接続する。APIキーをRendererや配布物へ含めない。
- Canva図にあるOpenAI APIやバックエンドを、実装済み・決定済みとは扱わない。技術変更は関連IssueとREADMEに反映する。
