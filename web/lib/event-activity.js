import { getDb } from "@/lib/db";

/**
 * Phase45+97: 行動ログ記録ライブラリ
 *
 * action_type:
 *   detail_view          — 大会詳細閲覧
 *   favorite_add         — お気に入り追加
 *   favorite_remove      — お気に入り解除
 *   entry_click          — エントリー導線クリック
 *   recommendation_click — おすすめからクリック (Phase97)
 *   compare_add          — 比較に追加 (Phase97)
 *   compare_view         — 比較ページ表示 (Phase97)
 *   save_add             — 保存に追加 (Phase97)
 *   cta_click            — CTA（エントリー/公式）クリック (Phase97)
 *   next_race_view       — /next-race ページ表示 (Phase97)
 */

const VALID_ACTIONS = [
  "detail_view",
  "favorite_add",
  "favorite_remove",
  "entry_click",
  // Phase97: 新規アクション
  "recommendation_click",
  "compare_add",
  "compare_view",
  "save_add",
  "cta_click",
  "next_race_view",
  // Phase105: 計測強化
  "signup_cta_click",
  "login_cta_click",
  "benefits_view",
  "pricing_view",
  "status_change",
  "memo_save",
  "alert_filter",
  "alert_pin",
  "alert_action_click",
  "upgrade_prompt_view",
  "upgrade_prompt_click",
];

/**
 * 行動ログを記録する
 * @param {Object} params
 * @param {number} params.eventId - 大会ID（必須）
 * @param {string} params.actionType - アクション種別（必須）
 * @param {string} [params.userKey] - ユーザー識別子
 * @param {string} [params.sessionId] - セッションID
 * @param {string} [params.sourcePage] - 記録元ページ
 * @param {Object} [params.metadata] - 拡張メタデータ
 * @returns {{ ok: boolean, skipped?: boolean, error?: string }}
 */
export function recordEventActivity({
  eventId,
  actionType,
  userKey = null,
  sessionId = null,
  sourcePage = null,
  metadata = null,
}) {
  try {
    if (!eventId || !actionType) {
      return { ok: false, error: "eventId and actionType required" };
    }

    if (!VALID_ACTIONS.includes(actionType)) {
      return { ok: false, error: `Invalid actionType: ${actionType}` };
    }

    const db = getDb();

    // detail_view: 同一セッション+同一大会で5分以内は重複スキップ
    if (actionType === "detail_view" && sessionId) {
      const recent = db
        .prepare(
          `SELECT id FROM event_activity_logs
           WHERE event_id = ? AND action_type = 'detail_view' AND session_id = ?
           AND created_at > datetime('now', '-5 minutes')
           LIMIT 1`
        )
        .get(eventId, sessionId);
      if (recent) {
        return { ok: true, skipped: true };
      }
    }

    const metadataJson = metadata ? JSON.stringify(metadata) : null;

    db.prepare(
      `INSERT INTO event_activity_logs
       (event_id, action_type, user_key, session_id, source_page, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(eventId, actionType, userKey, sessionId, sourcePage, metadataJson);

    return { ok: true };
  } catch (err) {
    console.error("recordEventActivity error:", err);
    return { ok: false, error: err.message };
  }
}

/**
 * 大会ごとのアクティビティ集計を取得（直近N日）
 * @param {number} eventId
 * @param {number} [days=30]
 * @returns {{ detail_views: number, favorites: number, entry_clicks: number }}
 */
export function getEventActivityMetrics(eventId, days = 30) {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT action_type, COUNT(*) as cnt
         FROM event_activity_logs
         WHERE event_id = ?
           AND created_at >= datetime('now', ? || ' days')
         GROUP BY action_type`
      )
      .all(eventId, `-${days}`);

    const metrics = {
      detail_views: 0,
      favorites: 0,
      entry_clicks: 0,
    };

    for (const row of rows) {
      if (row.action_type === "detail_view") metrics.detail_views = row.cnt;
      if (row.action_type === "favorite_add") metrics.favorites = row.cnt;
      if (row.action_type === "entry_click") metrics.entry_clicks = row.cnt;
    }

    return metrics;
  } catch (err) {
    console.error("getEventActivityMetrics error:", err);
    return { detail_views: 0, favorites: 0, entry_clicks: 0 };
  }
}

/**
 * 全大会のアクティビティ集計を一括取得（直近N日）
 * 人気順ランキング用
 *
 * Phase220: 30分間のインメモリキャッシュを追加（重いクエリのため）
 *
 * @param {Object} options
 * @param {number} [options.days=30]
 * @param {number} [options.limit=50]
 * @returns {Map<number, { detail_views: number, favorites: number, entry_clicks: number }>}
 */
const _metricsCache = { data: null, expiry: 0, key: "" };
const CACHE_TTL_MS = 30 * 60 * 1000; // 30分

export function getAllEventActivityMetrics({ days = 30, limit = 50 } = {}) {
  try {
    const cacheKey = `${days}-${limit}`;
    const now = Date.now();

    // キャッシュが有効ならそのまま返す
    if (_metricsCache.data && _metricsCache.key === cacheKey && now < _metricsCache.expiry) {
      return _metricsCache.data;
    }

    const db = getDb();
    const rows = db
      .prepare(
        `SELECT event_id, action_type, COUNT(*) as cnt
         FROM event_activity_logs
         WHERE created_at >= datetime('now', ? || ' days')
         GROUP BY event_id, action_type`
      )
      .all(`-${days}`);

    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.event_id)) {
        map.set(row.event_id, { detail_views: 0, favorites: 0, entry_clicks: 0 });
      }
      const m = map.get(row.event_id);
      if (row.action_type === "detail_view") m.detail_views = row.cnt;
      if (row.action_type === "favorite_add") m.favorites = row.cnt;
      if (row.action_type === "entry_click") m.entry_clicks = row.cnt;
    }

    // キャッシュに保存
    _metricsCache.data = map;
    _metricsCache.expiry = now + CACHE_TTL_MS;
    _metricsCache.key = cacheKey;

    return map;
  } catch (err) {
    console.error("getAllEventActivityMetrics error:", err);
    return new Map();
  }
}
