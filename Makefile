.PHONY: up up-d build down down-v restart logs ps backend-sh frontend-sh db-sh clean env

COMPOSE := docker compose

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
