# 栄養管理アプリ（雛形）

栄養管理・献立提案アプリの初期スケルトン。現時点では疎通確認用の1画面・1APIのみを実装している。

## 技術スタック

| レイヤ | 技術 |
| --- | --- |
| フロントエンド | Next.js 16 (App Router, CSR / `output: export` による静的書き出し) |
| バックエンド | Go 1.27 + Echo v5 |
| ORM | GORM |
| DB | PostgreSQL 18 |
| 実行環境 | Docker / Docker Compose |

## ディレクトリ構成

```
.
├── backend/          # Go API サーバー
│   ├── cmd/api/       # エントリポイント
│   └── internal/
│       ├── config/    # 環境変数の読み込み
│       ├── db/         # GORM 接続
│       └── handler/    # HTTPハンドラ
├── frontend/         # Next.js (CSR) アプリ
│   └── src/app/       # App Router
├── docker-compose.yml
└── .env.example
```

## 起動方法

`make` が使える環境（WSL / Git Bash + make導入済み など）:

```bash
make up       # フォアグラウンドでビルド＆起動
make up-d     # バックグラウンドで起動
make down     # 停止
make logs     # ログ追従
make ps       # 状態確認
```

`make` が無い場合（素のPowerShellなど）は直接 docker compose を使う:

```bash
cp .env.example .env
docker compose up --build
```

主なMakeターゲットは `Makefile` を参照（`backend-sh` / `frontend-sh` / `db-sh` でコンテナに入れる、`down-v` でボリュームごと削除、`clean` でローカルイメージも削除）。

- フロントエンド: http://localhost:3000
- バックエンドAPI: http://localhost:8080/api/health
- PostgreSQL: localhost:5432

画面を開くと、フロントエンドがバックエンドの `/api/health` を呼び出し、API・DBそれぞれの疎通状況を表示する。

## 現在実装済みの機能

- `GET /api/health`: APIとDBの疎通確認用エンドポイント（`{"status":"ok","db":"ok"}`）
- トップページ: 上記APIを呼び出して結果を表示するだけの画面

## 実装方針・決定事項メモ

- **フロントエンドはCSR構成**: Next.jsの `output: 'export'` で静的サイトとして書き出し、nginxで配信。APIは全てブラウザからGoバックエンドへ直接fetchする。
- **`NEXT_PUBLIC_API_URL`** はビルド時に埋め込まれる（静的書き出しのため実行時に変更不可）。デプロイ先ごとにビルドし直す必要がある。
- **DB**: 要件定義書3.1の通り、将来の栄養素可変構造（JSONB活用）を見据えてPostgreSQLを採用。
- ユーザー管理・食事記録・栄養計算・AI献立提案などの機能は未実装（要件定義書2章・4章を参照して今後追加）。

## 今後の検討事項（要件定義書 7章より抜粋）

- データモデル（User / Food / FoodNutrient / MealEntry / NutritionGoal / Suggestion）の実装
- 認証方式（セッション or JWT）とパスワードハッシュ方針の決定
- AIプロバイダー（Claude API / OpenAI API）の選定
- ホスティング先・想定規模・非機能要件の確定
