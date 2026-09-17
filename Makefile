.PHONY: up up-d build down down-v restart logs ps backend-sh frontend-sh db-sh clean env \
	lint lint-back lint-front fmt fmt-back fmt-front

COMPOSE := docker compose

# Lint / format run inside official images so no local Go or Node is needed.
GO_IMAGE       := golang:1.27-alpine
GOLANGCI_IMAGE := golangci/golangci-lint:latest
NODE_IMAGE     := node:24-alpine
GO_RUN   := docker run --rm -v "$(CURDIR)/backend:/app" -v nutrition_gomodcache:/go/pkg/mod -w /app
NODE_RUN := docker run --rm -v "$(CURDIR)/frontend:/app" -w /app $(NODE_IMAGE)

lint: lint-back lint-front ## バックエンド・フロントエンドの lint をまとめて実行

lint-back: ## go vet + golangci-lint
	$(GO_RUN) $(GO_IMAGE) go vet ./...
	$(GO_RUN) $(GOLANGCI_IMAGE) golangci-lint run ./...

lint-front: ## eslint + prettier --check
	$(NODE_RUN) npm run lint
	$(NODE_RUN) npm run format:check

fmt: fmt-back fmt-front ## バックエンド・フロントエンドのフォーマットをまとめて実行

fmt-back: ## gofmt / goimports で整形
	$(GO_RUN) $(GOLANGCI_IMAGE) golangci-lint fmt ./...

fmt-front: ## prettier --write
	$(NODE_RUN) npm run format

env: ## .env が無ければ .env.example からコピー
	@test -f .env || cp .env.example .env

up: env ## フォアグラウンドでビルド＆起動
	$(COMPOSE) up --build

up-d: env ## バックグラウンドでビルド＆起動
	$(COMPOSE) up --build -d

build: ## イメージのみビルド
	$(COMPOSE) build

down: ## コンテナ停止・削除（ボリュームは残す）
	$(COMPOSE) down

down-v: ## コンテナ・ボリュームをまとめて削除
	$(COMPOSE) down -v

restart: down up-d ## 再起動

logs: ## 全サービスのログを追従
	$(COMPOSE) logs -f

ps: ## サービスの状態表示
	$(COMPOSE) ps

backend-sh: ## backendコンテナにシェルで入る
	$(COMPOSE) exec backend sh

frontend-sh: ## frontendコンテナにシェルで入る
	$(COMPOSE) exec frontend sh

db-sh: ## dbコンテナにpsqlで入る
	$(COMPOSE) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

clean: down-v ## ボリューム削除＋ローカルビルドイメージも削除
	$(COMPOSE) down --rmi local
