import { getDb } from "@/lib/db";
import { REGIONS } from "@/lib/constants";
import { DISTANCE_SLUGS, TRAIL_DISTANCE_SLUGS } from "@/lib/seo-mappings";

/**
 * SEOページ用のDB直接クエリ (Server Component用)
 *
 * Phase53: sportType パラメータ追加で marathon/trail 両対応
 * Phase108: region / theme / season クエリ追加
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

// ==============================
// Phase108: 新規クエリ
// ==============================

/** 地方別の大会取得 */
export function getEventsByRegion(regionKey, sportType = "marathon") {
  const region = REGIONS.find((r) => r.key === regionKey);
  if (!region || region.prefectures.length === 0) return [];
  const db = getDb();
  const placeholders = region.prefectures.map(() => "?").join(",");
  return db.prepare(`
    ${EVENT_SELECT}
    WHERE e.is_active = 1 AND e.sport_type = ? AND e.prefecture IN (${placeholders})
    ORDER BY e.event_date ASC
  `).all(sportType, ...region.prefectures);
}

/** 地方×距離のクロスフィルタ */
export function getEventsByRegionAndDistance(regionKey, distanceSlug, sportType = "marathon") {
  const region = REGIONS.find((r) => r.key === regionKey);
  const distanceSlugs = sportType === "trail" ? TRAIL_DISTANCE_SLUGS : DISTANCE_SLUGS;
  const distanceInfo = distanceSlugs[distanceSlug];
  if (!region || !distanceInfo) return [];
  const db = getDb();
  const placeholders = region.prefectures.map(() => "?").join(",");
  const [rangeMin, rangeMax] = distanceInfo.range;
  return db.prepare(`
    ${EVENT_SELECT}
    JOIN event_races er_filter ON er_filter.event_id = e.id
    WHERE e.is_active = 1 AND e.sport_type = ?
      AND e.prefecture IN (${placeholders})
      AND er_filter.distance_km >= ? AND er_filter.distance_km <= ?
    GROUP BY e.id
    ORDER BY e.event_date ASC
  `).all(sportType, ...region.prefectures, rangeMin, rangeMax);
}

/** 季節別の大会取得 */
export function getEventsBySeason(seasonMonths, sportType = "marathon") {
  if (!seasonMonths || seasonMonths.length === 0) return [];
  const db = getDb();
  const placeholders = seasonMonths.map(() => "?").join(",");
  const monthStrings = seasonMonths.map(String);
  return db.prepare(`
    ${EVENT_SELECT}
    WHERE e.is_active = 1 AND e.sport_type = ? AND e.event_month IN (${placeholders})
    ORDER BY e.event_date ASC
  `).all(sportType, ...monthStrings);
}

/** テーマ別の大会取得 */
export function getEventsByTheme(themeKey, sportType = "marathon") {
  const db = getDb();
  switch (themeKey) {
    case "open":
      return db.prepare(`
        ${EVENT_SELECT}
        WHERE e.is_active = 1 AND e.sport_type = ? AND e.entry_status = 'open'
        ORDER BY e.event_date ASC
      `).all(sportType);

    case "deadline":
      return db.prepare(`
        ${EVENT_SELECT}
        WHERE e.is_active = 1 AND e.sport_type = ?
          AND e.entry_status = 'open'
          AND e.entry_end_date IS NOT NULL
          AND e.entry_end_date >= date('now')
          AND e.entry_end_date <= date('now', '+14 days')
        ORDER BY e.entry_end_date ASC
      `).all(sportType);

    case "popular":
      return db.prepare(`
        ${EVENT_SELECT}
        LEFT JOIN (
          SELECT event_id, COUNT(*) as view_count
          FROM event_activity_logs
          WHERE action_type = 'detail_view'
          GROUP BY event_id
        ) al ON al.event_id = e.id
        WHERE e.is_active = 1 AND e.sport_type = ?
        ORDER BY COALESCE(al.view_count, 0) DESC
        LIMIT 100
      `).all(sportType);

    case "beginner":
      return db.prepare(`
        ${EVENT_SELECT}
        WHERE e.is_active = 1 AND e.sport_type = ?
          AND (e.description LIKE '%初心者%' OR e.description LIKE '%ビギナー%' OR e.description LIKE '%初めて%'
               OR e.title LIKE '%初心者%' OR e.title LIKE '%ファンラン%' OR e.title LIKE '%fun run%')
        ORDER BY e.event_date ASC
      `).all(sportType);

    case "flat-course":
      return db.prepare(`
        ${EVENT_SELECT}
        LEFT JOIN marathon_details md ON md.event_id = e.id
        WHERE e.is_active = 1 AND e.sport_type = ?
          AND (e.description LIKE '%フラット%' OR e.description LIKE '%平坦%'
               OR md.features_json LIKE '%フラット%' OR md.features_json LIKE '%平坦%'
               OR md.course_description LIKE '%フラット%' OR md.course_description LIKE '%平坦%')
        ORDER BY e.event_date ASC
      `).all(sportType);

    case "record":
      return db.prepare(`
        ${EVENT_SELECT}
        LEFT JOIN marathon_details md ON md.event_id = e.id
        WHERE e.is_active = 1 AND e.sport_type = ?
          AND (e.description LIKE '%記録%' OR e.description LIKE '%タイム%' OR e.description LIKE '%自己ベスト%' OR e.description LIKE '%PB%'
               OR md.features_json LIKE '%記録%' OR md.features_json LIKE '%高速%')
        ORDER BY e.event_date ASC
      `).all(sportType);

    case "sightseeing":
      return db.prepare(`
        ${EVENT_SELECT}
        LEFT JOIN marathon_details md ON md.event_id = e.id
        WHERE e.is_active = 1 AND e.sport_type = ?
          AND (e.description LIKE '%観光%' OR e.description LIKE '%景色%' OR e.description LIKE '%絶景%'
               OR md.features_json LIKE '%観光%' OR md.features_json LIKE '%景色%' OR md.features_json LIKE '%絶景%')
        ORDER BY e.event_date ASC
      `).all(sportType);

    default:
      return [];
  }
}

/** 人気大会（上位N件） */
export function getPopularEvents(limit = 5, sportType = "marathon") {
  const db = getDb();
  return db.prepare(`
    ${EVENT_SELECT}
    LEFT JOIN (
      SELECT event_id, COUNT(*) as view_count
      FROM event_activity_logs
      WHERE action_type = 'detail_view'
      GROUP BY event_id
    ) al ON al.event_id = e.id
    WHERE e.is_active = 1 AND e.sport_type = ?
    ORDER BY COALESCE(al.view_count, 0) DESC
    LIMIT ?
  `).all(sportType, limit);
}

/** スポーツ別の距離slug定義を取得 */
export function getDistanceSlugsForSport(sportType = "marathon") {
  return sportType === "trail" ? TRAIL_DISTANCE_SLUGS : DISTANCE_SLUGS;
}

/** 締切間近大会（上位N件） */
export function getDeadlineEvents(limit = 5, sportType = "marathon") {
  const db = getDb();
  return db.prepare(`
    ${EVENT_SELECT}
    WHERE e.is_active = 1 AND e.sport_type = ?
      AND e.entry_status = 'open'
      AND e.entry_end_date IS NOT NULL
      AND e.entry_end_date >= date('now')
    ORDER BY e.entry_end_date ASC
    LIMIT ?
  `).all(sportType, limit);
}
