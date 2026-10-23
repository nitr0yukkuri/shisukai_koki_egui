.PHONY: help setup run start dev test lint typecheck build check

help:
	@echo "npm scripts: setup, dev, start, test, lint, typecheck, build, check"

setup:
	npm ci

run:
	npm run dev

start:
	npm run start

dev:
	npm run dev

test:
	npm test

lint:
	npm run lint

typecheck:
	npm run typecheck

build:
	npm run build

check:
	npm run check
