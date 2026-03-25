# 本番デプロイ前チェックリスト

> 比較サイト OS を本番環境へ投入する前に確認すべき環境変数と設定項目。
> 値そのものは記載しない。確認観点のみ。
>
> 全体の完了状況・デプロイ順序は [release-readiness.md](./release-readiness.md) を参照。

---

## 1. 基本接続

| 変数 | 必須 | 用途 | 未設定時の影響 | 確認方法 |
|------|------|------|-------------|---------|
| `APP_BASE_URL` | **必須** | sitemap / OGP / メール内リンクの base URL | localhost:3001 にフォールバック。sitemap が不正になる | `/sitemap.xml` を確認 |
| `NODE_ENV` | 自動 | Next.js 環境判定 | 開発モードで動作 | `next build && next start` で production |

- [ ] `APP_BASE_URL` が本番ドメインに設定されている
- [ ] `/sitemap.xml` の URL が本番ドメインになっている

---

## 2. 認証 / セッション

| 変数 | 必須 | 用途 | 未設定時の影響 | 確認方法 |
|------|------|------|-------------|---------|
| `SESSION_SECRET` | **本番必須** | セッション cookie の HMAC 署名キー | 開発用フォールバックが使われる（**危険**） | admin ログイン → セッション維持確認 |

- [ ] `SESSION_SECRET` にランダムな長い文字列を設定済み
- [ ] admin ログイン → ページ遷移 → セッション維持を確認
- [ ] 開発用フォールバック `dev-only-insecure-*` が**使われていない**ことを確認

---

## 3. メール送信

| 変数 | 必須 | 用途 | 未設定時の影響 | 確認方法 |
|------|------|------|-------------|---------|
| `SMTP_HOST` | メール利用時 | SMTP サーバーホスト | メール送信不可 | パスワードリセットメール送信テスト |
| `SMTP_PORT` | メール利用時 | SMTP ポート | — | — |
| `SMTP_SECURE` | 任意 | TLS 使用（true/false） | false | — |
| `SMTP_USER` | メール利用時 | SMTP 認証ユーザー | — | — |
| `SMTP_PASS` | メール利用時 | SMTP 認証パスワード | — | — |
| `MAIL_FROM` | メール利用時 | 送信元アドレス | — | — |

- [ ] メール送信が必要な場合、SMTP 設定が完了している
- [ ] パスワードリセットメールが届くことを確認

---

## 4. Admin API / 認可

| 確認項目 | 方法 |
|---------|------|
| admin API が未認証で 401 になる | `curl /api/admin/yutai` → 401 |
| admin ページがログインなしで表示されない | `/admin` にアクセス → ログインへリダイレクト |
| admin ユーザーが DB に存在する | `users` テーブルで `role = 'admin'` の行を確認 |

- [ ] admin API が未認証時に 401 を返す
- [ ] admin ユーザーが少なくとも 1 人存在する

---

## 5. データ取り込み (importer)

> 実データソース URL の投入手順は [source-rollout-guide.md](./source-rollout-guide.md) を参照。

### Remote Import（`--remote` 用）

| 変数 | 必須 | 用途 |
|------|------|------|
| `YUTAI_IMPORT_URL` | remote 実行時 | 株主優待 remote JSON URL |
| `HOJOKIN_IMPORT_URL` | remote 実行時 | 補助金 remote JSON URL |
| `NYUSATSU_IMPORT_URL` | remote 実行時 | 入札 remote JSON URL |
| `MINPAKU_IMPORT_URL` | remote 実行時 | 民泊 remote JSON URL |

### Source Adapter（`--source primary` 用）

| 変数 | 必須 | 用途 |
|------|------|------|
| `YUTAI_SOURCE_PRIMARY_URL` | source 実行時 | 株主優待データソース URL |
| `HOJOKIN_SOURCE_PRIMARY_URL` | source 実行時 | 補助金データソース URL |
| `NYUSATSU_SOURCE_PRIMARY_URL` | source 実行時 | 入札データソース URL |
| `MINPAKU_SOURCE_PRIMARY_URL` | source 実行時 | 民泊データソース URL |

### Source Token（任意）

| 変数 | 必須 | 用途 |
|------|------|------|
| `*_SOURCE_PRIMARY_TOKEN` | 認証 API のみ | Bearer トークン |

- [ ] 定期実行する場合、対象ドメインの source URL が設定されている
- [ ] `npm run imports:source:dry` で全ドメイン dry-run が成功する
- [ ] `npm run imports:source` で本実行してデータが反映される

---

## 6. 定期実行 (cron)

| 確認項目 | 方法 |
|---------|------|
| cron コマンドが正しい | `npm run imports:source >> logs/imports.log 2>&1` |
| `.env` が cron 実行ユーザーから読める | cron 環境で手動テスト |
| ログ出力先が存在する | `mkdir -p logs` |
| exit code で成功/失敗を判別できる | 全成功→0、一部失敗→1 |

- [ ] cron 設定が本番環境に登録されている（必要な場合）
- [ ] cron 実行ユーザーが `.env` を読める

---

## 7. Ops / 内部ジョブ

| 変数 | 必須 | 用途 | 未設定時の影響 |
|------|------|------|-------------|
| `OPS_CRON_SECRET` | 任意 | cron ジョブ API の secret ヘッダー保護 | secret 保護が無効 |
| `OPS_ADMIN_EMAIL` | 任意 | ops 通知先 | ops 通知なし |
| `OPS_SLACK_WEBHOOK_URL` | 任意 | Slack 通知 | Slack 通知なし |
| `OPS_NOTIFY_CHANNELS` | 任意 | 通知チャネル指定 | — |

- [ ] Ops 通知が必要な場合、Slack / メール設定が完了している

---

## 8. 外部サービス（任意）

| 変数 | 必須 | 用途 |
|------|------|------|
| `NEXT_PUBLIC_GA_ID` | 任意 | Google Analytics トラッキング |
| `UNSPLASH_ACCESS_KEY` | 任意 | Unsplash 画像取得 |
| `LLM_ENABLED` | 任意 | AI/LLM 機能有効化 |
| `LLM_PROVIDER` | LLM 利用時 | プロバイダー |
| `LLM_BASE_URL` | LLM 利用時 | API ベース URL |
| `LLM_API_KEY` | LLM 利用時 | API キー |

- [ ] GA を使う場合、`NEXT_PUBLIC_GA_ID` が設定されている

---

## 9. 最終確認

- [ ] `cp .env.example .env` → 全必須項目を設定
- [ ] `npx next build` が成功する
- [ ] `npx next start` でアプリが起動する
- [ ] 公開ページ（`/yutai`, `/hojokin`, `/nyusatsu`, `/minpaku`, `/saas`, `/marathon`）が正常表示
- [ ] admin ログイン → CRUD 操作 → 監査ログ確認
- [ ] `npm run imports:source:dry` が成功する
- [ ] `/sitemap.xml` に全ドメインの URL が含まれる
