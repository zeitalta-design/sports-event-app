# GitHub Actions 運用タスク — セットアップ・運用手順

## 概要

VPS 手打ちで行っていた運用タスク（fetch / enrich / 状態確認 / ログ確認）を
GitHub Actions の手動実行（workflow_dispatch）で代替する。

**方式**: VPS 上の `scripts/ops/run-task.sh` をSSH経由で呼ぶ（方式B）

---

## 1. GitHub Secrets / Variables の設定

リポジトリの Settings → Secrets and variables → Actions で以下を設定する。

### Secrets（必須）

| Name | 説明 | 例 |
|------|------|----|
| `VPS_HOST` | さくらVPSのIPアドレス | `153.xxx.xxx.xxx` |
| `VPS_USER` | SSH接続ユーザー | `deploy` |
| `VPS_SSH_KEY` | SSH秘密鍵（Ed25519推奨） | `-----BEGIN OPENSSH PRIVATE KEY-----\n...` |

### Secrets（推奨）

| Name | 説明 | 例 |
|------|------|----|
| `SSH_KNOWN_HOSTS` | VPSのホスト鍵fingerprint | `ssh-keyscan` の出力をそのまま貼る |

### Variables（任意）

| Name | 説明 | デフォルト |
|------|------|-----------|
| `VPS_PORT` | SSHポート番号 | `22` |

### 既存 Secrets との共用について

`build-and-push.yml` が既に `VPS_HOST` / `VPS_USER` / `VPS_SSH_KEY` を使用している。

**推奨: 共用する**
- 同じ Secret 名なので追加設定不要
- 同一ユーザーで deploy も ops も実行できる
- ユーザーが docker group に属していれば問題ない

**分離する場合（より厳密なセキュリティが必要な場合）:**
- ops 専用の `VPS_OPS_USER` / `VPS_OPS_SSH_KEY` を作り、workflow 側も変更
- 権限分離が必要な大規模チームで有効、個人運用では過剰

### Docker 権限の推奨方針

| 方式 | 設定 | 推奨度 |
|------|------|--------|
| **docker group** | `usermod -aG docker <user>` | **推奨** — sudo 不要、安全 |
| 限定 sudo | `visudo` で `docker exec` のみ許可 | 過剰、設定複雑 |
| root SSH | root で直接 SSH | 非推奨 |

docker group に所属していれば `docker ps` / `docker exec` / `docker logs` が全て sudo なしで使える。
`build-and-push.yml` の deploy ジョブで既に docker を実行しているなら、そのユーザーは docker group に所属済みの可能性が高い。

---

## 2. VPS 側の初回セットアップ

### 2-1. 使用ユーザーの確認

**A. 既存ユーザーを流用する場合（推奨）:**

`build-and-push.yml` の `VPS_USER` で既に SSH + docker 実行しているなら、そのまま使える。

```bash
# 既存ユーザーで確認
ssh <既存ユーザー>@<VPS_IP>
docker ps        # → navi-app が表示されれば OK
cd /opt/app      # → 入れれば OK
```

**B. 新規 deploy ユーザーを作る場合:**

```bash
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy

# docker group 変更の反映確認（再ログイン後）
sudo -u deploy docker ps  # エラーなく動くこと
```

### 2-2. SSH 鍵の配置

**ローカルで鍵生成（まだ無い場合）:**
```bash
ssh-keygen -t ed25519 -C "github-actions-ops" -f ~/.ssh/id_ed25519_github_ops
```

**VPS に公開鍵を配置:**
```bash
sudo mkdir -p /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
# 公開鍵の内容を追加
echo "ssh-ed25519 AAAA... github-actions-ops" | sudo tee -a /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
```

**秘密鍵を GitHub Secret に登録:**
```bash
cat ~/.ssh/id_ed25519_github_ops
# → この内容を VPS_SSH_KEY Secret にコピー
```

### 2-3. known_hosts の取得

```bash
ssh-keyscan -p 22 <VPS_IP>
# → この出力全体を SSH_KNOWN_HOSTS Secret にコピー
```

### 2-4. /opt/app のパーミッション

```bash
# deploy ユーザーがアクセスできるようにする
sudo chown -R deploy:deploy /opt/app

# バックアップディレクトリ作成
sudo mkdir -p /opt/app/backups
sudo chown deploy:deploy /opt/app/backups

# ログディレクトリの読み取り権限
sudo chmod -R g+r /opt/app/logs/ 2>/dev/null || true
```

### 2-5. ops スクリプトの配置確認

`git pull` 後、以下のファイルが存在すること:
```
/opt/app/scripts/ops/run-task.sh
/opt/app/scripts/ops/status.sh
/opt/app/scripts/ops/db-counts.sh
/opt/app/scripts/ops/logs.sh
/opt/app/scripts/ops/backup-db.sh
```

