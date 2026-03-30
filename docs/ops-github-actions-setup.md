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

## 7. 宅建業 月次スケジュール実行

### 概要

`ops-scheduled-takuti.yml` により、宅建業の fetch → enrich を毎月自動実行する。

- **workflow**: `Ops: Scheduled Takuti`
- **スケジュール**: 毎月2日 03:17 JST（`timezone: Asia/Tokyo` 指定）
- **処理内容**: `fetch_takuti_prod` → `enrich_takuti_prod` を順次実行
- **安全設計**: fetch 失敗時は enrich に進まない
- **有効化制御**: `TAKUTI_SCHEDULE_ENABLED` Variable で ON/OFF

### 追加で必要な Variables

| Name | 必須 | 初期値 | 説明 |
|------|------|--------|------|
| `TAKUTI_SCHEDULE_ENABLED` | **必須** | `false` | `true` で schedule 自動実行を有効化 |
| `TAKUTI_FETCH_ARGS` | 任意 | (未設定時 `--since=2021-01`) | fetch 時の追加引数 |

既存 Secrets（`VPS_HOST` / `VPS_USER` / `VPS_SSH_KEY` / `SSH_KNOWN_HOSTS`）と Variables（`VPS_PORT`）はそのまま再利用する。

### スケジュール設計

| 項目 | 設定 |
|------|------|
| cron 式 | `17 3 2 * *` |
| timezone | `Asia/Tokyo` |
| 実行時刻 | 毎月2日 03:17 JST |
| 建設業 cron | 毎月1日 05:20 / 06:00 JST |
| 競合回避 | 日付レベルで1日ずらし（1日 vs 2日） |
| 混雑回避 | 毎時00分/30分を避けて17分に設定 |
| UTC 代替（参考） | `17 18 1 * *`（timezone 未指定の場合のみ） |

### 初回導入手順

```
1. workflow ファイルを main に push（または merge）
   → main ブランチ上にないと schedule は動作しない

2. GitHub Variables を追加:
   Settings → Secrets and variables → Actions → Variables タブ
   [ ] TAKUTI_SCHEDULE_ENABLED = false
   [ ] TAKUTI_FETCH_ARGS = --since=2021-01（任意、未設定でも同じ動作）

3. 手動テスト:
   Actions → "Ops: Scheduled Takuti" → Run workflow
   → TAKUTI_SCHEDULE_ENABLED=false でも workflow_dispatch は動作する
   → fetch → enrich が成功して Exit code: 0 を確認

4. schedule 有効化:
   Variables → TAKUTI_SCHEDULE_ENABLED を true に変更
   → 翌月2日 03:17 JST に自動実行される
```

### 停止手順

**一時停止（推奨）:**
- Variables → `TAKUTI_SCHEDULE_ENABLED` を `false` に変更
- schedule トリガーは発火するが、job の `if` 条件で skip される
- workflow_dispatch による手動実行は引き続き可能

**完全停止:**
- workflow ファイルを削除または `schedule:` セクションをコメントアウト
- 通常は Variable による一時停止で十分

### 月次運用チェックリスト

毎月2日の schedule 実行後に以下を確認する。推奨は **翌営業日の朝**。

#### 自動結果の確認（5分）

```
[ ] Actions → "Ops: Scheduled Takuti" の最新 run が成功（緑）
[ ] run の Summary タブで以下を確認:
    [ ] fetch: created / updated / skipped が表示されている
    [ ] enrich: enriched / errors が表示されている
    [ ] DB件数比較: real_estate と TOTAL の実行前後
    [ ] detail入力済み件数の実行前後
    [ ] 件数減少 warning が出ていないこと
[ ] 失敗していた場合:
    → GitHub Issue が自動作成されている（ラベル: ops）
    → Issue 内の Run リンクからログを確認
```

#### 追加確認（必要に応じて、10分）

```
[ ] ops-manual.yml → action: db_counts で最新件数を確認
[ ] ops-manual.yml → action: logs でエラーがないか確認
```

#### 公開画面の目視確認（月1回推奨、5分）

```
[ ] /gyosei-shobun にアクセスして 500 エラーがないこと
[ ] 一覧画面が表示されること
[ ] 業種フィルタで「宅建業」を選択 → 宅建業レコードが表示されること
[ ] 任意の宅建業レコードを開いて:
    [ ] summary が自然な日本語であること
    [ ] detail が存在すること（空でないこと）
    [ ] legal_basis が表示されていること（取得できた場合）
    [ ] レイアウト崩れがないこと
[ ] 建設業レコードも念のため1件開いて壊れていないこと
```

#### admin 画面の目視確認（月1回推奨、5分）

```
[ ] /admin/gyosei-shobun にアクセスして 500 エラーがないこと
[ ] 一覧で宅建業レコードが見えること
[ ] review_status / is_published が想定通りであること
[ ] summary / detail / legal_basis の品質を1-2件スポットチェック
```

### 実行結果の確認方法

