/**
 * Phase80: 監視優先度エンジン
 *
 * 各大会の「監視優先度スコア」を算出し、
 * 限られたクロール枠で最も重要な大会を優先的に再確認する。
 *
 * スコア要素:
 *   1. 締切日の近さ（0〜40点）
 *   2. お気に入り数（0〜20点）
 *   3. 比較リスト追加数（0〜10点）
 *   4. 通知設定者数（0〜10点）
 *   5. 人気度（0〜10点）
 *   6. 最近の状態変化（0〜10点）
 *   7. 最終確認からの経過（0〜20点）
 *   8. 現在の official_entry_status（ボーナス/ペナルティ）
 *
 * 合計: 最大 ~120点。高い方が優先。
 */

import { getDb } from "@/lib/db";

// ── スコア定数 ──

const DEADLINE_MAX_SCORE = 40;
const FAVORITES_MAX_SCORE = 20;
const COMPARE_MAX_SCORE = 10;
const ALERT_MAX_SCORE = 10;
const POPULARITY_MAX_SCORE = 10;
const RECENT_CHANGE_SCORE = 10;
const STALENESS_MAX_SCORE = 20;

// ── メイン関数 ──

/**
 * 監視対象の大会を優先度スコア付きで取得する
 *
 * @param {object} [options]
 * @param {number} [options.limit=50]
 * @param {boolean} [options.includeEnded=false]
 * @returns {Array<{event: object, priorityScore: number, priorityFactors: object}>}
 */
export function getMonitorTargetsWithPriority(options = {}) {
  const db = getDb();
  const limit = options.limit || 50;

  // 候補を広めに取得（スコアでソートするため3倍取得）
  const candidates = db
    .prepare(`
      SELECT e.id, e.title, e.source_url, e.source_site, e.entry_status,
             e.event_date, e.entry_start_date, e.entry_end_date,
             e.entry_signals_json, e.urgency_label, e.urgency_level,
             e.last_verified_at, e.monitor_error_count, e.description,
             e.official_entry_status, e.official_checked_at,
             e.official_status_confidence, e.popularity_score,
             COALESCE(fav.fav_count, 0) as fav_count
      FROM events e
      LEFT JOIN (
        SELECT event_id, COUNT(*) as fav_count
        FROM favorites
        GROUP BY event_id
      ) fav ON fav.event_id = e.id
      WHERE e.is_active = 1
        AND e.source_url IS NOT NULL
        AND e.source_url != ''
        ${options.includeEnded ? "" : "AND (e.event_date IS NULL OR e.event_date >= date('now', '-1 day'))"}
        AND (
          e.official_checked_at IS NULL
          OR e.official_checked_at < datetime('now', '-2 hours')
        )
      ORDER BY e.last_verified_at ASC NULLS FIRST
      LIMIT ?
    `)
    .all(limit * 3);

  // 直近の状態変化イベントIDを取得
  const recentChangeIds = new Set(
    db.prepare(`
      SELECT DISTINCT event_id
      FROM entry_status_changes
      WHERE created_at >= datetime('now', '-24 hours')
    `).all().map(r => r.event_id)
  );

  // 各候補にスコアを付与
  const now = new Date();
  const scored = candidates.map(event => {
    const factors = {};
    let score = 0;

    // 1. 締切日の近さ
    factors.deadline = calcDeadlineScore(event, now);
    score += factors.deadline;

    // 2. お気に入り数
    factors.favorites = Math.min(FAVORITES_MAX_SCORE, event.fav_count * 4);
    score += factors.favorites;

    // 3. 通知設定者（fav_count で代用、比較リストは未実装のため統合）
    factors.alerts = Math.min(ALERT_MAX_SCORE + COMPARE_MAX_SCORE, event.fav_count * 5);
    score += factors.alerts;

    // 5. 人気度
    factors.popularity = calcPopularityScore(event);
    score += factors.popularity;

    // 6. 最近の状態変化
    factors.recentChange = recentChangeIds.has(event.id) ? RECENT_CHANGE_SCORE : 0;
    score += factors.recentChange;

    // 7. 最終確認からの経過
    factors.staleness = calcStalenessScore(event, now);
    score += factors.staleness;

    // 8. 現在のステータスボーナス
    factors.statusBonus = calcStatusBonus(event);
    score += factors.statusBonus;

    return { event, priorityScore: Math.round(score), priorityFactors: factors };
  });

  // スコア降順でソート
  scored.sort((a, b) => b.priorityScore - a.priorityScore);

  return scored.slice(0, limit);
}

