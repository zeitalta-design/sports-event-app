# 日次運用ランブック

## 概要
4ドメイン（food-recall / sanpai / kyoninka / shitei）の日次自動化運用手順。

## 日次フロー

### 1. 同期 + AI抽出（自動）
```bash
# cron で毎朝 7:00 実行
# 同期 → AI対象選定 → deterministic抽出 → (LLM補完) → 分類
node scripts/cron-sync-with-ai.js
```

### 2. review 確認（手動 / 5分程度）
```bash
# ステータス確認
node scripts/cron-sync-with-ai.js --status

# P1-P4 分類確認
node scripts/apply-ai-extractions.js classify

# 反映プレビュー
node scripts/apply-ai-extractions.js preview food-recall
```

### 3. 反映実行（手動 / 1分）
```bash
# P1 一括反映
node scripts/apply-ai-extractions.js bulk-approve

# ドメイン指定反映
node scripts/apply-ai-extractions.js apply food-recall
node scripts/apply-ai-extractions.js apply shitei
```

### 4. shitei 保留再分類（週次 / 必要時）
```bash
node scripts/review-shitei.js reclassify-hold
node scripts/review-shitei.js summary
```

## Admin ダッシュボード
- `/admin/automation` → AI抽出タブ
- P1候補にはP1ラベル + 反映ボタン表示
- ドメイン選択 → 一括反映ボタンでP1を一括適用

## cron 設定（確定版）
```crontab
# 日次同期 + AI抽出（毎朝 7:00）
0 7 * * * cd /path/to/web && node scripts/cron-sync-with-ai.js >> logs/daily-ops.log 2>&1

# LLM有効化時
0 7 * * * cd /path/to/web && LLM_ENABLED=true LLM_API_KEY=xxx node scripts/cron-sync-with-ai.js
```

## 運用ルール

### AI実行件数上限
- 日次: 10-20件
- `--ai-limit` で制御

### 反映ルール
- P1 (conf≥0.5, missing≤3): 一括反映可
- P2 (conf≥0.4): 手動確認後に反映
- P3/P4: 保留 / 再取得

### 反映ポリシー
- 空項目のみ補完（上書きなし）
- dry-run で必ず確認後に本反映
- applied_at タイムスタンプ記録

## トラブルシューティング

### 同期が失敗する
```bash
node scripts/manage-sources.js check    # source到達確認
node scripts/manage-sources.js list     # status確認
```

### AI抽出が0件
```bash
node scripts/cron-sync-with-ai.js --status  # 未実行件数確認
node scripts/run-ai-extraction.js status    # 抽出結果確認
```

### P1が出ない
- deterministic抽出で項目が取れていない → detail-extractors.js のパーサー改善
- LLM有効化で補完を試す → `LLM_ENABLED=true`
