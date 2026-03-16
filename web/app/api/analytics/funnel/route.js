/**
 * Phase97: ファネル分析API
 *
 * GET /api/analytics/funnel?days=30
 *
 * 閲覧 → 保存/比較 → エントリークリック の変換率を返す。
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get("days") || "30", 10), 90);

    const db = getDb();

    // 各アクションの件数を取得
    const actionCounts = db.prepare(`
      SELECT action_type, COUNT(*) as cnt, COUNT(DISTINCT event_id) as unique_events
      FROM event_activity_logs
      WHERE created_at >= datetime('now', ? || ' days')
      GROUP BY action_type
    `).all(`-${days}`);

    const counts = {};
    const uniqueEvents = {};
    for (const row of actionCounts) {
      counts[row.action_type] = row.cnt;
      uniqueEvents[row.action_type] = row.unique_events;
    }

    // ファネルステージ
    const views = counts.detail_view || 0;
    const saves = (counts.save_add || 0) + (counts.favorite_add || 0);
    const compares = counts.compare_add || 0;
    const entryClicks = (counts.entry_click || 0) + (counts.cta_click || 0);
    const recommendations = counts.recommendation_click || 0;

    // 変換率
    const viewToSave = views > 0 ? Math.round((saves / views) * 100 * 10) / 10 : 0;
    const viewToEntry = views > 0 ? Math.round((entryClicks / views) * 100 * 10) / 10 : 0;
    const saveToEntry = saves > 0 ? Math.round((entryClicks / saves) * 100 * 10) / 10 : 0;

    // 日別トレンド（直近7日分）
    const dailyTrend = db.prepare(`
      SELECT
        date(created_at) as day,
        SUM(CASE WHEN action_type = 'detail_view' THEN 1 ELSE 0 END) as views,
        SUM(CASE WHEN action_type IN ('save_add', 'favorite_add') THEN 1 ELSE 0 END) as saves,
        SUM(CASE WHEN action_type IN ('entry_click', 'cta_click') THEN 1 ELSE 0 END) as entries
      FROM event_activity_logs
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY date(created_at)
      ORDER BY day DESC
    `).all();

    return NextResponse.json({
      period_days: days,
      funnel: {
        views,
        saves,
        compares,
        entry_clicks: entryClicks,
        recommendation_clicks: recommendations,
      },
      conversion: {
        view_to_save_pct: viewToSave,
        view_to_entry_pct: viewToEntry,
        save_to_entry_pct: saveToEntry,
      },
      action_counts: counts,
      unique_events: uniqueEvents,
      daily_trend: dailyTrend,
    });
  } catch (err) {
    console.error("Funnel analytics error:", err);
    return NextResponse.json(
      { error: "Failed to get funnel data" },
      { status: 500 }
    );
  }
}