実行権限の付与:
```bash
chmod +x /opt/app/scripts/ops/*.sh
```

### 2-6. 接続テスト

```bash
# ローカルから手動テスト
ssh -i ~/.ssh/id_ed25519_github_ops deploy@<VPS_IP> "cd /opt/app && bash scripts/ops/run-task.sh status"
```

---

## 初回セットアップ実施チェックリスト

以下を上から順に実行する。

### Phase 1: GitHub Settings

```
[ ] Settings → Secrets → VPS_HOST を登録
[ ] Settings → Secrets → VPS_USER を登録
[ ] Settings → Secrets → VPS_SSH_KEY を登録（秘密鍵全体をペースト）
[ ] Settings → Secrets → SSH_KNOWN_HOSTS を登録
[ ] Settings → Variables → VPS_PORT を登録（22以外の場合のみ）
```

**確認ポイント**: 既存の `build-and-push.yml` が同じ `VPS_HOST` / `VPS_USER` / `VPS_SSH_KEY` を使っていれば、そのまま共用可能。新しい deploy ユーザーを作る場合は `VPS_OPS_USER` / `VPS_OPS_SSH_KEY` 等に分離するか、同一 Secret を共用してユーザーを統一する。

### Phase 2: VPS 側

```
[ ] 使用ユーザーで SSH ログイン可能
[ ] docker ps が sudo なしで実行可能（docker group 確認）
[ ] cd /opt/app が可能
[ ] /opt/app/scripts/ops/*.sh が存在（git pull 済み）
[ ] chmod +x /opt/app/scripts/ops/*.sh を実行済み
[ ] mkdir -p /opt/app/backups を実行済み
[ ] navi-app コンテナが動作中（docker ps で確認）
```

### Phase 3: GitHub Actions 接続確認

```
[ ] Actions → "Ops: Manual Task Runner" → Run workflow
    action: status / confirm_production: 空 / extra_args: 空
[ ] SSH 接続成功（ログに "Permission denied" がない）
[ ] Git revision が表示される
[ ] Docker コンテナ状態が表示される
[ ] Cron エントリが表示される
[ ] DB 件数が表示される
[ ] workflow が緑（success）で完了
```

### Phase 4: 非破壊の追加確認

```
[ ] action: db_counts を実行 → industry 別件数が表示
[ ] action: logs を実行 → gyosei-shobun ログが表示
[ ] action: fetch_construction_dry_run を実行 → dry-run 結果が表示
```

### Phase 5: Production 解禁前チェックリスト

```
[ ] Phase 1-4 が全て成功
[ ] dry-run の出力内容が妥当（件数、日付範囲、サンプルデータ）
[ ] backup-db.sh が動作する（db_counts 等で間接確認、または VPS で手動テスト）
[ ] confirm_production=空 で *_prod を実行 → ブロックされることを確認
[ ] /opt/app/backups/ にバックアップが書き込み可能（VPS で手動確認）
[ ] flock が正常に動作する（VPS で手動確認）
```

---

## status 失敗時の切り分け手順

| 症状 | 原因候補 | 確認方法 |
|------|----------|----------|
| `ssh: connect to host ... port 22: Connection refused` | VPS_HOST / VPS_PORT が間違い | Secret の値を再確認 |
| `Permission denied (publickey)` | 鍵不一致 or ユーザー不一致 | VPS 側の `~/.ssh/authorized_keys` と Secret の鍵ペアを確認 |
| `Host key verification failed` | known_hosts 不一致 | `SSH_KNOWN_HOSTS` を `ssh-keyscan` で再取得 |
| `bash: scripts/ops/run-task.sh: No such file` | git pull されていない | VPS で `cd /opt/app && git pull` |
| `bash: scripts/ops/run-task.sh: Permission denied` | 実行権限なし | `chmod +x /opt/app/scripts/ops/*.sh` |
| `ERROR: Container 'navi-app' is not running` | Docker コンテナ停止中 | `docker start navi-app` or `bash scripts/deploy-vps.sh` |
| `docker: permission denied` | docker group 未設定 | `sudo usermod -aG docker <user>` → 再ログイン |
| Git セクションが `Git repo not found` | `/opt/app/.git` がない | git clone し直すか、スクリプト修正不要（警告表示のみ） |

**切り分け順序**: SSH接続 → ファイル存在 → 実行権限 → Docker権限 → コンテナ状態 → DB接続

---

## 3. 日常運用

### 実行方法

