import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getFeatureSummaries } from "@/lib/feature-marathons";
import { getEventDisplayStatus } from "@/lib/entry-status";
import { getPopularEvents } from "@/lib/event-popularity";

export async function GET() {
  try {
    const db = getDb();

    // 掲載大会数
    const { total } = db
      .prepare("SELECT COUNT(*) as total FROM events WHERE is_active = 1")
      .get();

    // 直近締切の大会（締切が今日以降で近い順、最大6件）
    const deadlineEvents = db
      .prepare(`
        SELECT id, title, event_date, entry_end_date, prefecture, entry_status, sport_type
        FROM events
        WHERE is_active = 1
          AND entry_end_date IS NOT NULL
          AND entry_end_date >= date('now')
          AND entry_status = 'open'
        ORDER BY entry_end_date ASC
        LIMIT 6
      `)
      .all();

    // 新着・注目大会（更新日が新しい順、最大6件）
    const newEvents = db
      .prepare(`
        SELECT id, title, event_date, entry_end_date, prefecture, entry_status, sport_type
        FROM events
        WHERE is_active = 1
          AND event_date >= date('now')
        ORDER BY updated_at DESC
        LIMIT 6
      `)
      .all();

    // Phase45: 人気大会を行動ログベースの人気指数で取得
    const popularEvents = getPopularEvents({ limit: 5, days: 30 });

    // 比較軸サマリー
    let featureSummaries = [];
    try {
      featureSummaries = getFeatureSummaries();
    } catch (e) {
      console.error("Feature summaries error:", e);
    }

    // 受付状態を再計算
    const enrichStatus = (events) =>
      events.map((e) => {
        const ds = getEventDisplayStatus(e);
        return { ...e, entry_status: ds.status };
      });

    return NextResponse.json({
      total,
      deadlineEvents: enrichStatus(deadlineEvents),
      newEvents: enrichStatus(newEvents),
      popularEvents, // 既にgetPopularEvents内でstatus再計算済み
      featureSummaries,
    });
  } catch (error) {
    console.error("Top API error:", error);
    return NextResponse.json({ total: 0, deadlineEvents: [], newEvents: [], popularEvents: [] });
  }
}
