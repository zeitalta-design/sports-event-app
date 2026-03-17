import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getFeatureSummaries } from "@/lib/feature-marathons";
import { getEventDisplayStatus } from "@/lib/entry-status";
import { getPopularEvents } from "@/lib/event-popularity";

export async function GET() {
  try {
    const db = getDb();

    // 受付状態を再計算
    const enrichStatus = (events) =>
      events.map((e) => {
        const ds = getEventDisplayStatus(e);
        return { ...e, entry_status: ds.status };
      });

    // 掲載大会数
    const { total } = db
      .prepare("SELECT COUNT(*) as total FROM events WHERE is_active = 1")
      .get();

    // 直近締切の大会（締切が今日以降で近い順、最大6件）
    let deadlineEvents = db
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

    // Phase230: 締切データが少ない場合、受付中の大会をフォールバック
    if (deadlineEvents.length < 3) {
      const fallback = db
        .prepare(`
          SELECT id, title, event_date, entry_end_date, prefecture, entry_status, sport_type
          FROM events
          WHERE is_active = 1
            AND event_date >= date('now')
            AND entry_status = 'open'
          ORDER BY event_date ASC
          LIMIT 6
        `)
        .all();
      if (fallback.length > deadlineEvents.length) {
        deadlineEvents = fallback;
      }
    }

    // 新着・注目大会（更新日が新しい順、最大6件）
    let newEvents = db
      .prepare(`
        SELECT id, title, event_date, entry_end_date, prefecture, entry_status, sport_type
        FROM events
        WHERE is_active = 1
          AND event_date >= date('now')
        ORDER BY updated_at DESC
        LIMIT 6
      `)
      .all();

    // Phase230: 未来の大会が少ない場合、全大会から表示
    if (newEvents.length < 3) {
      const fallback = db
        .prepare(`
          SELECT id, title, event_date, entry_end_date, prefecture, entry_status, sport_type
          FROM events
          WHERE is_active = 1
          ORDER BY updated_at DESC
          LIMIT 6
        `)
        .all();
      if (fallback.length > newEvents.length) {
        newEvents = fallback;
      }
    }

    // Phase45: 人気大会を行動ログベースの人気指数で取得
    let popularEvents = getPopularEvents({ limit: 5, days: 30 });

    // Phase230: 人気データが少ない場合、直近開催の大会をフォールバック
    if (!popularEvents || popularEvents.length < 3) {
      const fallback = db
        .prepare(`
          SELECT id, title, event_date, entry_end_date, prefecture, entry_status, sport_type
          FROM events
          WHERE is_active = 1
            AND event_date >= date('now')
          ORDER BY event_date ASC
          LIMIT 5
        `)
        .all();
      if (fallback.length > (popularEvents?.length || 0)) {
        popularEvents = enrichStatus(fallback);
      }
    }

    // 比較軸サマリー
    let featureSummaries = [];
    try {
      featureSummaries = getFeatureSummaries();
    } catch (e) {
      console.error("Feature summaries error:", e);
    }

    return NextResponse.json({
      total,
      deadlineEvents: enrichStatus(deadlineEvents),
      newEvents: enrichStatus(newEvents),
      popularEvents,
      featureSummaries,
    });
  } catch (error) {
    console.error("Top API error:", error);
    return NextResponse.json({ total: 0, deadlineEvents: [], newEvents: [], popularEvents: [] });
  }
}
