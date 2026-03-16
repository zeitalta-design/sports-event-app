import { getDb } from "@/lib/db";
import { getEventActivityMetrics, getAllEventActivityMetrics } from "@/lib/event-activity";
import { getEventDisplayStatus } from "@/lib/entry-status";

/**
 * Phase45: 人気指数計算ライブラリ
 *
 * 人気指数 = 直近30日のユーザー行動から算出
 * - 閲覧数 × 1
 * - お気に入り追加数 × 8
 * - エントリークリック数 × 12
 */

const WEIGHTS = {
  detail_views: 1,
  favorites: 8,
  entry_clicks: 12,
};

const SCORE_DIVISOR = 10;
const SCORE_MAX = 100;

/**
 * メトリクスから人気指数スコアを計算
 * @param {{ detail_views: number, favorites: number, entry_clicks: number }} metrics
 * @returns {{ raw_score: number, popularity_score: number }}
 */
export function calculatePopularityScore(metrics) {
  const rawScore =
    (metrics.detail_views || 0) * WEIGHTS.detail_views +
    (metrics.favorites || 0) * WEIGHTS.favorites +
    (metrics.entry_clicks || 0) * WEIGHTS.entry_clicks;

  const popularityScore = Math.min(
    SCORE_MAX,
    Math.round(rawScore / SCORE_DIVISOR)
  );

  return { raw_score: rawScore, popularity_score: popularityScore };
}

/**
 * スコアからラベルを判定
 * @param {number} score - 0〜100
 * @returns {{ key: string, label: string } | null}
 */
export function getPopularityLabel(score) {
  if (score >= 80) return { key: "popular", label: "人気大会" };
  if (score >= 60) return { key: "featured", label: "注目大会" };
  if (score >= 40) return { key: "rising", label: "関心上昇" };
  return null;
}

/**
 * 単一大会の人気指数を取得
 * @param {number} eventId
 * @param {Object} [options]
 * @param {number} [options.days=30]
 * @returns {Object} 人気指数データ
 */
export function getEventPopularity(eventId, { days = 30 } = {}) {
  const metrics = getEventActivityMetrics(eventId, days);
  const { raw_score, popularity_score } = calculatePopularityScore(metrics);
  const label = getPopularityLabel(popularity_score);

  return {
    event_id: eventId,
    detail_views_30d: metrics.detail_views,
    favorites_30d: metrics.favorites,
    entry_clicks_30d: metrics.entry_clicks,
    raw_score,
    popularity_score,
    popularity_label: label?.label || null,
    popularity_key: label?.key || null,
    period_days: days,
  };
}

/**
 * 人気大会ランキングを取得（行動ログ＋既存お気に入り数ハイブリッド）
 *
 * 行動ログが少ない初期段階では既存のfavorites数も加味して
 * 安定したランキングを返す。
 *
 * @param {Object} options
 * @param {number} [options.limit=5]
 * @param {number} [options.days=30]
 * @returns {Array} イベント一覧（人気順）
 */
export function getPopularEvents({ limit = 5, days = 30, sportType = null } = {}) {
  try {
    const db = getDb();

    // 1. 行動ログベースのメトリクスを全大会分取得
    const activityMap = getAllEventActivityMetrics({ days, limit: 500 });

    // 2. 大会情報を取得（未来開催＋アクティブ）
    const sportFilter = sportType ? "AND e.sport_type = ?" : "";
    const queryParams = sportType ? [sportType] : [];
    const events = db
      .prepare(
        `SELECT e.id, e.title, e.event_date, e.entry_end_date,
                e.entry_start_date, e.prefecture, e.city, e.venue_name,
                e.entry_status, e.sport_type, e.hero_image_url, e.description,
                (SELECT COUNT(*) FROM favorites f WHERE f.event_id = e.id) as fav_count,
                (SELECT COUNT(*) FROM event_reviews rv WHERE rv.event_id = e.id) as review_count,
                (SELECT GROUP_CONCAT(d, ',') FROM (
                  SELECT DISTINCT CAST(er.distance_km AS TEXT) as d
                  FROM event_races er WHERE er.event_id = e.id AND er.distance_km IS NOT NULL
                )) as distance_list
         FROM events e
         WHERE e.is_active = 1
           AND e.event_date >= date('now')
           ${sportFilter}
         ORDER BY e.event_date ASC`
      )
      .all(...queryParams);

    // 3. 各大会にスコア計算
    const scored = events.map((event) => {
      const activity = activityMap.get(event.id) || {
        detail_views: 0,
        favorites: 0,
        entry_clicks: 0,
      };

      // 行動ログのfavorite_addが無い場合、既存fav_countをフォールバック
      const favoritesForScore =
        activity.favorites > 0 ? activity.favorites : event.fav_count;

      const metrics = {
        detail_views: activity.detail_views,
        favorites: favoritesForScore,
        entry_clicks: activity.entry_clicks,
      };

      const { raw_score, popularity_score } = calculatePopularityScore(metrics);
      const label = getPopularityLabel(popularity_score);

      // 受付状態を再計算
      const ds = getEventDisplayStatus(event);

      return {
        ...event,
        entry_status: ds.status,
        detail_views_30d: activity.detail_views,
        favorites_30d: activity.favorites,
        entry_clicks_30d: activity.entry_clicks,
        raw_score,
        popularity_score,
        popularity_label: label?.label || null,
        popularity_key: label?.key || null,
      };
    });

    // 4. ソート: popularity_score DESC → entry_clicks DESC → favorites DESC → 新しい大会優先
    scored.sort((a, b) => {
      // 受付中優先
      const aOpen = a.entry_status === "open" ? 0 : 1;
      const bOpen = b.entry_status === "open" ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;

      if (b.popularity_score !== a.popularity_score)
        return b.popularity_score - a.popularity_score;
      if (b.entry_clicks_30d !== a.entry_clicks_30d)
        return b.entry_clicks_30d - a.entry_clicks_30d;
      if (b.favorites_30d !== a.favorites_30d)
        return b.favorites_30d - a.favorites_30d;
      return b.id - a.id; // 新しい大会優先
    });

    return scored.slice(0, limit);
  } catch (err) {
    console.error("getPopularEvents error:", err);
    return [];
  }
}
