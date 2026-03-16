import { NextResponse } from "next/server";
import {
  runEntryStatusMonitor,
  getMonitorTargetEvents,
  getFreshnessStats,
} from "@/lib/entry-monitor";

/**
 * GET /api/admin/entry-monitor
 *
 * 監視状況のサマリーを返す（管理画面用）
 *
 * Query params:
 *   action - "stats" (デフォルト) | "targets" | "run"
 *   limit  - 件数制限
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "stats";

    if (action === "targets") {
      const limit = parseInt(searchParams.get("limit") || "20", 10);
      const targets = getMonitorTargetEvents({ limit });
      return NextResponse.json({
        success: true,
        total: targets.length,
        targets: targets.map((e) => ({
          id: e.id,
          title: e.title,
          sourceUrl: e.source_url,
          sourceSite: e.source_site,
          entryStatus: e.entry_status,
          eventDate: e.event_date,
          urgencyLabel: e.urgency_label,
          lastVerifiedAt: e.last_verified_at,
          monitorErrorCount: e.monitor_error_count,
        })),
      });
    }

    // Default: stats
    const stats = getFreshnessStats();
    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (err) {
    console.error("Entry monitor admin error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/entry-monitor
 *
 * 手動実行用: 監視ジョブを実行する
 *
 * Body:
 *   limit   - 最大監視件数（デフォルト: 10）
 *   delayMs - リクエスト間隔ms（デフォルト: 1000）
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(body.limit || 10, 50);
    const delayMs = Math.max(body.delayMs || 1000, 500);

    const result = await runEntryStatusMonitor({ limit, delayMs });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("Entry monitor admin run error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
