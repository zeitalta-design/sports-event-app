#!/usr/bin/env bash
# status.sh — VPS状態確認（git, docker, cron, DB件数）
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/app}"
CONTAINER="${CONTAINER:-navi-app}"
DB_PATH="/app/web/data/sports-event.db"

echo "=========================================="
echo "  VPS 状態確認  $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "=========================================="

# --- Git ---
echo ""
echo "--- Git ---"
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  echo "HEAD: $(git rev-parse --short HEAD) ($(git log -1 --format='%s' 2>/dev/null || echo 'N/A'))"
  echo "Branch: $(git branch --show-current 2>/dev/null || echo 'detached')"
  echo "Last pull: $(git log -1 --format='%ci' 2>/dev/null || echo 'N/A')"
else
  echo "Git repo not found at $APP_DIR"
fi

# --- Docker ---
echo ""
echo "--- Docker ---"
if docker ps --format '{{.Names}}\t{{.Status}}\t{{.Image}}' 2>/dev/null | grep -q "$CONTAINER"; then
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' --filter "name=$CONTAINER"
else
  echo "WARNING: Container '$CONTAINER' is NOT running"
  docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' --filter "name=$CONTAINER" 2>/dev/null || true
fi

# --- Disk ---
echo ""
echo "--- Disk ---"
df -h "$APP_DIR" 2>/dev/null | tail -1 || echo "df failed"
if [ -f "$APP_DIR/web/data/sports-event.db" ]; then
  echo "DB size: $(du -h "$APP_DIR/web/data/sports-event.db" | cut -f1)"
fi
if [ -d "$APP_DIR/backups" ]; then
  echo "Backups: $(ls "$APP_DIR/backups"/*.db 2>/dev/null | wc -l) files, $(du -sh "$APP_DIR/backups" 2>/dev/null | cut -f1)"
fi

# --- Cron ---
echo ""
echo "--- Cron (gyosei-shobun関連) ---"
crontab -l 2>/dev/null | grep -E '(gyosei|shobun|navi-app)' || echo "(no matching cron entries)"

# --- DB counts ---
echo ""
echo "--- DB counts ---"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER}$"; then
  docker exec "$CONTAINER" node -e "
    const D = require('better-sqlite3');
    const db = new D('$DB_PATH', { readonly: true });
    const rows = db.prepare(\`
      SELECT
        industry,
        COUNT(*) as total,
        SUM(CASE WHEN is_published = 1 THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN detail IS NOT NULL AND detail != '' THEN 1 ELSE 0 END) as enriched
      FROM administrative_actions
      GROUP BY industry
      ORDER BY industry
    \`).all();
    console.log('industry           | total | published | enriched');
    console.log('-------------------|-------|-----------|--------');
    rows.forEach(r => {
      const ind = (r.industry || 'unknown').padEnd(18);
      console.log(ind + ' | ' + String(r.total).padStart(5) + ' | ' + String(r.published).padStart(9) + ' | ' + String(r.enriched).padStart(8));
    });
    const all = db.prepare('SELECT COUNT(*) as c FROM administrative_actions').get();
    console.log('-------------------|-------|-----------|--------');
    console.log('TOTAL              | ' + String(all.c).padStart(5) + ' |           |');
    db.close();
  " || echo "DB query failed"
else
  echo "(skipped — container '$CONTAINER' is not running)"
fi

echo ""
echo "=========================================="
echo "  完了"
echo "=========================================="
