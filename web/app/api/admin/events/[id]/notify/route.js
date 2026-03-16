import { NextResponse } from "next/server";
import { generateEventNotificationManual } from "@/lib/event-notification-service";

/**
 * POST /api/admin/events/[id]/notify
 *
 * 指定大会について通知候補を手動生成する
 *
 * Body:
 *   changeType - 通知種別 ("entry_opened" | "entry_closed" | etc.)
 *   force      - 重複無視で再生成するか（デフォルト: false）
 *   dryRun     - 生成せずプレビューのみ（デフォルト: false）
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const eventId = parseInt(id, 10);
    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const changeType = body.changeType || "entry_opened";
    const force = !!body.force;
    const dryRun = !!body.dryRun;

    const result = generateEventNotificationManual({
      eventId,
      changeType,
      force,
      dryRun,
    });

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("Event notify error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
