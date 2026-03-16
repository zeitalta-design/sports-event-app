import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getEventDisplayStatus } from "@/lib/entry-status";

/**
 * Phase67: カレンダーAPI
 *
 * GET /api/calendar?year=2026&month=3
 *
 * 指定年月の大会一覧（日別グルーピング用）
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseInt(searchParams.get("year")) || now.getFullYear();
    const month = parseInt(searchParams.get("month")) || (now.getMonth() + 1);

    // 月の開始・終了
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

    const db = getDb();

    const events = db
      .prepare(`
        SELECT e.id, e.title, e.event_date, e.entry_end_date,
               e.prefecture, e.city, e.entry_status, e.sport_type,
               e.distance_list, e.popularity_score
        FROM events e
        WHERE e.is_active = 1
          AND e.event_date >= ?
          AND e.event_date < ?
        ORDER BY e.event_date ASC, e.popularity_score DESC
      `)
      .all(startDate, endDate);

    // ステータス再計算 + 日別グルーピング
    const byDate = {};
    for (const ev of events) {
      const ds = getEventDisplayStatus(ev);
      const enriched = { ...ev, entry_status: ds.status };
      const day = ev.event_date;
      if (!byDate[day]) byDate[day] = [];
      byDate[day].push(enriched);
    }

    // 月間統計
    const stats = {
      total: events.length,
      openCount: events.filter((e) => getEventDisplayStatus(e).status === "open").length,
      sportCounts: {},
    };
    for (const ev of events) {
      const st = ev.sport_type || "other";
      stats.sportCounts[st] = (stats.sportCounts[st] || 0) + 1;
    }

    return NextResponse.json({
      year,
      month,
      events: byDate,
      stats,
    });
  } catch (error) {
    console.error("Calendar API error:", error);
    return NextResponse.json({ year: 0, month: 0, events: {}, stats: {} });
  }
}