scheduled workflow は `GITHUB_STEP_SUMMARY` に結果サマリを自動出力する。

**確認手順:**
1. Actions → "Ops: Scheduled Takuti" → 最新の run をクリック
2. **Summary** タブを開く（ログではなく Summary）
3. 以下が表形式で表示される:
   - fetch の created / updated / skipped
   - enrich の enriched / errors
   - DB 件数の実行前後比較（real_estate / TOTAL / detail入力済み）
   - 件数減少時の Warning

### 失敗時の対応手順

#### 自動通知

失敗すると以下が自動で行われる:
- workflow が赤（failure）になる
- GitHub Issue が自動作成される（ラベル: `ops`、タイトル: `[Scheduled Takuti] 月次実行失敗 YYYY-MM-DD`）
- 同タイトルの open issue が既にあれば、コメントが追記される

#### 切り分け手順

1. **Actions ログを確認**: どのステップで失敗したか特定
2. **`ops-manual.yml` で `status` を実行**: SSH / Docker / DB の状態を確認
3. 失敗箇所に応じた対処:

| 失敗ステップ | 原因候補 | 対処 |
|--------------|----------|------|
| SSH 鍵配置 | Secret 設定ミス | VPS_SSH_KEY を再確認 |
| Pre-check | SSH接続 or コンテナ停止 | `status` で確認 → コンテナ再起動 |
| fetch_takuti_prod | MLIT サイト障害 / ネットワーク | 翌日に手動再実行 |
| fetch_takuti_prod | DB ロック / flock 競合 | VPS で lock ファイル確認 |
| enrich_takuti_prod | 詳細ページ取得失敗 | `--limit=10` で部分再実行 |
| Post-check | DB 接続の一時的問題 | 件数は手動で `db_counts` 確認 |

4. **手動再実行**: `ops-manual.yml` から `fetch_takuti_prod` / `enrich_takuti_prod` を個別に実行
5. **Issue をクローズ**: 対処完了後、自動作成された Issue をクローズ

### 件数異常の判断基準

| 状態 | 判断 | 対応 |
|------|------|------|
| real_estate 件数が増加 | **正常** — 新規処分データが追加された | 対応不要 |
| real_estate 件数が変化なし | **正常** — 新規データなし（updated のみ） | 対応不要 |
| TOTAL 件数が減少 | **Warning** — Summary に警告表示 | ログ確認、必要ならバックアップからリストア |
| enrich errors > 0 | **要確認** — MLIT サイト側の一時障害の可能性 | 翌月の enrich で自動リカバリされるか確認 |
| construction 件数が変化 | **異常** — 宅建業処理で建設業に影響するはずがない | 即座に調査 |

> **設計方針**: 件数減少は warning 表示のみで fail にはしない。理由は、MLIT 側でデータが削除される正当なケースもあり得るため。運営者が Summary を見て判断する。

### ロールバック

fetch / enrich は本番実行前に自動バックアップを取得する（`backup-db.sh`）。

**バックアップ確認:**
```bash
ls -lt /opt/app/backups/sports-event_*_fetch_takuti.db
ls -lt /opt/app/backups/sports-event_*_enrich_takuti.db
```

**リストア手順（万一の場合のみ）:**
```bash
# VPS に SSH して実行
docker stop navi-app
cp /opt/app/backups/sports-event_YYYYMMDD_HHMMSS_fetch_takuti.db /opt/app/web/data/sports-event.db
docker start navi-app
# リストア後に db_counts で件数確認
```

### 一時停止方法

**schedule の一時停止:**
- Settings → Variables → `TAKUTI_SCHEDULE_ENABLED` を `false` に変更
- schedule トリガーは発火するが、job の `if` 条件で skip される
- workflow_dispatch による手動実行は引き続き可能

**完全停止:**
- workflow ファイルを削除または `schedule:` セクションをコメントアウト
- 通常は Variable による一時停止で十分

### 注意事項

- **default branch 必須**: GitHub Actions の schedule は main（default branch）上の workflow だけが動作する。feature branch に workflow があっても schedule は発火しない
- **非活動による自動停止**: public リポジトリでは 60日間コミットがないと scheduled workflows が自動停止される。private リポジトリでは発生しない
- **時刻の保証なし**: GitHub Actions の schedule は目安であり、混雑時は数分〜数十分遅延する可能性がある
- **concurrency**: `ops-scheduled-takuti` グループで重複防止。手動 workflow（`ops-manual`）とは別グループなので、同時実行は VPS 側 flock で保護される
- **月初1日回避**: 建設業 cron が毎月1日 05:20/06:00 JST に動くため、宅建業 schedule は2日に設定。手動でもこの時間帯は避ける
- **Issue 自動作成**: 失敗時に GitHub Issue が自動作成される（`ops` ラベルがあれば付与）。`GITHUB_TOKEN` の `issues: write` 権限で動作し、追加 Secret は不要

---

## 8. 今後の拡張

### タスク追加
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
