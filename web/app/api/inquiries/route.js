import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { notifyInquiryCreated } from "@/lib/ops-notify";

/**
 * Phase228: 公開側 問い合わせ受付API
 * POST: 新規問い合わせ登録 → Slack通知
 */
export async function POST(request) {
  try {
    const db = getDb();
    const body = await request.json();
    const { inquiry_type, subject, body: msgBody, name, email, event_id, target_url, source_page } = body;

    // バリデーション
    if (!subject || !msgBody || !name || !email) {
      return NextResponse.json(
        { error: "件名・内容・氏名・メールアドレスは必須です" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "メールアドレスの形式が不正です" }, { status: 400 });
    }

    const validTypes = ["general", "listing_request", "correction", "deletion", "bug_report", "organizer_apply"];
    const type = validTypes.includes(inquiry_type) ? inquiry_type : "general";

    const result = db.prepare(`
      INSERT INTO inquiries (inquiry_type, subject, body, name, email, event_id, target_url, source_page)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(type, subject, msgBody, name, email, event_id || null, target_url || null, source_page || null);

    const id = result.lastInsertRowid;

    // Slack通知（非同期・失敗してもレスポンスに影響しない）
    notifyInquiryCreated({ id, inquiry_type: type, subject, name }).catch((err) => {
      console.error("[ops-notify] 問い合わせ通知送信失敗:", err.message);
    });

    return NextResponse.json({ id, message: "お問い合わせを受け付けました" });
  } catch (err) {
    console.error("Inquiry submit error:", err);
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }
}
