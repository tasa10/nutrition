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

## Lint / フォーマット

ローカルに Go / Node は不要。すべて公式 Docker イメージの中で実行する。

```bash
make lint        # 両方（go vet + golangci-lint / eslint + prettier --check）
make fmt         # 両方（gofmt・goimports / prettier --write）
make lint-back   # バックエンドのみ
make lint-front  # フロントエンドのみ
```

- バックエンド: `backend/.golangci.yml`（golangci-lint v2、標準セット + misspell / unconvert / unparam / gocritic / revive）
- フロントエンド: `frontend/eslint.config.mjs`（eslint-config-next + eslint-config-prettier）、`frontend/.prettierrc`（`prettier-plugin-tailwindcss` でクラス順も整列）

- フロントエンド: http://localhost:3000
- バックエンドAPI: http://localhost:8080/api/health
- PostgreSQL: localhost:5432

画面を開くと、フロントエンドがバックエンドの `/api/health` を呼び出し、API・DBそれぞれの疎通状況を表示する。

## 仕様の元

Claude Design で作成したモック `docs/mock/calorie-app-mock.dc.html`（元ファイル名: `カロリー記録アプリ モック.dc.html`）を仕様とする。「しゃべるだけでカロリー記録」— 音声/テキストで食べたものを伝えると、AIが料理ごとにカロリー・PFC・塩分・糖質を推定して記録する。

## 画面（実装済み = コア導線）

| パス | 画面 | 状態 |
| --- | --- | --- |
| `/onboarding/` | 体重・目標体重・活動量 → 目標カロリー | 実装済み |
| `/` | ホーム（残りkcalリング / PFC / 塩分・糖質 / 今日の4食） | 実装済み |
| `/record/` | 区分えらび（朝食・昼食・夕食・間食） | 実装済み |
| `/record/input/?slot=` | 音声入力（Web Speech API、非対応時はテキスト） | 実装済み |
| `/record/review/` | AI解析の確認（品目ごとの確度・削除 → 保存） | 実装済み |
| `/meals/edit/?slot=` | 記録の編集・削除 | 実装済み |
| — | チャット相談 / 記録簿（週次） / 食品検索 / バッジ / 写真 | 未実装 |
| `/foods/`, `/foods/new/` | 食品マスタ（旧スケルトン、当面温存） | 実装済み |

## API

| メソッド | パス | 内容 |
| --- | --- | --- |
| GET | `/api/health` | 疎通確認（DB不通時は503） |
| GET / PUT | `/api/profile` | プロフィール（`weight_now` / `weight_goal` / `activity_level` 0-2）と `target_kcal` |
| POST | `/api/meals/analyze` | `{text}` → `{items[], advice}`（AIが料理ごとに栄養推定） |
| GET | `/api/days/{YYYY-MM-DD}` | その日の `target_kcal` / `totals` / `meals[]` |
| PUT | `/api/meals/{date}/{slot}` | 食事を保存（同じ日・区分は置き換え）。`slot` は `breakfast|lunch|dinner|snack` |
| DELETE | `/api/meals/{date}/{slot}` | 食事を削除 |
| GET / POST | `/api/foods` | 食品マスタ（旧） |

起動時に GORM の AutoMigrate でテーブル（`profiles` / `meals` / `meal_items` / `foods`）を作成する（`backend/internal/db/migrate.go`）。

## AI プロバイダー

`backend/internal/ai/` に `Analyzer` インターフェースがあり、環境変数で切り替える。

| 変数 | 値 |
| --- | --- |
| `AI_PROVIDER` | `claude` / `stub`。空なら `AI_API_KEY` があれば `claude`、無ければ `stub` |
| `AI_API_KEY` | プロバイダーのAPIキー（Goバックエンドのみが保持。ブラウザには渡さない） |
| `AI_MODEL` | 既定 `claude-opus-5` |

`stub` は固定値を返すのでキー無しでも画面の動作確認ができる。別プロバイダー（Gemini 等）を足す場合は `Analyzer` を実装して `cmd/api/main.go` の `newAnalyzer` に分岐を追加する。

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
