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

### CI（GitHub Actions）

`.github/workflows/lint.yml` が `main` への push と全 Pull Request で lint を実行する。

| ジョブ | 内容 |
| --- | --- |
| Backend | `go vet` → golangci-lint（gofmt / goimports のチェックを含む） |
| Frontend | `npm ci` → `next typegen` + `tsc --noEmit` → ESLint → Prettier チェック |

golangci-lint のバージョンは CI と `Makefile`（`GOLANGCI_IMAGE`）で `v2.13.2` に揃えている。上げるときは両方を変更する。フロントの型チェックはローカルの `make lint-front` には含まれないので、手元で確認するなら `npx next typegen && npx tsc --noEmit` を実行する。

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
| `/record/review/` | AI解析の確認（品目ごとの確度・削除・写真添付 → 保存） | 実装済み |
| `/record/search/?slot=` | 食品検索（AIが候補を生成）/ よく食べるもの → 区分に追加 | 実装済み |
| `/meals/edit/?slot=&date=` | 記録の編集・削除（`date` 省略時は今日。過去の日は記録簿から開く） | 実装済み |
| `/chat/` | AIコーチとのチャット相談。食べたものを報告すると記録カードを提案 | 実装済み |
| `/history/?date=` | 記録簿（7日単位で過去へ移動できるグラフ / 棒をタップした日の内訳 / 実績バッジ） | 実装済み |

ヘッダーの Lv / XP / デイリークエスト / 連続日数は `GET /api/stats` から表示する。XP は記録から毎回計算する（音声・テキスト・チャットの記録 1 件 = 20XP、食品検索からの追加 = 10XP、100XP ごとに Lv+1）。チャット履歴はユーザーごとに `chat_messages` テーブルへ保存する（1ユーザー1会話。AI 呼び出しに失敗したときはその発言を保存しない）。チャットと食品検索からの記録は、その区分の既存の記録に品目を追加する（音声入力の確認画面からの保存は置き換え）。

## API

| メソッド | パス | 内容 |
| --- | --- | --- |
| GET | `/api/health` | 疎通確認（DB不通時は503）。認証不要 |
| GET | `/api/me` | 現在ログイン中のユーザー |
| GET / PUT | `/api/profile` | プロフィール（`weight_now` / `weight_goal` / `activity_level` 0-2）と `target_kcal` |
| POST | `/api/meals/analyze` | `{text}` → `{items[], advice}`（AIが料理ごとに栄養推定） |
| GET | `/api/days/{YYYY-MM-DD}` | その日の `target_kcal` / `totals` / `meals[]` |
| PUT | `/api/meals/{date}/{slot}` | 食事を保存（同じ日・区分は置き換え）。`slot` は `breakfast|lunch|dinner|snack`。`photo` は省略で現状維持、`""` で削除、data URL（JPEG/PNG/WebP, 700KB以下）で設定 |
| DELETE | `/api/meals/{date}/{slot}` | 食事を削除 |
| GET | `/api/chat` | 会話履歴（古い順、最新200件） |
| POST | `/api/chat` | `{date, text}` → `{reply, record, messages[]}`。直近30件を文脈として AI に渡し、発言と返答を保存。`record` は記録の提案（無ければ `null`） |
| POST | `/api/chat/notes` | `{text}` → コーチ側の定型文（記録完了など）を保存 |
| DELETE | `/api/chat` | 会話をすべて削除 |
| GET | `/api/stats?date=` | `xp` / `level` / `xp_in_level` / `streak` / `today_meals` / `badges[]` |
| GET | `/api/history?to=&days=` | 直近 N 日（1〜31、既定7）の日別 kcal と `target_kcal` |
| POST | `/api/foods/search` | `{query}` → `{items[]}`（AIが候補を4件生成） |
| GET | `/api/foods/frequent` | よく記録している品目（最大6件） |

起動時に GORM の AutoMigrate でテーブル（`users` / `profiles` / `meals` / `meal_items` / `chat_messages`）を作成する（`backend/internal/db/migrate.go`）。食品マスタは持たず、カロリー・栄養素は AI の推定値を `meal_items` に直接保存する（初期の `foods` テーブルは起動時に削除する）。

## 認証

`users` テーブル（`id` / `firebase_uid` / `display_name`）を持ち、`profiles` / `meals` / `chat_messages` は `user_id` でユーザーごとに分かれている。
`/api/health` 以外の API は `auth.Middleware` を通り、ハンドラは `auth.UserID(c)` で現在のユーザーを取得する。

