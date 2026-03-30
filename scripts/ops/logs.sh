#!/usr/bin/env bash
# logs.sh — 運用ログの tail 表示
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/app}"
LINES="${1:-100}"

echo "=========================================="
echo "  ログ確認 (最新 ${LINES} 行)  $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "=========================================="

# --- gyosei-shobun fetch log ---
LOG_FETCH="$APP_DIR/logs/gyosei-shobun.log"
if [ -f "$LOG_FETCH" ]; then
  echo ""
  echo "--- $LOG_FETCH ---"
  echo "(size: $(du -h "$LOG_FETCH" | cut -f1), modified: $(stat -c '%y' "$LOG_FETCH" 2>/dev/null || stat -f '%Sm' "$LOG_FETCH" 2>/dev/null || echo 'N/A'))"
  tail -n "$LINES" "$LOG_FETCH"
else
  echo ""
  echo "--- $LOG_FETCH --- (not found)"
fi

# --- gyosei-shobun enrich log ---
LOG_ENRICH="$APP_DIR/logs/gyosei-shobun-enrich.log"
if [ -f "$LOG_ENRICH" ]; then
  echo ""
  echo "--- $LOG_ENRICH ---"
  echo "(size: $(du -h "$LOG_ENRICH" | cut -f1), modified: $(stat -c '%y' "$LOG_ENRICH" 2>/dev/null || stat -f '%Sm' "$LOG_ENRICH" 2>/dev/null || echo 'N/A'))"
  tail -n "$LINES" "$LOG_ENRICH"
else
  echo ""
  echo "--- $LOG_ENRICH --- (not found)"
fi

# --- docker logs (last 50 lines) ---
CONTAINER="${CONTAINER:-navi-app}"
echo ""
echo "--- docker logs $CONTAINER (last 50) ---"
docker logs --tail 50 "$CONTAINER" 2>&1 || echo "(container logs unavailable)"

echo ""
echo "=========================================="
echo "  完了"
echo "=========================================="
