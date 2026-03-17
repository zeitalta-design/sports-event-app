import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * Phase235: 簡易ログ分析API
 *
 * GET /api/admin/analytics-summary?days=7
 *
 * 最低限のアクティビティ集計を返す。
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get("days")) || 7, 90);

    const db = getDb();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // 1. アクション別集計
    const actionCounts = db.prepare(`
      SELECT action_type, COUNT(*) as cnt
      FROM event_activity_logs
      WHERE created_at >= ?
      GROUP BY action_type
      ORDER BY cnt DESC
    `).all(since);

    // 2. 日別アクティビティ
    const dailyActivity = db.prepare(`
      SELECT DATE(created_at) as day, COUNT(*) as cnt
      FROM event_activity_logs
      WHERE created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `).all(since);

    // 3. 人気イベント（PV順）
    const topEvents = db.prepare(`
      SELECT al.event_id, e.title, COUNT(*) as views
      FROM event_activity_logs al
      JOIN events e ON e.id = al.event_id
      WHERE al.created_at >= ?
        AND al.action_type = 'detail_view'
      GROUP BY al.event_id
      ORDER BY views DESC
      LIMIT 10
    `).all(since);

    // 4. ソースページ別
    const sourceCounts = db.prepare(`
      SELECT source_page, COUNT(*) as cnt
      FROM event_activity_logs
      WHERE created_at >= ? AND source_page IS NOT NULL AND source_page != ''
      GROUP BY source_page
      ORDER BY cnt DESC
      LIMIT 10
    `).all(since);

    // 5. ユニークセッション数
    const uniqueSessions = db.prepare(`
      SELECT COUNT(DISTINCT session_id) as cnt
      FROM event_activity_logs
      WHERE created_at >= ? AND session_id IS NOT NULL
    `).get(since);

    // 6. ユーザー登録数
    let newUsers = 0;
    try {
      newUsers = db.prepare(
        "SELECT COUNT(*) as cnt FROM users WHERE created_at >= ?"
      ).get(since).cnt;
    } catch {}

    // 7. 口コミ投稿数
    let newReviews = 0;
    try {
      newReviews = db.prepare(
        "SELECT COUNT(*) as cnt FROM reviews WHERE created_at >= ?"
      ).get(since).cnt;
    } catch {}
    try {
      newReviews += db.prepare(
        "SELECT COUNT(*) as cnt FROM event_reviews WHERE created_at >= ?"
      ).get(since).cnt;
    } catch {}

    // アクション別を分かりやすく整形
    const actionMap = {};
    for (const row of actionCounts) {
      actionMap[row.action_type] = row.cnt;
    }

    return NextResponse.json({
      period: { days, since },
      kpi: {
        totalActions: actionCounts.reduce((sum, r) => sum + r.cnt, 0),
        pageViews: actionMap.detail_view || 0,
        favorites: actionMap.favorite_add || 0,
        entryClicks: actionMap.entry_click || 0,
        saves: actionMap.save || 0,
        compares: actionMap.compare_add || 0,
        uniqueSessions: uniqueSessions?.cnt || 0,
        newUsers,
        newReviews,
      },
      dailyActivity,
      topEvents,
      sourceCounts,
      actionCounts,
    });
  } catch (error) {
    console.error("Analytics summary error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
