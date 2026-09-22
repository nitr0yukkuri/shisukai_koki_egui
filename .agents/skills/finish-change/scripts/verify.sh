#!/usr/bin/env bash
set -euo pipefail

echo "== 差分の基本チェック =="
git diff --check

if [[ -f go.mod ]]; then
  echo
  echo "== Goプロジェクトの品質チェック =="
  make check
else
  echo
  echo "go.modがまだないため、Goのlint / test / buildはスキップします。"
fi

echo
echo "検証が完了しました。"
