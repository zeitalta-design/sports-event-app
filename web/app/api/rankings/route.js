import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getEventDisplayStatus } from "@/lib/entry-status";

/**
 * Phase69: ランキングAPI
 *
 * GET /api/rankings?type=popular|beginner|flat|record
 *
 * ランナー向けランキングを返す。
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "popular";
    const limit = Math.min(parseInt(searchParams.get("limit")) || 10, 20);
    const sportType = searchParams.get("sport_type") || ""; // Phase125: スポーツ種別フィルタ

    const db = getDb();
    let events = [];

    // Phase125: スポーツフィルタ共通条件
    const sportFilter = sportType ? "AND e.sport_type = ?" : "";
    const sportParam = sportType ? [sportType] : [];

    switch (type) {
      case "popular":
        // 人気大会: popularity_score 上位
        events = db
          .prepare(`
            SELECT e.id, e.title, e.event_date, e.entry_end_date,
                   e.prefecture, e.city, e.entry_status, e.sport_type,
                   e.distance_list, e.popularity_score, e.description,
                   md.venue_name
            FROM events e
            LEFT JOIN marathon_details md ON e.id = md.event_id
            WHERE e.is_active = 1 AND e.event_date >= date('now')
              ${sportFilter}
            ORDER BY e.popularity_score DESC
            LIMIT ?
          `)
          .all(...sportParam, limit);
        break;

      case "beginner":
        // 初心者向け: 説明文に初心者キーワード
        events = db
          .prepare(`
            SELECT e.id, e.title, e.event_date, e.entry_end_date,
                   e.prefecture, e.city, e.entry_status, e.sport_type,
                   e.distance_list, e.popularity_score, e.description,
                   md.venue_name
            FROM events e
            LEFT JOIN marathon_details md ON e.id = md.event_id
            WHERE e.is_active = 1 AND e.event_date >= date('now')
              ${sportFilter}
              AND (
                e.description LIKE '%初心者%'
                OR e.description LIKE '%ビギナー%'
                OR e.description LIKE '%初めて%'
                OR e.title LIKE '%初心者%'
                OR e.title LIKE '%ファン%'
              )
            ORDER BY e.popularity_score DESC
            LIMIT ?
          `)
          .all(...sportParam, limit);
        break;

      case "flat":
        // フラットコース: 説明文にフラットキーワード（マラソン向け）
        events = db
          .prepare(`
            SELECT e.id, e.title, e.event_date, e.entry_end_date,
                   e.prefecture, e.city, e.entry_status, e.sport_type,
                   e.distance_list, e.popularity_score, e.description,
                   md.venue_name
            FROM events e
            LEFT JOIN marathon_details md ON e.id = md.event_id
            WHERE e.is_active = 1 AND e.event_date >= date('now')
              ${sportFilter}
              AND (
                e.description LIKE '%フラット%'
                OR e.description LIKE '%平坦%'
                OR e.description LIKE '%高低差%少%'
                OR e.title LIKE '%フラット%'
              )
            ORDER BY e.popularity_score DESC
            LIMIT ?
          `)
          .all(...sportParam, limit);
        break;

      case "record":
        // 記録狙い: フルマラソン + 人気上位（マラソン向け）
        events = db
          .prepare(`
            SELECT e.id, e.title, e.event_date, e.entry_end_date,
                   e.prefecture, e.city, e.entry_status, e.sport_type,
                   e.distance_list, e.popularity_score, e.description,
                   md.venue_name
            FROM events e
            LEFT JOIN marathon_details md ON e.id = md.event_id
            WHERE e.is_active = 1 AND e.event_date >= date('now')
              AND e.sport_type = 'marathon'
              AND (
                e.description LIKE '%記録%'
                OR e.description LIKE '%PB%'
                OR e.description LIKE '%自己ベスト%'
                OR e.description LIKE '%公認コース%'
                OR e.description LIKE '%陸連公認%'
                OR (e.distance_list LIKE '%42%' AND (
                  e.description LIKE '%フラット%'
                  OR e.description LIKE '%平坦%'
                ))
              )
            ORDER BY e.popularity_score DESC
            LIMIT ?
          `)
          .all(limit);
        break;

      case "scenic":
        // 絶景コース: トレイル向け
        events = db
          .prepare(`
            SELECT e.id, e.title, e.event_date, e.entry_end_date,
                   e.prefecture, e.city, e.entry_status, e.sport_type,
                   e.distance_list, e.popularity_score, e.description,
                   md.venue_name
            FROM events e
            LEFT JOIN marathon_details md ON e.id = md.event_id
            WHERE e.is_active = 1 AND e.event_date >= date('now')
              ${sportFilter}
              AND (
                e.description LIKE '%絶景%'
                OR e.description LIKE '%景色%'
                OR e.description LIKE '%眺望%'
                OR e.description LIKE '%パノラマ%'
                OR e.title LIKE '%トレイル%'
              )
            ORDER BY e.popularity_score DESC
            LIMIT ?
          `)
          .all(...sportParam, limit);
        break;

      // Phase203: 口コミ評価ランキング
      case "review_top":
        events = db
          .prepare(`
            SELECT e.id, e.title, e.event_date, e.entry_end_date,
                   e.prefecture, e.city, e.entry_status, e.sport_type,
                   e.distance_list, e.popularity_score, e.description,
                   md.venue_name,
                   AVG(COALESCE(r.rating_overall, r.rating)) as avg_rating,
                   COUNT(r.id) as review_count
            FROM events e
            LEFT JOIN marathon_details md ON e.id = md.event_id
            INNER JOIN event_reviews r ON r.event_id = e.id AND (r.status = 'published' OR r.status IS NULL)
            WHERE e.is_active = 1 AND e.event_date >= date('now')
              ${sportFilter}
            GROUP BY e.id
            HAVING review_count >= 2
            ORDER BY avg_rating DESC, review_count DESC
            LIMIT ?
          `)
          .all(...sportParam, limit);
        break;

      // Phase203: 写真が多い大会
      case "photo_rich":
        events = db
          .prepare(`
            SELECT e.id, e.title, e.event_date, e.entry_end_date,
                   e.prefecture, e.city, e.entry_status, e.sport_type,
                   e.distance_list, e.popularity_score, e.description,
                   md.venue_name,
                   COUNT(p.id) as photo_count
            FROM events e
            LEFT JOIN marathon_details md ON e.id = md.event_id
            INNER JOIN event_photos p ON p.event_id = e.id AND (p.status = 'published' OR p.status IS NULL)
            WHERE e.is_active = 1 AND e.event_date >= date('now')
              ${sportFilter}
            GROUP BY e.id
            HAVING photo_count >= 1
            ORDER BY photo_count DESC, e.popularity_score DESC
            LIMIT ?
          `)
          .all(...sportParam, limit);
        break;

      // Phase203: 初心者人気大会（口コミの初心者評価が高い）
      case "beginner_popular":
        events = db
          .prepare(`
            SELECT e.id, e.title, e.event_date, e.entry_end_date,
                   e.prefecture, e.city, e.entry_status, e.sport_type,
                   e.distance_list, e.popularity_score, e.description,
                   md.venue_name,
                   AVG(r.rating_beginner) as avg_beginner_rating,
                   COUNT(r.id) as review_count
            FROM events e
            LEFT JOIN marathon_details md ON e.id = md.event_id
            INNER JOIN event_reviews r ON r.event_id = e.id AND (r.status = 'published' OR r.status IS NULL) AND r.rating_beginner IS NOT NULL
            WHERE e.is_active = 1 AND e.event_date >= date('now')
              ${sportFilter}
            GROUP BY e.id
            HAVING review_count >= 1
            ORDER BY avg_beginner_rating DESC, review_count DESC
            LIMIT ?
          `)
          .all(...sportParam, limit);
        break;

      default:
        events = [];
    }

    // Phase231: データが少ない場合のフォールバック
    // 特定カテゴリの結果が少ない場合、人気順の大会で補完
    if (events.length < 3 && type !== "popular") {
      const existing = new Set(events.map((e) => e.id));
      const fallback = db
        .prepare(`
          SELECT e.id, e.title, e.event_date, e.entry_end_date,
                 e.prefecture, e.city, e.entry_status, e.sport_type,
                 e.distance_list, e.popularity_score, e.description,
                 md.venue_name
          FROM events e
          LEFT JOIN marathon_details md ON e.id = md.event_id
          WHERE e.is_active = 1 AND e.event_date >= date('now')
            ${sportFilter}
          ORDER BY e.popularity_score DESC
          LIMIT ?
        `)
        .all(...sportParam, limit);

      for (const item of fallback) {
        if (!existing.has(item.id) && events.length < limit) {
          events.push(item);
          existing.add(item.id);
        }
      }
    }

    // ステータス再計算
    const enriched = events.map((e) => {
      const ds = getEventDisplayStatus(e);
      return { ...e, entry_status: ds.status };
    });

    return NextResponse.json({ type, events: enriched });
  } catch (error) {
    console.error("Rankings API error:", error);
    return NextResponse.json({ type: "", events: [] });
  }
}
