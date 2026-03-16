import { NextResponse } from "next/server";
import {
  getEventNotificationStats,
  getRecentEventNotifications,
  getRecentBatches,
} from "@/lib/event-notification-service";
import {
  dispatchPendingEventNotifications,
  buildNotificationDispatchSummary,
} from "@/lib/notification-dispatcher";

/**
 * GET /api/admin/event-notifications
 *
 * 通知管理のサマリー・一覧を返す
 *
 * Query params:
 *   view - "stats" (デフォルト) | "notifications" | "batches"
 *   limit - 件数制限
 *   offset - オフセット
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "stats";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    if (view === "notifications") {
      const notifications = getRecentEventNotifications({ limit, offset });
      return NextResponse.json({ success: true, notifications });
    }

    if (view === "batches") {
      const batches = getRecentBatches({ limit, offset });
      return NextResponse.json({ success: true, batches });
    }

    // Default: stats + recent data
    const stats = getEventNotificationStats();
    const recentNotifications = getRecentEventNotifications({ limit: 20 });
    const recentBatches = getRecentBatches({ limit: 10 });

    return NextResponse.json({
      success: true,
      stats,
      recentNotifications,
      recentBatches,
    });
  } catch (err) {
    console.error("Event notifications admin error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/event-notifications
 *
 * 手動送信実行
 *
 * Body:
 *   action - "dispatch" (デフォルト)
 *   limit  - 最大送信件数（デフォルト: 100）
 *   channel - チャンネル絞り込み
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || "dispatch";
    const limit = Math.min(body.limit || 100, 500);
    const channel = body.channel || undefined;

    if (action === "dispatch") {
      const results = dispatchPendingEventNotifications({ limit, channel });
      const summary = buildNotificationDispatchSummary(results);

      return NextResponse.json({
        success: true,
        ...summary,
      });
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    console.error("Event notifications admin dispatch error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
