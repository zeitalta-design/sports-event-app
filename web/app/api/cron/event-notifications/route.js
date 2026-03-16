import { NextResponse } from "next/server";
import {
  dispatchPendingEventNotifications,
  buildNotificationDispatchSummary,
} from "@/lib/notification-dispatcher";

/**
 * POST /api/cron/event-notifications
 *
 * 定期実行用: pending 通知をバッチ送信する。
 * 外部 cron サービスや Vercel Cron から呼ばれる想定。
 *
 * Query params:
 *   limit   - 最大送信件数（デフォルト: 200）
 *   channel - チャンネル絞り込み
 */
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "200", 10);
    const channel = searchParams.get("channel") || undefined;

    const results = dispatchPendingEventNotifications({
      limit: Math.min(limit, 500),
      channel,
    });

    const summary = buildNotificationDispatchSummary(results);

    return NextResponse.json({
      success: true,
      ...summary,
    });
  } catch (err) {
    console.error("Event notifications cron error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/event-notifications
 *
 * ヘルスチェック用
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    description: "Event notifications cron endpoint. POST to dispatch pending notifications.",
  });
}