// ── スコア計算ヘルパー ──

function calcDeadlineScore(event, now) {
  if (!event.entry_end_date) return 5; // 不明 → 少し優先

  const deadline = new Date(event.entry_end_date);
  const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 2;  // 過去 → 低優先
  if (diffDays === 0) return DEADLINE_MAX_SCORE; // 本日締切
  if (diffDays <= 1) return 35;
  if (diffDays <= 3) return 30;
  if (diffDays <= 7) return 25;
  if (diffDays <= 14) return 18;
  if (diffDays <= 30) return 10;
  return 5;
}

function calcPopularityScore(event) {
  const pop = event.popularity_score || 0;
  if (pop >= 80) return POPULARITY_MAX_SCORE;
  if (pop >= 60) return 7;
  if (pop >= 40) return 5;
  if (pop >= 20) return 3;
  return 1;
}

function calcStalenessScore(event, now) {
  if (!event.official_checked_at) return STALENESS_MAX_SCORE; // 未確認 → 最優先

  const lastCheck = new Date(event.official_checked_at);
  const hoursAgo = (now - lastCheck) / (1000 * 60 * 60);

  if (hoursAgo > 168) return STALENESS_MAX_SCORE; // 7日超
  if (hoursAgo > 72) return 15;
  if (hoursAgo > 24) return 10;
  if (hoursAgo > 12) return 5;
  if (hoursAgo > 6) return 2;
  return 0;
}

function calcStatusBonus(event) {
  const status = event.official_entry_status;
  switch (status) {
    case "open":
    case "closing_soon":
      return 10; // 受付中の大会は正確さが最重要
    case "capacity_warning":
      return 15; // 定員間近は最高優先
    case "awaiting_update":
      return 12; // 更新待ちは積極的に再確認
    case "unknown":
      return 8;  // 要確認も優先
    case null:
    case undefined:
      return 5;  // 未判定
    case "full":
    case "closed":
    case "suspended":
      return 0;  // 終了系は低優先
    default:
      return 3;
  }
}

/**
 * 監視優先度のサマリー統計を返す（管理画面用）
 */
export function getMonitorPriorityStats() {
  const db = getDb();

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM events
    WHERE is_active = 1
      AND source_url IS NOT NULL AND source_url != ''
      AND (event_date IS NULL OR event_date >= date('now', '-1 day'))
  `).get();

  const needsCheck = db.prepare(`
    SELECT COUNT(*) as count FROM events
    WHERE is_active = 1
      AND source_url IS NOT NULL AND source_url != ''
      AND (event_date IS NULL OR event_date >= date('now', '-1 day'))
      AND (official_checked_at IS NULL OR official_checked_at < datetime('now', '-6 hours'))
  `).get();

  const stale = db.prepare(`
    SELECT COUNT(*) as count FROM events
    WHERE is_active = 1
      AND source_url IS NOT NULL AND source_url != ''
      AND (event_date IS NULL OR event_date >= date('now', '-1 day'))
      AND (official_checked_at IS NULL OR official_checked_at < datetime('now', '-72 hours'))
  `).get();

  return {
    totalMonitorable: total.count,
    needsCheck: needsCheck.count,
    stale: stale.count,
  };
}
