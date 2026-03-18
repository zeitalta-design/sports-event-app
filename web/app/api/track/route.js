import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * POST /api/track
 *
 * 汎用行動ログエンドポイント。
 * event_id が不要なアクション（検索実行、ページ遷移等）にも対応。
 * user_action_logs テーブルに記録。
 *
 * Body:
 *   action_type — アクション種別（必須）
 *   event_id    — 大会ID（任意、0やnull可）
 *   session_id  — セッションID（任意）
 *   source_page — 記録元ページ（任意）
 *   metadata    — 拡張データ（任意）
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { action_type, event_id, session_id, source_page, metadata } = body;

    if (!action_type) {
      return NextResponse.json({ error: "action_type is required" }, { status: 400 });
    }

    const db = getDb();
    const metadataJson = metadata ? JSON.stringify(metadata) : null;
    const eventId = event_id ? parseInt(event_id, 10) : null;

    db.prepare(
      `INSERT INTO user_action_logs
       (action_type, event_id, session_id, source_page, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).run(action_type, eventId, session_id || null, source_page || null, metadataJson);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/track error:", err);
    return NextResponse.json({ ok: true }); // エラーでも静かに返す
  }
}
