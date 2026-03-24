import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/my-calendar?ids=1,2,3
 * イベントIDリストからカレンダー表示用のイベント情報を返す
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");

    if (!idsParam) {
      return NextResponse.json({ events: [] });
    }

    const ids = idsParam.split(",").map(Number).filter((n) => !isNaN(n) && n > 0);
    if (ids.length === 0) {
      return NextResponse.json({ events: [] });
    }

    const db = getDb();
    const placeholders = ids.map(() => "?").join(",");
    const events = db
      .prepare(
        `SELECT id, title, event_date, entry_end_date, entry_status,
                sport_type, prefecture, city, source_url, official_url,
                urgency_label, popularity_score
         FROM events
         WHERE id IN (${placeholders}) AND is_active = 1
         ORDER BY event_date ASC`
      )
      .all(...ids);

    return NextResponse.json({ events });
  } catch (err) {
    console.error("my-calendar API error:", err);
    return NextResponse.json({ events: [], error: "Internal error" }, { status: 500 });
  }
}
