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

// スコアリング付きクエリ用: SELECT部分（FROM無し）
const EVENT_COLUMNS = `
  e.*,
  (SELECT GROUP_CONCAT(d, ',') FROM (
     SELECT DISTINCT CAST(er.distance_km AS TEXT) as d
     FROM event_races er WHERE er.event_id = e.id AND er.distance_km IS NOT NULL
   )) as distance_list
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
        SELECT ${EVENT_COLUMNS},
          (
            (CASE WHEN e.title LIKE '%初心者%' OR e.title LIKE '%ビギナー%' OR e.title LIKE '%ファンラン%' OR e.title LIKE '%fun run%' THEN 3 ELSE 0 END)
            + (CASE WHEN e.description LIKE '%初心者%' THEN 2 ELSE 0 END)
            + (CASE WHEN e.description LIKE '%ビギナー%' OR e.description LIKE '%初めて%' OR e.description LIKE '%入門%' THEN 1 ELSE 0 END)
            + (CASE WHEN e.description LIKE '%完走%' OR e.description LIKE '%ゆっくり%' THEN 1 ELSE 0 END)
            + (CASE WHEN md.features_json LIKE '%初心者%' OR md.features_json LIKE '%ビギナー%' THEN 2 ELSE 0 END)
            + (CASE WHEN md.level_labels_json LIKE '%初心者%' OR md.level_labels_json LIKE '%ビギナー%' THEN 2 ELSE 0 END)
          ) as theme_score
        FROM events e
        LEFT JOIN marathon_details md ON md.marathon_id = e.id
        WHERE e.is_active = 1 AND e.sport_type = ?
          AND (e.description LIKE '%初心者%' OR e.description LIKE '%ビギナー%' OR e.description LIKE '%初めて%'
               OR e.description LIKE '%入門%' OR e.description LIKE '%完走%' OR e.description LIKE '%ゆっくり%'
               OR e.title LIKE '%初心者%' OR e.title LIKE '%ビギナー%' OR e.title LIKE '%ファンラン%' OR e.title LIKE '%fun run%'
               OR md.features_json LIKE '%初心者%' OR md.features_json LIKE '%ビギナー%'
               OR md.level_labels_json LIKE '%初心者%' OR md.level_labels_json LIKE '%ビギナー%')
        ORDER BY theme_score DESC, e.event_date ASC
      `).all(sportType);

    case "flat-course":
      return db.prepare(`
        ${EVENT_SELECT}
        LEFT JOIN marathon_details md ON md.marathon_id = e.id
        WHERE e.is_active = 1 AND e.sport_type = ?
          AND (e.description LIKE '%フラット%' OR e.description LIKE '%平坦%'
               OR md.features_json LIKE '%フラット%' OR md.features_json LIKE '%平坦%'
               OR md.course_info LIKE '%フラット%' OR md.course_info LIKE '%平坦%')
        ORDER BY e.event_date ASC
      `).all(sportType);

    case "record":
      return db.prepare(`
        ${EVENT_SELECT}
        LEFT JOIN marathon_details md ON md.marathon_id = e.id
        WHERE e.is_active = 1 AND e.sport_type = ?
          AND (e.description LIKE '%記録%' OR e.description LIKE '%タイム%' OR e.description LIKE '%自己ベスト%' OR e.description LIKE '%PB%'
               OR md.features_json LIKE '%記録%' OR md.features_json LIKE '%高速%')
        ORDER BY e.event_date ASC
      `).all(sportType);

    case "sightseeing":
      return db.prepare(`
        SELECT ${EVENT_COLUMNS},
          (
            (CASE WHEN e.title LIKE '%観光%' OR e.title LIKE '%旅ラン%' OR e.title LIKE '%温泉%' THEN 3 ELSE 0 END)
            + (CASE WHEN e.description LIKE '%観光%' THEN 2 ELSE 0 END)
            + (CASE WHEN e.description LIKE '%絶景%' OR e.description LIKE '%景色%' THEN 2 ELSE 0 END)
            + (CASE WHEN e.description LIKE '%温泉%' OR e.description LIKE '%ご当地%' OR e.description LIKE '%グルメ%' THEN 2 ELSE 0 END)
            + (CASE WHEN e.description LIKE '%旅%' THEN 1 ELSE 0 END)
            + (CASE WHEN e.description LIKE '%リゾート%' OR e.description LIKE '%ツアー%' OR e.description LIKE '%海辺%' OR e.description LIKE '%高原%' THEN 1 ELSE 0 END)
            + (CASE WHEN md.features_json LIKE '%観光%' OR md.features_json LIKE '%絶景%' OR md.features_json LIKE '%温泉%' THEN 2 ELSE 0 END)
          ) as theme_score
        FROM events e
        LEFT JOIN marathon_details md ON md.marathon_id = e.id
        WHERE e.is_active = 1 AND e.sport_type = ?
          AND (
            e.description LIKE '%観光%' OR e.description LIKE '%景色%' OR e.description LIKE '%絶景%'
            OR e.description LIKE '%旅%' OR e.description LIKE '%温泉%'
            OR e.description LIKE '%ご当地%' OR e.description LIKE '%グルメ%' OR e.description LIKE '%ツアー%'
            OR e.description LIKE '%リゾート%' OR e.description LIKE '%海辺%' OR e.description LIKE '%高原%'
            OR e.title LIKE '%観光%' OR e.title LIKE '%旅%' OR e.title LIKE '%温泉%' OR e.title LIKE '%ご当地%'
            OR md.features_json LIKE '%観光%' OR md.features_json LIKE '%景色%' OR md.features_json LIKE '%絶景%'
            OR md.features_json LIKE '%旅%' OR md.features_json LIKE '%温泉%'
            OR md.features_json LIKE '%ご当地%' OR md.features_json LIKE '%グルメ%'
          )
        ORDER BY theme_score DESC, e.event_date ASC
      `).all(sportType);

    case "family":
      return db.prepare(`
        SELECT ${EVENT_COLUMNS},
          (
            (CASE WHEN e.title LIKE '%親子%' OR e.title LIKE '%ファミリー%' OR e.title LIKE '%キッズ%' THEN 3 ELSE 0 END)
            + (CASE WHEN er_fam.race_name LIKE '%親子%' OR er_fam.race_name LIKE '%ファミリー%' OR er_fam.race_name LIKE '%キッズ%' THEN 3 ELSE 0 END)
            + (CASE WHEN e.description LIKE '%親子%' OR e.description LIKE '%ファミリー%' THEN 2 ELSE 0 END)
            + (CASE WHEN e.description LIKE '%キッズ%' OR e.description LIKE '%こども%' OR e.description LIKE '%子供%' THEN 1 ELSE 0 END)
            + (CASE WHEN e.description LIKE '%家族%' THEN 1 ELSE 0 END)
            + (CASE WHEN md.features_json LIKE '%親子%' OR md.features_json LIKE '%ファミリー%' OR md.features_json LIKE '%キッズ%' THEN 2 ELSE 0 END)
          ) as theme_score
        FROM events e
        LEFT JOIN marathon_details md ON md.marathon_id = e.id
        LEFT JOIN event_races er_fam ON er_fam.event_id = e.id
        WHERE e.is_active = 1 AND e.sport_type = ?
          AND (
            e.description LIKE '%ファミリー%' OR e.description LIKE '%親子%'
            OR e.description LIKE '%キッズ%' OR e.description LIKE '%こども%'
            OR e.description LIKE '%子供%' OR e.description LIKE '%家族%'
            OR e.title LIKE '%ファミリー%' OR e.title LIKE '%親子%'
            OR e.title LIKE '%キッズ%' OR e.title LIKE '%子供%'
            OR md.features_json LIKE '%ファミリー%' OR md.features_json LIKE '%親子%'
            OR md.features_json LIKE '%キッズ%' OR md.features_json LIKE '%こども%'
            OR md.features_json LIKE '%子供%' OR md.features_json LIKE '%家族%'
            OR er_fam.race_name LIKE '%ファミリー%' OR er_fam.race_name LIKE '%親子%'
            OR er_fam.race_name LIKE '%キッズ%' OR er_fam.race_name LIKE '%こども%'
            OR er_fam.race_name LIKE '%子供%'
          )
        GROUP BY e.id
        ORDER BY theme_score DESC, e.event_date ASC
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
