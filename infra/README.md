# インフラ（GCP + Vercel、Terraform 管理）

```
ブラウザ ──HTTPS──> Vercel（Next.js 静的書き出し, 無料 Hobby）
   │
   └─fetch + Firebase IDトークン──> Cloud Run（Go API, min 0 インスタンス）
                                      ├─ Cloud SQL Auth Proxy ──> Cloud SQL PostgreSQL（db-f1-micro）
                                      └─ Secret Manager（DB接続文字列, AIキー）
GitHub Actions ──WIF（キーなし）──> Artifact Registry に push → Cloud Run に新リビジョン
```

- ロードバランサーは使わない。Cloud Run の `*.run.app` URL（HTTPS 付き）をそのまま API に使う
- 固定費は Cloud SQL のみ（月 ¥1,300〜1,600 程度）。Cloud Run / Artifact Registry / Secret Manager は無料枠内
- GCP プロジェクトは Firebase プロジェクト `nutrition-a20a8` と同一

## ファイル

| ファイル | 内容 |
| --- | --- |
| `bootstrap/` | state 用 GCS バケットを作る（最初に1回だけ） |
| `apis.tf` | 必要な API の有効化 |
| `registry.tf` | Artifact Registry（古いイメージは自動削除） |
| `sql.tf` | Cloud SQL インスタンス・DB・ユーザー（パスワードは自動生成） |
| `secrets.tf` | Secret Manager（`DATABASE_URL`, `AI_API_KEY`） |
| `run.tf` | Cloud Run サービスと実行用サービスアカウント |
| `deploy_iam.tf` | GitHub Actions 用サービスアカウントと Workload Identity Federation |
| `vercel.tf` | Vercel プロジェクトと環境変数 |

## 初回セットアップ

### 0. ツール

```powershell
winget install Hashicorp.Terraform
winget install Google.CloudSDK
```

### 1. GCP にログイン・課金を有効化

```powershell
gcloud auth login
gcloud auth application-default login
gcloud config set project nutrition-a20a8
```

Google Cloud コンソールでプロジェクト `nutrition-a20a8` に **請求先アカウントを紐づける**（Cloud SQL / Cloud Run に必須）。あわせて **予算アラート**（例: ¥3,000）を設定しておく。

### 2. state バケット（1回だけ）

```powershell
cd infra/bootstrap
terraform init
terraform apply
cd ../..
```

### 3. Vercel の準備

1. https://vercel.com でアカウント作成（Hobby）
2. **GitHub 連携**: Vercel の Add New → Project で GitHub の Vercel アプリを `tasa10/nutrition` にインストール（プロジェクト作成は Terraform がやるので、インストールだけで戻ってよい）
3. **API トークン**: Settings → Tokens → Create。スコープは Full Account でよい

```powershell
$env:VERCEL_API_TOKEN = "<token>"
```

### 4. 変数を用意

```powershell
Copy-Item infra/terraform.tfvars.example infra/terraform.tfvars
```

`infra/terraform.tfvars` を編集して AI キーと Firebase の Web 設定（`.env` と同じ値）を入れる。このファイルは git 管理外。

### 5. 適用

```powershell
make tf-init
make tf-plan
make tf-apply
```

初回は Cloud SQL の作成に 5〜10 分かかる。完了すると `api_url`、`frontend_url`、`github_secret_*` が出力される。

### 6. GitHub Actions のシークレット

リポジトリの Settings → Secrets and variables → Actions に、`terraform output` の値を登録する。

| Secret 名 | 値 |
| --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `github_secret_GCP_WORKLOAD_IDENTITY_PROVIDER` の出力 |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | `github_secret_GCP_DEPLOY_SERVICE_ACCOUNT` の出力 |

### 7. 最初のデプロイ

- **API**: Actions タブから **Deploy API** を手動実行（または `backend/` を変更して `main` に push）。Terraform が置いた仮のコンテナが本物のイメージに置き換わる
- **フロント**: Vercel が `main` を自動ビルドする。反映されなければ Vercel ダッシュボードで Redeploy

### 8. Firebase の承認済みドメイン

Firebase コンソール → Authentication → Settings → **承認済みドメイン** に `frontend_url` のホスト（例: `nutrition.vercel.app`）を追加する。これが無いと Google ログインが `auth/unauthorized-domain` で失敗する。

## 日常の運用

- **API の変更**: `backend/` を `main` に push すれば自動デプロイ。Terraform はイメージを管理しない（`ignore_changes`）
- **フロントの変更**: `main` に push すれば Vercel が自動デプロイ
- **環境変数・スケール・DB サイズなどの変更**: `infra/` を編集して `make tf-plan` → `make tf-apply`
- **AI キーの更新**: `terraform.tfvars` を変えて apply。Secret の新しい版が作られ、Cloud Run はその版番号を参照しているので、同じ apply で新しいリビジョンが出て即反映される（Secret はコンテナ起動時にしか読まないため、`latest` 参照だと古いインスタンスが残る）

## 注意

- Cloud SQL は `deletion_protection = true`。壊すときは `sql.tf` で false にして apply してから `terraform destroy`
- Terraform state には DB パスワードと AI キーが含まれる。バケットは非公開だが、アクセス権を広げないこと
- CORS は本番の Vercel URL のみ許可。Vercel のプレビュー URL からは API が 403 になる（プレビューで API まで試すなら `CORS_ORIGIN` を広げる必要がある）
- 無料枠を超える主な要因は Cloud SQL のストレージ増加（写真は DB に入る）。使用量は Cloud SQL のコンソールで確認できる
