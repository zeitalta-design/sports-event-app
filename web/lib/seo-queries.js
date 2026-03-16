import { getDb } from "@/lib/db";

/**
 * SEOページ用のDB直接クエリ (Server Component用)
 *
 * Phase53: sportType パラメータ追加で marathon/trail 両対応
 * デフォルトは "marathon" で後方互換を維持。
 */

const EVENT_SELECT = `
  SELECT e.*,
    (SELECT GROUP_CONCAT(d, ',') FROM (
       SELECT DISTINCT CAST(er.distance_km AS TEXT) as d
       FROM event_races er WHERE er.event_id = e.id AND er.distance_km IS NOT NULL
     )) as distance_list
  FROM events e
`;

/** 都道府県別の大会取得 */
export function getEventsByPrefecture(prefectureName, sportType = "marathon") {
  const db = getDb();
  const events = db.prepare(`
    ${EVENT_SELECT}
    WHERE e.is_active = 1 AND e.sport_type = ? AND e.prefecture = ?
    ORDER BY e.event_date ASC
  `).all(sportType, prefectureName);
  return events;
}

/** 距離別の大会取得 */
export function getEventsByDistance(rangeMin, rangeMax, sportType = "marathon") {
  const db = getDb();
  const events = db.prepare(`
    ${EVENT_SELECT}
    JOIN event_races er_filter ON er_filter.event_id = e.id
    WHERE e.is_active = 1 AND e.sport_type = ?
      AND er_filter.distance_km >= ? AND er_filter.distance_km <= ?
    GROUP BY e.id
    ORDER BY e.event_date ASC
  `).all(sportType, rangeMin, rangeMax);
  return events;
}

/** 月別の大会取得 */
export function getEventsByMonth(month, sportType = "marathon") {
  const db = getDb();
  const events = db.prepare(`
    ${EVENT_SELECT}
    WHERE e.is_active = 1 AND e.sport_type = ? AND e.event_month = ?
    ORDER BY e.event_date ASC
  `).all(sportType, String(month));
  return events;
}

/** sitemap用: 実データのある都道府県一覧 */
export function getPrefecturesWithEvents(sportType = "marathon") {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT prefecture FROM events
    WHERE is_active = 1 AND sport_type = ? AND prefecture IS NOT NULL AND prefecture != ''
    ORDER BY prefecture
  `).all(sportType).map(r => r.prefecture);
}

/** sitemap用: 実データのある月一覧 */
export function getMonthsWithEvents(sportType = "marathon") {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT event_month FROM events
    WHERE is_active = 1 AND sport_type = ? AND event_month IS NOT NULL AND event_month != ''
    ORDER BY CAST(event_month AS INTEGER)
  `).all(sportType).map(r => r.event_month);
}
