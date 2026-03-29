#!/bin/bash
# ============================================
# gyosei-shobun summary/detail品質強化 cron 設定スクリプト
# ============================================
#
# 使い方:
#   ssh ubuntu@<VPS_HOST>
#   cd /opt/app && bash scripts/setup-cron-gyosei-shobun-enrich.sh
#
# 巡回頻度:
#   MLIT行政処分 enrich: 月1回（毎月1日 午前6時00分）
#   ※ fetch cron（05:20）の40分後に実行
#
# 安全方針:
#   - --only-thin 固定（薄いレコードのみ対象）
#   - flock で二重実行防止（fetch とは別の lock ファイル）
#   - ログは /opt/app/logs/ に専用ファイルで追記
#   - 既存 fetch cron は一切変更しない
#   - fetch cron と lock ファイルが別なので干渉しない
#
# 前提:
#   - fetch cron が setup-cron-gyosei-shobun.sh で登録済み
#   - enrich-gyosei-shobun-details.js が /app/web/scripts/ に存在
#   - 実行には約10〜15分かかる（MLIT詳細ページへの1.2秒間隔アクセス）

CONTAINER="navi-app"
LOG_DIR="/opt/app/logs"
LOCK_FILE="/tmp/gyosei-shobun-enrich.lock"
DOCKER_BIN=$(which docker)

mkdir -p "${LOG_DIR}"

# マーカー（fetch cron とは別マーカー）
CRON_MARKER="# gyosei-shobun-enrich"

# 既存の enrich cron を除去して再設定（fetch cron は触らない）
CURRENT_CRON=$(crontab -l 2>/dev/null | grep -v "${CRON_MARKER}" || true)

# 新しい crontab を構成
NEW_CRON="${CURRENT_CRON}

# ============================================ ${CRON_MARKER}
# 行政処分DB summary/detail品質強化（月1回）  ${CRON_MARKER}
# ============================================ ${CRON_MARKER}
#                                               ${CRON_MARKER}
# enrich: 毎月1日 午前6時00分 JST               ${CRON_MARKER}
# ※ fetch cron（05:20）完了後に実行             ${CRON_MARKER}
0 6 1 * * flock -n ${LOCK_FILE} ${DOCKER_BIN} exec ${CONTAINER} node /app/web/scripts/enrich-gyosei-shobun-details.js --only-thin >> ${LOG_DIR}/gyosei-shobun-enrich.log 2>&1 ${CRON_MARKER}
"

echo "${NEW_CRON}" | crontab -

echo "✅ gyosei-shobun enrich cron 設定完了:"
echo ""
echo "  品質強化:     毎月1日 (午前6時00分)"
echo "  モード:       --only-thin (薄いレコードのみ)"
echo "  二重実行防止: flock ${LOCK_FILE}"
echo "  ログ:         ${LOG_DIR}/gyosei-shobun-enrich.log"
echo ""
echo "  ※ fetch cron (05:20) → enrich cron (06:00) の2段構成"
echo "  ※ fetch cron は変更していません"
echo ""
echo "確認: crontab -l | grep gyosei"
echo "ログ: tail -50 ${LOG_DIR}/gyosei-shobun-enrich.log"
echo ""
echo "=== 停止・解除方法 ==="
echo "  一時停止:   crontab -l | grep -v '${CRON_MARKER}' | crontab -"
echo "  手動実行:   sudo ${DOCKER_BIN} exec ${CONTAINER} node /app/web/scripts/enrich-gyosei-shobun-details.js --only-thin"
echo "  dry-run:    sudo ${DOCKER_BIN} exec ${CONTAINER} node /app/web/scripts/enrich-gyosei-shobun-details.js --dry-run --limit=3"
echo ""
echo "=== 2段構成の全体像 ==="
echo "  05:20  fetch   → 新規処分データを一覧から取得・投入"
echo "  06:00  enrich  → 薄い summary/detail を詳細ページから補完"
