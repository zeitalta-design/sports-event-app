# 本番デプロイ入力シート

> このシートを埋めて返してください。全必須項目が埋まれば、本番デプロイを即実行できます。
>
> **注意:** SSH 秘密鍵やパスワードそのものはここに書かないでください。接続先情報のみ記入します。

---

## 記入テンプレート（コピーして埋めてください）

```
## 必須

VPS プロバイダ:
SSH 接続先: ssh ユーザー名@IPアドレス
サーバ OS:
Docker 利用: はい / いいえ
本番ドメイン:
DNS 設定済み: はい / いいえ
SSL 方式: Caddy / nginx + Let's Encrypt / Cloudflare / その他
SESSION_SECRET 生成済み: はい / いいえ

## 任意

reverse proxy: Caddy / nginx / なし（Docker 直接）
バックアップ: 毎日 / 週次 / 不要
監視: UptimeRobot / なし
cron import: 毎日05:00 / 不要 / 後で設定
```

---

## 記入例

```
## 必須

VPS プロバイダ: Hetzner CX22
SSH 接続先: ssh deploy@49.12.xxx.xxx
サーバ OS: Ubuntu 24.04
Docker 利用: はい
本番ドメイン: nyusatsu-navi.example.com
DNS 設定済み: はい（Cloudflare で A レコード設定済み）
SSL 方式: Caddy
SESSION_SECRET 生成済み: はい

## 任意

reverse proxy: Caddy
バックアップ: 毎日
監視: なし
cron import: 後で設定
```

---

## 各項目の説明

### 必須項目

| 項目 | 説明 | 例 |
|------|------|---|
| VPS プロバイダ | サーバーのサービス名 | Hetzner / DigitalOcean / さくら / ConoHa |
| SSH 接続先 | `ssh ユーザー@IP` 形式 | `ssh deploy@49.12.xxx.xxx` |
| サーバ OS | OS とバージョン | Ubuntu 24.04 / 22.04 |
| Docker 利用 | Docker が使えるか | はい / いいえ（Docker 未導入なら初期設定で入れます） |
| 本番ドメイン | アプリの公開 URL に使うドメイン | `nyusatsu-navi.example.com` |
| DNS 設定済み | ドメインが VPS の IP を向いているか | はい / いいえ |
| SSL 方式 | HTTPS 終端の方法 | Caddy（推奨）/ nginx + Let's Encrypt / Cloudflare |
| SESSION_SECRET | 生成済みか（値自体は書かない） | はい / いいえ |

### 任意項目

| 項目 | 説明 | デフォルト |
|------|------|----------|
| reverse proxy | HTTPS 終端に使うソフト | Caddy（推奨） |
| バックアップ | SQLite DB のバックアップ頻度 | 毎日 |
| 監視 | ヘルスチェック | なし |
| cron import | データ自動取り込みの実行タイミング | 後で設定 |

---

## SESSION_SECRET の生成方法

まだ生成していない場合は、サーバー上で以下を実行してください:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

出力された 64 文字の文字列を `.env` の `SESSION_SECRET` に設定します。

---

## 回答後の流れ

1. **このシートの回答を受け取る**
2. **VPS 初期セットアップ** → [vps-setup-guide.md](./vps-setup-guide.md)
3. **本番 `.env` 作成** → [production-env-template.md](./production-env-template.md)
4. **Docker build / run / 疎通確認** → [deploy-guide.md](./deploy-guide.md)

必須項目が全て埋まっていれば、1 タスクで本番デプロイまで完了できます。
