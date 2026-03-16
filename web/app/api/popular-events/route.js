import { NextResponse } from "next/server";
import { getPopularEvents } from "@/lib/event-popularity";

/**
 * GET /api/popular-events?limit=5&days=30
 *
 * 人気大会ランキングを返す。
 * 行動ログ＋既存お気に入り数のハイブリッドスコアで順位付け。
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "5", 10), 20);
    const days = Math.min(parseInt(searchParams.get("days") || "30", 10), 90);
    const sportType = searchParams.get("sport_type") || null;

    const events = getPopularEvents({ limit, days, sportType });

    return NextResponse.json({
      events,
      total: events.length,
      period_days: days,
    });
  } catch (err) {
    console.error("GET /api/popular-events error:", err);
    return NextResponse.json({ events: [], total: 0, period_days: 30 });
  }
}
