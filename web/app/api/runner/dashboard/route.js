import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getEventDisplayStatus } from "@/lib/entry-status";

/**
 * Phase62: Runner Dashboard API
 *
 * GET /api/runner/dashboard
 *
 * ダッシュボード用データを一括取得:
 * - 締切間近の大会（7日以内）
 * - おすすめ大会（人気上位、受付中）
 * - 新着大会
 * - 今週末の大会
 */
export async function GET() {
  try {
    const db = getDb();

    // 締切間近: 7日以内に締切がある受付中の大会
    const deadlineSoon = db
      .prepare(`
        SELECT e.id, e.title, e.event_date, e.entry_end_date,
               e.prefecture, e.city, e.entry_status, e.sport_type,
               e.distance_list, e.popularity_score,
               md.venue_name, md.capacity_info
        FROM events e
        LEFT JOIN marathon_details md ON e.id = md.event_id
        WHERE e.is_active = 1
          AND e.entry_end_date IS NOT NULL
          AND e.entry_end_date >= date('now')
          AND e.entry_end_date <= date('now', '+7 days')
          AND e.entry_status = 'open'
        ORDER BY e.entry_end_date ASC
        LIMIT 6
      `)
      .all();

    // おすすめ: 受付中 × 人気上位
    const recommended = db
      .prepare(`
        SELECT e.id, e.title, e.event_date, e.entry_end_date,
               e.prefecture, e.city, e.entry_status, e.sport_type,
               e.distance_list, e.popularity_score,
               md.venue_name, md.capacity_info
        FROM events e
        LEFT JOIN marathon_details md ON e.id = md.event_id
        WHERE e.is_active = 1
          AND e.event_date >= date('now')
          AND e.entry_status = 'open'
        ORDER BY e.popularity_score DESC
        LIMIT 8
      `)
      .all();

    // 新着: 最近更新 × 受付中
    const newEvents = db
      .prepare(`
        SELECT e.id, e.title, e.event_date, e.entry_end_date,
               e.prefecture, e.city, e.entry_status, e.sport_type,
               e.distance_list, e.popularity_score,
               md.venue_name
        FROM events e
        LEFT JOIN marathon_details md ON e.id = md.event_id
        WHERE e.is_active = 1
          AND e.event_date >= date('now')
        ORDER BY e.updated_at DESC
        LIMIT 6
      `)
      .all();

    // 今週末の大会
    const weekend = db
      .prepare(`
        SELECT e.id, e.title, e.event_date, e.entry_end_date,
               e.prefecture, e.city, e.entry_status, e.sport_type,
               e.distance_list, e.popularity_score,
               md.venue_name
        FROM events e
        LEFT JOIN marathon_details md ON e.id = md.event_id
        WHERE e.is_active = 1
          AND e.event_date >= date('now')
          AND e.event_date <= date('now', '+7 days')
        ORDER BY e.event_date ASC
        LIMIT 6
      `)
      .all();

    const enrichStatus = (events) =>
      events.map((e) => {
        const ds = getEventDisplayStatus(e);
        return { ...e, entry_status: ds.status };
      });

    return NextResponse.json({
      deadlineSoon: enrichStatus(deadlineSoon),
      recommended: enrichStatus(recommended),
      newEvents: enrichStatus(newEvents),
      weekend: enrichStatus(weekend),
    });
  } catch (error) {
    console.error("Runner dashboard API error:", error);
    return NextResponse.json({
      deadlineSoon: [],
      recommended: [],
      newEvents: [],
      weekend: [],
    });
  }
}