| 変数 | 値 |
| --- | --- |
| `AUTH_MODE` | `dev`（既定）: ログイン画面なしで全リクエストを `DEV_USER_ID` のユーザーとして扱う。起動時に ID 1 の開発ユーザー（`firebase_uid = dev-user-1`）を自動作成。`firebase`: Firebase Auth の ID トークンを検証 |
| `DEV_USER_ID` | 既定 `1` |
| `FIREBASE_PROJECT_ID` | `firebase` モードで必須。トークン検証は Google の公開鍵で行うので、サービスアカウントの鍵は不要 |
| `NEXT_PUBLIC_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_APP_ID` | Firebase コンソールの Web アプリ設定の値。ビルド時にフロントへ埋め込まれ、4つそろうとログイン画面が有効になる（空なら開発モード） |

### Firebase モードでの流れ

1. フロント: `AuthGate`（`src/components/AuthGate.tsx`）が全ページを包み、未ログインなら `/login/` へ。`/login/` では Google ログインと メールアドレス+パスワード（新規登録・パスワード再設定つき）が使える
2. フロント: `src/lib/api.ts` が毎回 Firebase の ID トークンを `Authorization: Bearer` で送る。401 が返ればログイン画面へ戻す
3. バックエンド: `internal/auth/firebase.go` がトークンを検証し、`firebase_uid` でユーザーを検索。無ければその場で作成（表示名はトークンの `name` → `email` の順）
4. ログアウトは記録簿画面の下にある「アカウント」欄から

開発ユーザー（ID 1）のデータは Firebase のアカウントには引き継がない。メールアドレス登録のメール確認は強制していない。

### Firebase コンソールでの準備

1. プロジェクトを作成 → **Authentication → Sign-in method** で **Google** と **メール / パスワード** を有効化
2. **プロジェクトの設定 → マイアプリ → ウェブアプリを追加** で `apiKey` / `authDomain` / `projectId` / `appId` を取得し、`.env` の `NEXT_PUBLIC_FIREBASE_*` と `FIREBASE_PROJECT_ID` に入れる
3. `AUTH_MODE=firebase` にして `make up-d`（フロントはビルドし直しが必要）。**Authentication → Settings → 承認済みドメイン** に `localhost` が入っていることを確認（既定で入っている）

## AI プロバイダー

`backend/internal/ai/` に `Service` インターフェース（`AnalyzeMeal` / `Chat` / `SearchFoods`）があり、環境変数で切り替える。プロンプトと JSON スキーマは `prompts.go` に共通化しており、Claude（Structured Outputs）・Gemini（`responseJsonSchema`）ともに同じスキーマで応答を強制している。

| 変数 | 値 |
| --- | --- |
| `AI_PROVIDER` | `claude` / `gemini` / `stub`。空ならキーの先頭から自動判定（`sk-ant-` → claude、`AIza` → gemini）、キーが無ければ `stub` |
| `AI_API_KEY` | プロバイダーのAPIキー（Goバックエンドのみが保持。ブラウザには渡さない） |
| `AI_MODEL` | 空ならプロバイダーごとの既定（claude: `claude-opus-5` / gemini: `gemini-3.6-flash`） |

### Gemini（無料枠）で使う

Google AI Studio で発行したキーを `.env` に入れて backend を再起動する（`make restart`）。ログに `using Gemini AI` と出れば有効。

```
AI_PROVIDER=gemini
AI_API_KEY=...
```

- キーは形式が変わることがある（`AIza...` 以外に `AQ.` で始まるものもある）ので、自動判定に頼らず `AI_PROVIDER=gemini` を明示する
- 旧モデル（`gemini-2.5-flash` など）は新規ユーザーには提供されず 404 になる。混雑時はモデルが 503（high demand）を返すことがあり、その場合は時間をおくか `AI_MODEL` を別の Flash モデルに変える

- 無料枠は1分あたり10回程度の上限があり、超えると API は **429**（「AIの利用上限に達しました…」）を返す。しばらく待てば復帰する
- **無料枠の入出力は Google のサービス改善に使われる場合がある**。体重や食事の記録を送るので、本番公開前に有料枠への切り替えやプロバイダーを再検討する
- 使えるモデルと上限は変わるので、AI Studio のレート制限画面で確認し、必要なら `AI_MODEL` で指定する

`stub` は固定値を返すのでキー無しでも画面の動作確認ができる。別プロバイダーを足す場合は `Service` を実装して `cmd/api/main.go` の `newAIService` に分岐を追加する。AI 側が 429 を返したときは `ai.ErrRateLimited` を包んで返すと、ハンドラが 429 に変換する。チャット履歴の整形（先頭の assistant 発言を除く・同じ話者の連続発言をまとめる）は `ai.NormalizeHistory` を共通で使える。

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
