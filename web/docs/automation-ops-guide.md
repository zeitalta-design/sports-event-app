# 自動同期 運用ガイド

## 概要
4ドメイン（food-recall / sanpai / kyoninka / shitei）の自動同期基盤の運用手順。

## コマンド一覧

### 同期実行
```bash
# 全ドメイン同期
node scripts/cron-sync.js

# 特定ドメインのみ
node scripts/cron-sync.js --domain food-recall
node scripts/cron-sync.js --domain sanpai
node scripts/cron-sync.js --domain kyoninka
node scripts/cron-sync.js --domain shitei

# ステータス確認
node scripts/cron-sync.js --status

# dry run
node scripts/cron-sync.js --domain food-recall --dry-run
```

### Source 管理
```bash
# ソース一覧
node scripts/manage-sources.js list

# 到達確認
node scripts/manage-sources.js check

# ソース停止/再開
node scripts/manage-sources.js deactivate <id>
node scripts/manage-sources.js activate <id>

# URL更新
node scripts/manage-sources.js update-url <id> <url>
```

### 手動同期（旧方式）
```bash
node scripts/run-sync.js food-recall
node scripts/run-sync.js shitei --round 2
```

## cron 設定

### Linux/Mac
```crontab
# food-recall: 日次（毎朝 6:30）
30 6 * * * cd /path/to/sports-event-app/web && node scripts/cron-sync.js --domain food-recall >> logs/sync.log 2>&1

# shitei: 平日朝（月-金 8:00）
0 8 * * 1-5 cd /path/to/sports-event-app/web && node scripts/cron-sync.js --domain shitei >> logs/sync.log 2>&1

# sanpai: 週次（月曜 7:00）
0 7 * * 1 cd /path/to/sports-event-app/web && node scripts/cron-sync.js --domain sanpai >> logs/sync.log 2>&1

# kyoninka: 週次（水曜 7:00）
0 7 * * 3 cd /path/to/sports-event-app/web && node scripts/cron-sync.js --domain kyoninka >> logs/sync.log 2>&1
```

### Windows Task Scheduler
- プログラム: `node`
- 引数: `scripts/cron-sync.js --domain food-recall`
- 開始位置: `D:\ClaudeProjects\data-platform\sports-event-app\web`
- トリガー: 毎日 06:30

## 通知設定

### 環境変数
```bash
# Slack webhook（推奨）
export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXXXX/YYYYY/ZZZZZ

# メール
export NOTIFICATION_EMAIL_TO=admin@example.com
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your-email@gmail.com
export SMTP_PASS=your-app-password

# 法人番号API（kyoninka 名寄せ用）
export HOUJIN_API_ID=your-api-id
```

## 4ドメイン実データ率

| ドメイン | 実データ取得 | fallback依存 | 理由 |
|---------|-----------|------------|------|
| food-recall | ⚠️ 到達可能だがparser要調整 | サンプルデータで運用中 | 一覧ページの構造精査が必要 |
| sanpai | ⚠️ 到達可能だがparser要調整 | サンプルデータで運用中 | 処分一覧ページの構造精査が必要 |
| kyoninka | ❌ フォーム送信型で直接取得不可 | サンプルデータで運用中 | POST送信の実装が必要 |
| shitei | ✅ 世田谷区で実データ取得 | 他自治体はサンプル | 世田谷区は安定、他は構造差 |

## 失敗時の対応

### 同期失敗
1. `node scripts/cron-sync.js --status` で最新の sync_runs を確認
2. `sync_runs.error_summary` でエラー内容を確認
3. `manage-sources.js check` で source の到達確認
4. 必要に応じて `manage-sources.js deactivate <id>` で停止

### source 404
1. `manage-sources.js check` で確認
2. 正しいURLを調査
3. `manage-sources.js update-url <id> <new-url>` で更新
4. 修正不可なら `manage-sources.js deactivate <id>`

### 大量 review 発生
1. Admin ダッシュボード (`/admin/automation`) で確認
2. 要確認タブで差分を確認
3. 問題なければ「確認」ボタンで review 済みに

## 次の改善ステップ
1. parser 精度向上（実ソースのHTML構造に合わせた調整）
2. POST フォーム送信の実装（kyoninka 国交省系）
3. source 追加（他の自治体、他の都道府県環境局）
4. LLM によるデータ抽出の高度化
5. 運用監視ダッシュボードの強化