1. GitHub リポジトリ → **Actions** タブ → **Ops: Manual Task Runner**
2. **Run workflow** ボタンをクリック
3. パラメータを入力:
   - **action**: 実行するタスクを選択
   - **confirm_production**: 本番実行時のみ `YES` と入力
   - **extra_args**: 追加引数（任意）
4. **Run workflow** で実行開始

### アクション一覧

| Action | 危険度 | 確認要 | 説明 |
|--------|--------|--------|------|
| `status` | 安全 | 不要 | Git/Docker/Cron/DB状態の確認 |
| `db_counts` | 安全 | 不要 | DB件数の詳細表示 |
| `logs` | 安全 | 不要 | 運用ログの tail |
| `fetch_construction_dry_run` | 安全 | 不要 | 建設業 fetch のプレビュー |
| `fetch_construction_prod` | **要注意** | **YES** | 建設業 fetch の本実行（DB書込み） |
| `enrich_construction_dry_run` | 安全 | 不要 | 建設業 enrich のプレビュー |
| `enrich_construction_prod` | **要注意** | **YES** | 建設業 enrich の本実行（DB更新） |
| `fetch_takuti_dry_run` | 安全 | 不要 | 宅建業 fetch のプレビュー |
| `fetch_takuti_prod` | **要注意** | **YES** | 宅建業 fetch の本実行（DB書込み） |
| `enrich_takuti_dry_run` | 安全 | 不要 | 宅建業 enrich のプレビュー |
| `enrich_takuti_prod` | **要注意** | **YES** | 宅建業 enrich の本実行（DB更新） |

### extra_args の使い方

```
--since=2021-01          宅建業 fetch で過去データを取得
--limit=10               テスト用に件数制限
--max-pages=3            ページ数制限
--ids=123,456            enrich で特定IDのみ対象
```

### 推奨運用フロー

**月初の定期チェック:**
1. `status` で VPS 状態確認
2. `db_counts` で件数確認
3. cron が正常に動いているか確認

**手動 fetch/enrich 実行時:**
1. まず `*_dry_run` で件数・内容を確認
2. 問題なければ `*_prod` を `confirm_production=YES` で実行
3. 実行後のログで created/updated/skipped を確認
4. `db_counts` で最終件数を確認

---

## 4. 安全設計

### 本番実行ガード
- `*_prod` アクション → `confirm_production` が `YES` でなければ即中断
- GitHub Actions のログに明確なエラーメッセージ表示

### DB バックアップ
- 本番実行（`*_prod`）の前に自動で `/opt/app/backups/` にバックアップ
- 命名規則: `sports-event_YYYYMMDD_HHMMSS_<label>.db`
- 最新20件を保持、古いものは自動削除

### 同時実行防止
- **GitHub Actions 側**: `concurrency: ops-manual` で同一ワークフローの並列実行を防止
- **VPS 側**: `flock` でタスク実行の排他制御（読み取り系は除く）

### fork / PR からの実行防止
- `if: github.event_name == 'workflow_dispatch'` で限定

### extra_args のインジェクション防止
- `;`, `|`, `&`, `` ` ``, `$` 等の危険文字をバリデーションで拒否

---

## 5. トラブルシューティング

### SSH 接続失敗
```
Permission denied (publickey)
```
→ VPS_SSH_KEY の内容を確認。改行が `\n` に変換されていないか確認。

### コンテナが見つからない
```
ERROR: Container 'navi-app' is not running
```
→ VPS に SSH して `docker ps -a` で状態確認。`docker start navi-app` で再起動。

### タイムアウト
- workflow 全体: 30分
- SSH 実行: 20分
- enrich は対象件数が多いと時間がかかる。`--limit` で件数を絞って分割実行を検討。

### バックアップ失敗
→ `/opt/app/backups/` のディスク容量と権限を確認。

---

## 6. 既存 cron との関係

- **既存 cron は一切変更しない**
- 月初の cron（fetch: 05:20, enrich: 06:00）はそのまま動作
- GitHub Actions からの手動実行は cron とは独立
- VPS 側の `flock` で同時実行は防止される

---

## 7. 今後の拡張

### Phase 3: タスク追加
- `run-task.sh` に case を追加するだけで新タスクを増やせる
- workflow の `options` にも追加

### Admin UI 移行
- `scripts/ops/run-task.sh` と同じロジックを `app/api/admin/ops/` の API として公開
- 管理画面のボタンから REST API 経由で同じ操作が可能に
- GitHub Actions と admin UI を併用する期間を設けて段階移行

### push 自動実行
- `build-and-push.yml` の deploy ジョブ後に `status` を自動実行する拡張
- デプロイ後の自動検証として有効

### Slack 通知
- workflow 完了時に Slack webhook で結果を通知
- 失敗時のみ通知する設定も可能
