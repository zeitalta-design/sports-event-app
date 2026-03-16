import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { recordEventActivity } from "@/lib/event-activity";

/**
 * POST /api/events/view
 *
 * 大会詳細ページの閲覧イベントを記録する。
 *
 * Body:
 *   marathon_id          - 閲覧した大会ID（必須）
 *   session_id           - セッションID（必須）
 *   referrer_marathon_id - 前に見ていた大会ID（任意）
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { marathon_id, session_id, referrer_marathon_id } = body;

    // バリデーション
    if (!marathon_id || !session_id) {
      return NextResponse.json(
        { error: "marathon_id and session_id are required" },
        { status: 400 }
      );
    }

    const marathonId = parseInt(marathon_id, 10);
    if (isNaN(marathonId) || marathonId <= 0) {
      return NextResponse.json(
        { error: "Invalid marathon_id" },
        { status: 400 }
      );
    }

    // session_id の簡易バリデーション（長すぎないか）
    if (typeof session_id !== "string" || session_id.length > 100) {
      return NextResponse.json(
        { error: "Invalid session_id" },
        { status: 400 }
      );
    }

    const referrerId = referrer_marathon_id
      ? parseInt(referrer_marathon_id, 10)
      : null;

    const userAgent = request.headers.get("user-agent") || null;

    const db = getDb();

    // 大会の存在確認
    const event = db
      .prepare("SELECT id FROM events WHERE id = ? AND is_active = 1")
      .get(marathonId);
    if (!event) {
      return NextResponse.json({ ok: true }); // 存在しなくても静かに成功
    }

    // 重複防止: 同一セッション+同一大会で直近5分以内のレコードがあればスキップ
    const recent = db
      .prepare(
        `SELECT id FROM marathon_view_events
         WHERE session_id = ? AND marathon_id = ?
         AND viewed_at > datetime('now', '-5 minutes')
         LIMIT 1`
      )
      .get(session_id, marathonId);

    if (recent) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // 保存（既存テーブル）
    db.prepare(
      `INSERT INTO marathon_view_events
       (marathon_id, session_id, referrer_marathon_id, user_agent, viewed_at, created_at)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run(marathonId, session_id, referrerId, userAgent);

    // Phase45: 人気指数用の行動ログにも記録
    recordEventActivity({
      eventId: marathonId,
      actionType: "detail_view",
      sessionId: session_id,
      sourcePage: "detail",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("View event error:", err);
    return NextResponse.json({ ok: true }); // エラーでも静かに成功
  }
}
