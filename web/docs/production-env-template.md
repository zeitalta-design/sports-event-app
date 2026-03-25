# 本番 `.env` 記入ガイド

> 本番サーバー上の `.env` を作成するための記入テンプレート。
> `.env.example` は項目一覧、このドキュメントは「何をどう埋めるか」のガイド。

---

## 役割と注意

- `.env` はサーバー上にのみ存在する（Git にコミットしない）
- `.env.example` をコピーして埋める: `cp .env.example .env`
- Docker 運用では `--env-file web/.env` で渡す
- 実値は docs に書かず、サーバー上の `.env` にのみ記入する

---

## いつ埋めるか — 3分類

| 分類 | タイミング | 対象 |
|------|----------|------|
| **A. デプロイ前に必須** | VPS セットアップ時 | APP_BASE_URL, SESSION_SECRET |
| **B. 機能利用時に必要** | 運用開始時 | SMTP, GA, OPS 系 |
| **C. データ投入時に必要** | source rollout 時 | ドメイン別 source URL / token |

**まず A だけ埋めればアプリは起動する。B, C は後から追加可。**

---

## A. デプロイ前に必須

### `APP_BASE_URL`

| 項目 | 内容 |
|------|------|
| 必須 | **はい** |
| 用途 | sitemap, OGP, メールリンクの base URL |
| 値の決め方 | 本番ドメインが確定したら設定 |
| 形式 | `https://your-domain.com`（末尾スラッシュなし） |
| 入手元 | ドメイン契約 + DNS 設定から |
| 未設定時 | instrumentation hook で起動失敗 |
| 注意 | `http://localhost` は本番モードで拒否される |

```
APP_BASE_URL=https://your-domain.com
```

### `SESSION_SECRET`

| 項目 | 内容 |
|------|------|
| 必須 | **はい** |
| 用途 | セッション cookie の HMAC 署名キー |
| 値の決め方 | サーバー上で生成 |
| 形式 | 32文字以上のランダム英数字 |
| 入手元 | 下記コマンドで生成 |
| 未設定時 | instrumentation hook で起動失敗 |
| 注意 | 変更するとログイン中の全セッションが無効化される |

```bash
# 生成コマンド
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```
SESSION_SECRET=<64文字の16進数文字列>
```

---

## B. 機能利用時に必要

### メール送信（パスワードリセット等）

| env | 必須 | 値の入手元 |
|-----|------|----------|
| `SMTP_HOST` | メール利用時 | メールプロバイダの設定画面 |
| `SMTP_PORT` | メール利用時 | 通常 587（TLS）or 465（SSL） |
| `SMTP_SECURE` | 任意 | `true`（465）or `false`（587） |
| `SMTP_USER` | メール利用時 | メールアカウント |
| `SMTP_PASS` | メール利用時 | メールアカウントのパスワード or アプリパスワード |
| `MAIL_FROM` | メール利用時 | 送信元アドレス（`noreply@your-domain.com`） |

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=<アプリパスワード>
MAIL_FROM=noreply@your-domain.com
```

**後回し可:** メール機能を使わない間は未設定で OK。パスワードリセット機能が動かないだけ。

### Google Analytics

| env | 必須 | 値の入手元 |
|-----|------|----------|
| `NEXT_PUBLIC_GA_ID` | 任意 | GA4 プロパティの測定 ID |

```
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

**後回し可:** アクセス解析が不要なら未設定で OK。

### Ops / 内部ジョブ

| env | 必須 | 値の入手元 |
|-----|------|----------|
| `OPS_CRON_SECRET` | 任意 | サーバー上で生成（SESSION_SECRET と同じ方法） |
| `OPS_ADMIN_EMAIL` | 任意 | 管理者メールアドレス |
| `OPS_SLACK_WEBHOOK_URL` | 任意 | Slack Incoming Webhook |
| `OPS_NOTIFY_CHANNELS` | 任意 | 通知先チャンネル |

**後回し可:** Slack 通知や cron 保護が不要なら未設定で OK。

### 外部サービス

| env | 必須 | 値の入手元 |
|-----|------|----------|
| `UNSPLASH_ACCESS_KEY` | 任意 | Unsplash Developer ダッシュボード |
| `LLM_ENABLED` | 任意 | `true` / `false` |
| `LLM_PROVIDER` | LLM 利用時 | プロバイダ名 |
| `LLM_BASE_URL` | LLM 利用時 | API URL |
| `LLM_API_KEY` | LLM 利用時 | API キー |
| `LLM_MODEL` | LLM 利用時 | モデル名 |
| `LLM_MAX_TOKENS` | LLM 利用時 | 数値 |
| `LLM_TIMEOUT_MS` | LLM 利用時 | ミリ秒 |

**後回し可:** 各機能を使うタイミングで設定すれば OK。

---

## C. データ投入時に必要

### Remote Import URL（`run-imports.js --all` 用）

| env | 用途 |
|-----|------|
| `YUTAI_IMPORT_URL` | 株主優待 remote JSON URL |
| `HOJOKIN_IMPORT_URL` | 補助金 remote JSON URL |
| `NYUSATSU_IMPORT_URL` | 入札 remote JSON URL |
| `MINPAKU_IMPORT_URL` | 民泊 remote JSON URL |

### Source Adapter URL（`--source primary` 用）

| env | 用途 |
|-----|------|
| `YUTAI_SOURCE_PRIMARY_URL` | 株主優待データソース |
| `HOJOKIN_SOURCE_PRIMARY_URL` | 補助金データソース |
| `NYUSATSU_SOURCE_PRIMARY_URL` | 入札データソース |
| `MINPAKU_SOURCE_PRIMARY_URL` | 民泊データソース |

### Source Token（認証 API のみ）

| env | 用途 |
|-----|------|
| `YUTAI_SOURCE_PRIMARY_TOKEN` | 株主優待 Bearer トークン |
| `HOJOKIN_SOURCE_PRIMARY_TOKEN` | 補助金 Bearer トークン |
| `NYUSATSU_SOURCE_PRIMARY_TOKEN` | 入札 Bearer トークン |
| `MINPAKU_SOURCE_PRIMARY_TOKEN` | 民泊 Bearer トークン |

**後回し可:** source rollout は [source-rollout-guide.md](./source-rollout-guide.md) に沿って別タスクで実施。デプロイ時点では未設定で OK。

---

## 本番 `.env` 作成手順

```bash
# 1. テンプレートからコピー
cp web/.env.example web/.env

# 2. 必須項目を埋める
nano web/.env
# → APP_BASE_URL と SESSION_SECRET を設定

# 3. 権限を制限（他ユーザーから読めないようにする）
chmod 600 web/.env

# 4. 確認
cat web/.env | grep -E "^(APP_BASE_URL|SESSION_SECRET)" | head -2
```

---

## デプロイ前の最終確認

- [ ] `APP_BASE_URL` が `https://` で始まり、末尾スラッシュがない
- [ ] `APP_BASE_URL` が `localhost` を含まない
- [ ] `SESSION_SECRET` が 32 文字以上
- [ ] `SESSION_SECRET` が開発用フォールバック（`dev-only-*`）ではない
- [ ] `.env` ファイルの権限が `600`
- [ ] `.env` が Git にコミットされていない

---

## 新ドメイン追加時

7th domain 以降を追加した場合、`.env` に以下を追加:

```
# Remote Import
{KEY}_IMPORT_URL=

# Source Adapter
{KEY}_SOURCE_PRIMARY_URL=
# {KEY}_SOURCE_PRIMARY_TOKEN=
```

`.env.example` にも同様に追記し、コミットする。
