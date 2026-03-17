import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * Phase130: 運営修正依頼API
 *
 * POST /api/organizers/request-update
 * 認証不要の公開エンドポイント
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      event_id,
      event_name,
      official_url,
      requester_role,
      correction_items,
      correction_content,
      contact_email,
      notes,
    } = body;

    // バリデーション
    if (!event_name?.trim()) {
      return NextResponse.json({ error: "大会名は必須です。" }, { status: 400 });
    }
    if (!requester_role) {
      return NextResponse.json({ error: "ご担当の立場を選択してください。" }, { status: 400 });
    }
    if (!correction_content?.trim()) {
      return NextResponse.json({ error: "修正内容は必須です。" }, { status: 400 });
    }
    if (!contact_email?.trim() || !contact_email.includes("@")) {
      return NextResponse.json({ error: "有効なメールアドレスを入力してください。" }, { status: 400 });
    }

    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO organizer_update_requests
        (event_id, event_name, official_url, requester_role, correction_items,
         correction_content, contact_email, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      event_id ? parseInt(event_id) : null,
      event_name.trim(),
      official_url?.trim() || null,
      requester_role,
      correction_items || null,
      correction_content.trim(),
      contact_email.trim(),
      notes?.trim() || null,
    );

    return NextResponse.json({
      success: true,
      request_id: result.lastInsertRowid,
    });
  } catch (error) {
    console.error("POST /api/organizers/request-update error:", error);
    return NextResponse.json({ error: "送信に失敗しました。" }, { status: 500 });
  }
}
