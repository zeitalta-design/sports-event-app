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

    const db = getDb();
    let events = [];

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
            ORDER BY e.popularity_score DESC
            LIMIT ?
          `)
          .all(limit);
        break;

      case "beginner":
        // 初心者向け: 説明文に初心者キーワード + 短距離
        events = db
          .prepare(`
            SELECT e.id, e.title, e.event_date, e.entry_end_date,
                   e.prefecture, e.city, e.entry_status, e.sport_type,
                   e.distance_list, e.popularity_score, e.description,
                   md.venue_name
            FROM events e
            LEFT JOIN marathon_details md ON e.id = md.event_id
            WHERE e.is_active = 1 AND e.event_date >= date('now')
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
          .all(limit);
        break;

      case "flat":
        // フラットコース: 説明文にフラットキーワード
        events = db
          .prepare(`
            SELECT e.id, e.title, e.event_date, e.entry_end_date,
                   e.prefecture, e.city, e.entry_status, e.sport_type,
                   e.distance_list, e.popularity_score, e.description,
                   md.venue_name
            FROM events e
            LEFT JOIN marathon_details md ON e.id = md.event_id
            WHERE e.is_active = 1 AND e.event_date >= date('now')
              AND (
                e.description LIKE '%フラット%'
                OR e.description LIKE '%平坦%'
                OR e.description LIKE '%高低差%少%'
                OR e.title LIKE '%フラット%'
              )
            ORDER BY e.popularity_score DESC
            LIMIT ?
          `)
          .all(limit);
        break;

      case "record":
        // 記録狙い: フルマラソン + 人気上位
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

      default:
        events = [];
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
