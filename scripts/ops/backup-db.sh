#!/usr/bin/env bash
# backup-db.sh — SQLite DB のバックアップ
# 使い方: bash scripts/ops/backup-db.sh [ラベル]
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/app}"
BACKUP_DIR="${APP_DIR}/backups"
DB_FILE="${APP_DIR}/web/data/sports-event.db"
LABEL="${1:-manual}"
TIMESTAMP="$(date '+%Y%m%d_%H%M%S')"
BACKUP_FILE="${BACKUP_DIR}/sports-event_${TIMESTAMP}_${LABEL}.db"

# 古いバックアップの保持数
MAX_BACKUPS="${MAX_BACKUPS:-20}"

echo "=== DB バックアップ ==="
echo "Source: $DB_FILE"
echo "Target: $BACKUP_FILE"

# 前提チェック
if [ ! -f "$DB_FILE" ]; then
  echo "ERROR: DB file not found: $DB_FILE"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# SQLite の .backup コマンドで安全にコピー（WALモード対応）
CONTAINER="${CONTAINER:-navi-app}"
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  # コンテナ内からbackupコマンド実行（ロック安全）
  docker exec "$CONTAINER" node -e "
    const D = require('better-sqlite3');
    const db = new D('/app/web/data/sports-event.db', { readonly: true });
    db.backup('/app/web/data/_backup_tmp.db').then(() => {
      console.log('SQLite backup completed');
      db.close();
    }).catch(err => {
      console.error('Backup failed:', err.message);
      db.close();
      process.exit(1);
    });
  "
  # コンテナ内の一時ファイルをホスト側のバックアップ先へ移動
  cp "${APP_DIR}/web/data/_backup_tmp.db" "$BACKUP_FILE"
  rm -f "${APP_DIR}/web/data/_backup_tmp.db"
else
  # コンテナが動いていない場合は直接コピー
  echo "WARNING: Container not running, using direct file copy"
  cp "$DB_FILE" "$BACKUP_FILE"
fi

# サイズ確認
BACKUP_SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
echo "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# 古いバックアップを削除（MAX_BACKUPS を超えた分）
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/sports-event_*.db 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
  DELETE_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
  echo "Cleaning up $DELETE_COUNT old backup(s) (keeping $MAX_BACKUPS)..."
  ls -1t "$BACKUP_DIR"/sports-event_*.db | tail -n "$DELETE_COUNT" | xargs rm -f
fi

echo "Current backups: $(ls -1 "$BACKUP_DIR"/sports-event_*.db 2>/dev/null | wc -l)"
echo "=== 完了 ==="
