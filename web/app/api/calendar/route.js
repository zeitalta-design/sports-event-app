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
    const sportType = searchParams.get("sport_type") || ""; // Phase125: スポーツ種別フィルタ

    // 月の開始・終了
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

    const db = getDb();

    const sportFilter = sportType ? "AND e.sport_type = ?" : "";
    const sportParam = sportType ? [sportType] : [];

    const events = db
      .prepare(`
        SELECT e.id, e.title, e.event_date, e.entry_end_date,
               e.prefecture, e.city, e.entry_status, e.sport_type,
               e.distance_list, e.popularity_score
        FROM events e
        WHERE e.is_active = 1
          AND e.event_date >= ?
          AND e.event_date < ?
          ${sportFilter}
        ORDER BY e.event_date ASC, e.popularity_score DESC
      `)
      .all(startDate, endDate, ...sportParam);

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

    // Phase232: 前後月のイベント数を提供（少ない月の導線用）
    let adjacentMonths = null;
    if (events.length < 5) {
      try {
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;

        const prevStart = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
        const prevEnd = `${year}-${String(month).padStart(2, "0")}-01`;
        const nextEnd = month === 12
          ? `${nextYear + (nextMonth === 12 ? 1 : 0)}-${String(nextMonth === 12 ? 1 : nextMonth + 1).padStart(2, "0")}-01`
          : `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-01`;
        const nextStart = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

        const prevCount = db.prepare(
          `SELECT COUNT(*) as cnt FROM events WHERE is_active = 1 AND event_date >= ? AND event_date < ?`
        ).get(prevStart, prevEnd).cnt;

        const nextCount = db.prepare(
          `SELECT COUNT(*) as cnt FROM events WHERE is_active = 1 AND event_date >= ? AND event_date < ?`
        ).get(nextStart, nextEnd).cnt;

        adjacentMonths = {
          prev: { year: prevYear, month: prevMonth, count: prevCount },
          next: { year: nextYear, month: nextMonth, count: nextCount },
        };
      } catch {}
    }

    return NextResponse.json({
      year,
      month,
      events: byDate,
      stats,
      adjacentMonths,
    });
  } catch (error) {
    console.error("Calendar API error:", error);
    return NextResponse.json({ year: 0, month: 0, events: {}, stats: {} });
  }
}
