import { NextResponse } from "next/server";
import { recordEventActivity } from "@/lib/event-activity";

/**
 * POST /api/events/activity
 *
 * 行動ログを記録する汎用エンドポイント。
 * エントリークリック等、クライアント側から直接記録する用途。
 *
 * Body:
 *   event_id    — 大会ID（必須）
 *   action_type — アクション種別（必須: detail_view, favorite_add, entry_click 等）
 *   session_id  — セッションID（任意）
 *   source_page — 記録元（任意: detail, list, top 等）
 *   metadata    — 拡張データ（任意）
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { event_id, action_type, session_id, source_page, metadata, source_site, placement } = body;

    if (!action_type) {
      return NextResponse.json(
        { error: "action_type is required" },
        { status: 400 }
      );
    }

    // event_idが0やnullの場合も許容（検索ログ等、大会に紐づかないアクション用）
    const eventId = event_id ? parseInt(event_id, 10) : 0;
    if (isNaN(eventId) || eventId < 0) {
      return NextResponse.json(
        { error: "Invalid event_id" },
        { status: 400 }
      );
    }

    const result = recordEventActivity({
      eventId,
      actionType: action_type,
      sessionId: session_id || null,
      sourcePage: source_page || null,
      metadata: metadata || null,
      sourceSite: source_site || null,
      placement: placement || null,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/events/activity error:", err);
    return NextResponse.json({ ok: true }); // エラーでも静かに返す
  }
}
