import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/admin/analytics-summary?days=7
 *
 * 行動ログ分析API — CV改善に必要な全指標を返す
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

    // 3. 人気イベント（PV順 + クリック数付き）
    const topEvents = db.prepare(`
      SELECT
        al.event_id,
        e.title,
        e.source_site,
        SUM(CASE WHEN al.action_type = 'detail_view' THEN 1 ELSE 0 END) as views,
        SUM(CASE WHEN al.action_type IN ('entry_click', 'external_link_click', 'cta_click') THEN 1 ELSE 0 END) as clicks,
        ROUND(
          CASE WHEN SUM(CASE WHEN al.action_type = 'detail_view' THEN 1 ELSE 0 END) > 0
          THEN CAST(SUM(CASE WHEN al.action_type IN ('entry_click', 'external_link_click', 'cta_click') THEN 1 ELSE 0 END) AS REAL)
               / SUM(CASE WHEN al.action_type = 'detail_view' THEN 1 ELSE 0 END) * 100
          ELSE 0 END, 1
        ) as ctr
      FROM event_activity_logs al
      JOIN events e ON e.id = al.event_id
      WHERE al.created_at >= ?
      GROUP BY al.event_id
      ORDER BY views DESC
      LIMIT 15
    `).all(since);

    // 4. 外部リンククリック — source_site別
    const clicksBySite = db.prepare(`
      SELECT
        COALESCE(source_site, 'unknown') as site,
        COUNT(*) as cnt
      FROM event_activity_logs
      WHERE created_at >= ?
        AND action_type IN ('entry_click', 'external_link_click', 'cta_click')
      GROUP BY source_site
      ORDER BY cnt DESC
    `).all(since);

    // 5. 大会別 外部リンククリック数ランキング
    const topClickEvents = db.prepare(`
      SELECT
        al.event_id,
        e.title,
        COUNT(*) as clicks,
        GROUP_CONCAT(DISTINCT COALESCE(al.source_site, 'unknown')) as sites
      FROM event_activity_logs al
      JOIN events e ON e.id = al.event_id
      WHERE al.created_at >= ?
        AND al.action_type IN ('entry_click', 'external_link_click', 'cta_click')
      GROUP BY al.event_id
      ORDER BY clicks DESC
      LIMIT 10
    `).all(since);

    // 6. 検索キーワード上位
    let searchKeywords = [];
    try {
      searchKeywords = db.prepare(`
        SELECT
          JSON_EXTRACT(metadata_json, '$.keyword') as keyword,
          COUNT(*) as cnt
        FROM user_action_logs
        WHERE created_at >= ?
          AND action_type = 'search_execute'
          AND JSON_EXTRACT(metadata_json, '$.keyword') IS NOT NULL
          AND JSON_EXTRACT(metadata_json, '$.keyword') != ''
        GROUP BY keyword
        ORDER BY cnt DESC
        LIMIT 15
      `).all(since);
    } catch {}

    // 7. 検索エリア上位
    let searchAreas = [];
    try {
      searchAreas = db.prepare(`
        SELECT
          JSON_EXTRACT(metadata_json, '$.prefecture') as area,
          COUNT(*) as cnt
        FROM user_action_logs
        WHERE created_at >= ?
          AND action_type = 'search_execute'
          AND JSON_EXTRACT(metadata_json, '$.prefecture') IS NOT NULL
          AND JSON_EXTRACT(metadata_json, '$.prefecture') != ''
        GROUP BY area
        ORDER BY cnt DESC
        LIMIT 15
      `).all(since);
    } catch {}

    // 8. ソースページ別
    const sourceCounts = db.prepare(`
      SELECT source_page, COUNT(*) as cnt
      FROM event_activity_logs
      WHERE created_at >= ? AND source_page IS NOT NULL AND source_page != ''
      GROUP BY source_page
      ORDER BY cnt DESC
      LIMIT 10
    `).all(since);

    // 9. ユニークセッション数
    const uniqueSessions = db.prepare(`
      SELECT COUNT(DISTINCT session_id) as cnt
      FROM event_activity_logs
      WHERE created_at >= ? AND session_id IS NOT NULL
    `).get(since);

    // 10. ユーザー / 口コミ
    let newUsers = 0;
    try { newUsers = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE created_at >= ?").get(since).cnt; } catch {}
    let newReviews = 0;
    try { newReviews = db.prepare("SELECT COUNT(*) as cnt FROM event_reviews WHERE created_at >= ?").get(since).cnt; } catch {}

    // KPI整形
    const actionMap = {};
    for (const row of actionCounts) actionMap[row.action_type] = row.cnt;

    const totalClicks = (actionMap.entry_click || 0) + (actionMap.external_link_click || 0) + (actionMap.cta_click || 0);
    const totalViews = actionMap.detail_view || 0;

    return NextResponse.json({
      period: { days, since },
      kpi: {
        totalActions: actionCounts.reduce((sum, r) => sum + r.cnt, 0),
        pageViews: totalViews,
        externalClicks: totalClicks,
        overallCTR: totalViews > 0 ? Math.round(totalClicks / totalViews * 1000) / 10 : 0,
        favorites: actionMap.favorite_add || 0,
        entryClicks: actionMap.entry_click || 0,
        saves: actionMap.save_add || 0,
        compares: actionMap.compare_add || 0,
        uniqueSessions: uniqueSessions?.cnt || 0,
        newUsers,
        newReviews,
      },
      dailyActivity,
      topEvents,
      topClickEvents,
      clicksBySite,
      searchKeywords,
      searchAreas,
      sourceCounts,
      actionCounts,
    });
  } catch (error) {
    console.error("Analytics summary error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
