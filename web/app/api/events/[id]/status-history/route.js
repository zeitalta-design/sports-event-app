import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * Phase82: イベントの状態変化タイムラインAPI
 *
 * GET /api/events/[id]/status-history
 *
 * 直近の状態変化履歴を返す。
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const eventId = parseInt(id, 10);
    if (isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    }

    const db = getDb();

    // 状態変化ログ（最新30件）
    const changes = db
      .prepare(`
        SELECT id, previous_status, new_status,
               previous_label, new_label,
               change_source, confidence,
               detected_signals_json, note, created_at
        FROM entry_status_changes
        WHERE event_id = ?
        ORDER BY created_at DESC
        LIMIT 30
      `)
      .all(eventId);

    // 現在のステータス
    const current = db
      .prepare(`
        SELECT official_entry_status, official_entry_status_label,
               official_checked_at, official_status_confidence,
               official_status_note, official_unknown_reason,
               official_status_source_type
        FROM events WHERE id = ?
      `)
      .get(eventId);

    return NextResponse.json({
      eventId,
      current: current || null,
      changes: changes.map(c => ({
        ...c,
        detected_signals: c.detected_signals_json ? JSON.parse(c.detected_signals_json) : [],
      })),
    });
  } catch (error) {
    console.error("Status history API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
