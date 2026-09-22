SHELL := /bin/bash

GO_ENTRYPOINT ?= ./cmd/api

.PHONY: help setup run fmt test lint build check require-go

help:
	@echo "利用できるコマンド:"
	@echo "  make setup  - Go依存関係を取得"
	@echo "  make run    - APIを起動"
	@echo "  make fmt    - Goコードをgofmt"
	@echo "  make test   - Goのテストを実行"
	@echo "  make lint   - gofmtとgo vetを確認"
	@echo "  make build  - Goコードをビルド"
	@echo "  make check  - lint / test / buildをまとめて実行"

setup:
	@if [[ -f go.mod ]]; then 		go mod download; 	else 		echo "go.modがまだありません。Goプロジェクト初期化後に実行してください。"; 	fi

run: require-go
	@if [[ -d "$(GO_ENTRYPOINT)" || -f "$(GO_ENTRYPOINT)" ]]; then 		go run "$(GO_ENTRYPOINT)"; 	else 		echo "$(GO_ENTRYPOINT) がまだありません。Go API作成後に実行してください。"; 		exit 1; 	fi

fmt: require-go
	@gofmt -w $$(find . -type f -name '*.go' -not -path './vendor/*')

test: require-go
	go test ./...

lint: require-go
	@files="$$(find . -type f -name '*.go' -not -path './vendor/*' -print)"; 	if [[ -n "$$files" ]]; then 		unformatted="$$(gofmt -l $$files)"; 		if [[ -n "$$unformatted" ]]; then 			echo "次のファイルがgofmtされていません:"; 			echo "$$unformatted"; 			exit 1; 		fi; 	fi
	go vet ./...

build: require-go
	go build ./...

check: lint test build

require-go:
	@if [[ ! -f go.mod ]]; then 		echo "go.modがまだありません。先にGoプロジェクトを初期化してください。"; 		exit 1; 	fi
