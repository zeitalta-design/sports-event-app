# VPS 選定・確認・初期セットアップガイド

> VPS を調達し、比較サイト OS を Docker でデプロイできる状態に整えるための手順。
> このガイドが終わったら [deploy-guide.md](./deploy-guide.md) に進む。

---

## 1. VPS 選定

### このプロジェクトに必要な最小スペック

| 項目 | 最小 | 推奨 | 理由 |
|------|------|------|------|
| CPU | 1 vCPU | 2 vCPU | Next.js build に CPU を使う |
| メモリ | 1 GB | 2 GB | build 時に 1GB 近く使う。runtime は 256MB 程度 |
| ディスク | 20 GB SSD | 40 GB SSD | Docker image + SQLite DB + ログ + バックアップ |
| OS | Ubuntu 22.04+ | Ubuntu 24.04 | Docker 公式サポート、LTS |
| ネットワーク | 固定 IPv4 | 固定 IPv4 | DNS A レコードに必要 |

### 候補比較

| プロバイダ | プラン例 | 月額 | リージョン | 特徴 |
|-----------|---------|------|----------|------|
| **Hetzner** | CX22 (2vCPU/4GB) | €4.5〜 | 独/芬/米 | コスパ最良。Docker 対応良好 |
| **DigitalOcean** | Basic Droplet (1vCPU/2GB) | $12 | 世界各地 | UI が分かりやすい。日本リージョンはシンガポール |
| **さくら VPS** | 2GB プラン | ¥1,738 | 日本 | 国内回線。日本語サポート |
| **ConoHa VPS** | 2GB プラン | ¥1,848 | 日本 | 国内回線。時間課金あり |

### 選び方の目安

| 条件 | 推奨 |
|------|------|
| コスト最小・海外 OK | Hetzner CX22 |
| 日本からの応答速度重視 | さくら VPS or ConoHa |
| 英語 UI で構わない・グローバル | DigitalOcean SGP |
| 最初は最安で試したい | Hetzner CX22 (€4.5/月) |

### SQLite 運用の観点

- SQLite はファイルベースなので、**ディスク I/O が安定した SSD** を選ぶ
- 共有型 VPS で十分（専用サーバー不要）
- DB サイズは現在 約5MB。数万件規模でも 100MB 以下
- バックアップはファイルコピーだけで済むので、追加サービス不要

---

## 2. ユーザー確認シート

VPS 調達前〜調達直後に、以下を埋めてください。
全項目が揃えば、次のデプロイ指示で即実行できます。

### 必須（デプロイに必要）

| # | 項目 | あなたの回答 |
|---|------|------------|
| 1 | VPS プロバイダ・プラン | （例: Hetzner CX22） |
| 2 | サーバ IP アドレス | （例: 123.45.67.89） |
| 3 | SSH ユーザー名 | （例: root or deploy） |
| 4 | サーバ OS | （例: Ubuntu 24.04） |
| 5 | 本番ドメイン | （例: navi.example.com） |
| 6 | DNS 管理場所 | （例: Cloudflare / お名前.com / Route53） |
| 7 | SSL 方式 | （例: Caddy / nginx + Let's Encrypt / Cloudflare） |
| 8 | Docker 利用 | はい / いいえ |

### 任意（運用に必要）

| # | 項目 | あなたの回答 |
|---|------|------------|
| 9 | バックアップ保存先 | （例: 同一サーバ /opt/backups / 外部 S3） |
| 10 | バックアップ頻度 | （例: 毎日 / 週次） |
| 11 | 監視・アラート | （例: 不要 / UptimeRobot / Healthchecks.io） |
| 12 | cron import 時刻 | （例: 毎日 05:00 JST） |

---

## 3. VPS 初期セットアップ手順

VPS を調達したら、以下の順で準備する。

### 3.1 SSH 接続

```bash
ssh root@<SERVER_IP>
```

### 3.2 OS 更新

```bash
apt update && apt upgrade -y
```

### 3.3 作業ユーザー作成（root 以外で運用する場合）

```bash
adduser deploy
usermod -aG sudo deploy
# SSH 鍵の配置
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
```

### 3.4 Docker インストール

```bash
# 公式手順に沿ってインストール
curl -fsSL https://get.docker.com | sh
# deploy ユーザーを docker グループに追加
usermod -aG docker deploy
```

確認:
```bash
docker --version
docker run hello-world
```

### 3.5 ディレクトリ構成

```bash
mkdir -p /opt/sports-event-app
mkdir -p /opt/backups
```

| ディレクトリ | 用途 |
|------------|------|
| `/opt/sports-event-app/` | アプリ本体（git clone 先） |
| `/opt/sports-event-app/web/data/` | SQLite DB（永続化） |
| `/opt/sports-event-app/web/.env` | 本番環境変数 |
| `/opt/backups/` | DB バックアップ |

### 3.6 アプリ取得

```bash
cd /opt
git clone https://github.com/zeitalta-design/sports-event-app.git
cd sports-event-app
```

### 3.7 本番 `.env` 配置

```bash
cp web/.env.example web/.env
nano web/.env
```

**必ず設定する項目:**

| env | 設定内容 |
|-----|---------|
| `APP_BASE_URL` | `https://<YOUR_DOMAIN>` |
| `SESSION_SECRET` | ランダム文字列（下記コマンドで生成） |

```bash
# SESSION_SECRET 生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

他の env は [deploy-checklist.md](./deploy-checklist.md) を参照。

### 3.8 reverse proxy / SSL の準備

#### Caddy（推奨・最小構成）

```bash
apt install -y caddy
```

`/etc/caddy/Caddyfile`:
```
<YOUR_DOMAIN> {
    reverse_proxy localhost:3000
}
```

```bash
systemctl reload caddy
```

Caddy は自動で Let's Encrypt 証明書を取得する。

#### nginx + Let's Encrypt

```bash
apt install -y nginx certbot python3-certbot-nginx
```

設定は [deploy-guide.md](./deploy-guide.md) のセクション 2 を参照。

### 3.9 DNS 設定

DNS 管理画面で A レコードを追加:

```
<YOUR_DOMAIN>  A  <SERVER_IP>
```

浸透確認:
```bash
dig <YOUR_DOMAIN> +short
```

### 3.10 デプロイ前の最終確認

- [ ] SSH でサーバに接続できる
- [ ] `docker --version` が動く
- [ ] `/opt/sports-event-app/` にリポジトリがある
- [ ] `web/.env` に `APP_BASE_URL` と `SESSION_SECRET` が設定済み
- [ ] DNS が VPS の IP を向いている
- [ ] reverse proxy が設定済み（Caddy or nginx）
- [ ] SSL 証明書が取得済み（Caddy なら自動）

**全て ✅ なら [deploy-guide.md](./deploy-guide.md) のセクション 1「Docker ビルド」へ進む。**

---

## 4. 次のステップ

```
このガイド（VPS 選定・セットアップ）
  ↓
deploy-guide.md（Docker build / run / 疎通確認）
  ↓
source-rollout-guide.md（データソース投入）
  ↓
import-operations.md（cron 定期実行）
```
