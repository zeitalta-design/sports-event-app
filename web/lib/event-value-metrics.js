/**
 * Phase133: 大会価値指標サービス
 *
 * event_activity_logs からイベントのエンゲージメント指標を集計。
 * 管理画面・将来の運営ダッシュボード向け。
 */

import { getDb } from "./db";
import { calculatePopularityScore, getPopularityLabel } from "./event-popularity";

/**
 * 単一イベントの価値指標を集計
 */
export function getEventValueMetrics(eventId, days = 30) {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString();

  const row = db.prepare(`
    SELECT
      COUNT(CASE WHEN action_type = 'detail_view' THEN 1 END) as page_views,
      COUNT(CASE WHEN action_type = 'favorite_add' THEN 1 END) as favorites,
      COUNT(CASE WHEN action_type = 'save_add' THEN 1 END) as saves,
      COUNT(CASE WHEN action_type = 'compare_add' THEN 1 END) as compares,
      COUNT(CASE WHEN action_type = 'entry_click' THEN 1 END) as entry_clicks,
      COUNT(CASE WHEN action_type = 'cta_click' THEN 1 END) as cta_clicks,
      COUNT(CASE WHEN action_type = 'recommendation_click' THEN 1 END) as recommendation_clicks
    FROM event_activity_logs
    WHERE event_id = ? AND created_at >= ?
  `).get(eventId, sinceStr);

  const metrics = {
    detail_views: row?.page_views || 0,
    favorites: row?.favorites || 0,
    entry_clicks: row?.entry_clicks || 0,
  };
  const { popularity_score } = calculatePopularityScore(metrics);
  const popLabel = getPopularityLabel(popularity_score);

  return {
    event_id: eventId,
    period_days: days,
    page_views: row?.page_views || 0,
    favorites: row?.favorites || 0,
    saves: row?.saves || 0,
    compares: row?.compares || 0,
    entry_clicks: row?.entry_clicks || 0,
    cta_clicks: row?.cta_clicks || 0,
    recommendation_clicks: row?.recommendation_clicks || 0,
    popularity_score,
    popularity_label: popLabel?.label || null,
  };
}

/**
 * エンゲージメント上位イベントを取得
 */
export function getTopEventsByEngagement({ days = 30, limit = 50, sportType = "" } = {}) {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString();

  const sportFilter = sportType ? "AND e.sport_type = ?" : "";
  const sportParam = sportType ? [sportType] : [];

  const rows = db.prepare(`
    SELECT
      e.id, e.title, e.sport_type, e.prefecture, e.event_date,
      e.entry_status, e.organizer_verified,
      COUNT(CASE WHEN al.action_type = 'detail_view' THEN 1 END) as page_views,
      COUNT(CASE WHEN al.action_type = 'favorite_add' THEN 1 END) as favorites,
      COUNT(CASE WHEN al.action_type = 'save_add' THEN 1 END) as saves,
      COUNT(CASE WHEN al.action_type = 'compare_add' THEN 1 END) as compares,
      COUNT(CASE WHEN al.action_type = 'entry_click' THEN 1 END) as entry_clicks,
      COUNT(CASE WHEN al.action_type = 'cta_click' THEN 1 END) as cta_clicks
    FROM events e
    LEFT JOIN event_activity_logs al ON al.event_id = e.id AND al.created_at >= ?
    WHERE e.is_active = 1 ${sportFilter}
    GROUP BY e.id
    HAVING page_views > 0 OR favorites > 0 OR entry_clicks > 0
    ORDER BY (page_views + favorites * 8 + entry_clicks * 12) DESC
    LIMIT ?
  `).all(sinceStr, ...sportParam, limit);

  return rows.map((row) => {
    const metrics = {
      detail_views: row.page_views,
      favorites: row.favorites,
      entry_clicks: row.entry_clicks,
    };
    const { popularity_score } = calculatePopularityScore(metrics);
    return { ...row, popularity_score };
  });
}
