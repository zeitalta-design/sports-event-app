import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/**
 * Phase132: 管理メモAPI
 *
 * GET  /api/admin/event-notes?event_id=X — イベントのメモ一覧
 * POST /api/admin/event-notes — メモ追加
 */

export async function GET(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("event_id");
    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 });
    }

    const db = getDb();
    const notes = db
      .prepare(`
        SELECT * FROM admin_event_notes
        WHERE event_id = ?
        ORDER BY created_at DESC
      `)
      .all(parseInt(eventId));

    return NextResponse.json({ notes });
  } catch (error) {
    console.error("GET /api/admin/event-notes error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { event_id, note_type, note_text } = await request.json();

    if (!event_id || !note_type || !note_text?.trim()) {
      return NextResponse.json({ error: "event_id, note_type, note_text are required" }, { status: 400 });
    }

    const db = getDb();
    const result = db
      .prepare(`
        INSERT INTO admin_event_notes (event_id, note_type, note_text, created_by)
        VALUES (?, ?, ?, ?)
      `)
      .run(parseInt(event_id), note_type, note_text.trim(), admin.name || admin.email);

    return NextResponse.json({ success: true, note_id: result.lastInsertRowid });
  } catch (error) {
    console.error("POST /api/admin/event-notes error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
