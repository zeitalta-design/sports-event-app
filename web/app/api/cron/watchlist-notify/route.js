/**
 * Cron: ウォッチリスト通知
 *
 * POST /api/cron/watchlist-notify
 *
 * Vercel Cronから毎週自動実行。
 * ウォッチ対象企業の新着処分をユーザーにダイジェストメールで通知する。
 *
 * 認証: CRON_SECRET ヘッダー
 *
 * GET  → ステータス確認（dry-run）
 * POST → 実行
 */

import { NextResponse } from "next/server";
import { runWatchlistNotifications } from "@/lib/watchlist-notification-service";

function verifyCronAuth(request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth === `Bearer ${secret}`) return true;
  }
  // 管理者セッションでもOK（手動呼び出し用）
  const adminSession = request.cookies?.get?.("admin_session")?.value ||
                       request.cookies?.get?.("mvp_session")?.value;
  if (adminSession) return true;
  // 開発環境ではスキップ
  if (!secret) return true;
  return false;
}

/** GET: dry-runで通知対象を確認 */
export async function GET(request) {
  try {
    const result = await runWatchlistNotifications({ dryRun: true });
    return NextResponse.json({
      preview: true,
      pendingUsers: result.usersNotified || 0,
      pendingWatches: result.watchesNotified || 0,
      details: result.details || [],
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** POST: 通知実行 */
export async function POST(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  try {
    const result = await runWatchlistNotifications({ dryRun: false });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // ログ記録
    try {
      const { getDb } = await import("@/lib/db");
      const db = getDb();
      db.prepare(`
        INSERT INTO sync_runs (source_key, status, stats_json, started_at, finished_at)
        VALUES ('watchlist-notify', ?, ?, datetime('now'), datetime('now'))
      `).run(
        result.success ? "completed" : "partial",
        JSON.stringify({
          usersNotified: result.usersNotified,
          emailsSent: result.emailsSent,
          emailsFailed: result.emailsFailed,
          elapsed,
        })
      );
    } catch { /* sync_runs未存在時は無視 */ }

    return NextResponse.json({
      ok: true,
      ...result,
      elapsed,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
