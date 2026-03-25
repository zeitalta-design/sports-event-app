import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getDb } from "@/lib/db";

/**
 * GET /api/admin/merge-verification
 *
 * 検証ログ一覧取得。フィルタ・ソート対応。
 *
 * Params:
 *   filter: all / matched / unmatched / pending / reviewed / error
 *   sort: score_desc / score_asc / date
 *   limit / offset
 */
export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all";
    const sort = searchParams.get("sort") || "score_desc";
    const limit = Math.min(parseInt(searchParams.get("limit")) || 100, 500);
    const offset = parseInt(searchParams.get("offset")) || 0;

    const db = getDb();

    let where = "WHERE 1=1";
    if (filter === "matched") where += " AND v.matched = 1";
    else if (filter === "unmatched") where += " AND v.matched = 0 AND v.search_error IS NULL";
    else if (filter === "pending") where += " AND v.human_review = 'pending'";
    else if (filter === "reviewed") where += " AND v.human_review != 'pending'";
    else if (filter === "error") where += " AND v.search_error IS NOT NULL";
    else if (filter === "needs_check") where += " AND v.score >= 50 AND v.score < 80";
    else if (filter === "selector_issues") where += " AND v.selector_errors_json IS NOT NULL";

    let orderBy = "ORDER BY v.score DESC";
    if (sort === "score_asc") orderBy = "ORDER BY v.score ASC";
    else if (sort === "date") orderBy = "ORDER BY v.created_at DESC";

    const total = db.prepare(`
      SELECT COUNT(*) as cnt FROM merge_verification_logs v ${where}
    `).get().cnt;

    const logs = db.prepare(`
      SELECT v.*, e.event_date, e.prefecture
      FROM merge_verification_logs v
      LEFT JOIN events e ON e.id = v.event_id
      ${where}
      ${orderBy}
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    // 集計レポート
    const report = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN matched = 1 THEN 1 ELSE 0 END) as matched_count,
        SUM(CASE WHEN matched = 0 AND search_error IS NULL THEN 1 ELSE 0 END) as unmatched_count,
        SUM(CASE WHEN search_error IS NOT NULL THEN 1 ELSE 0 END) as error_count,
        SUM(CASE WHEN score >= 80 THEN 1 ELSE 0 END) as high_score,
        SUM(CASE WHEN score >= 50 AND score < 80 THEN 1 ELSE 0 END) as mid_score,
        SUM(CASE WHEN score > 0 AND score < 50 THEN 1 ELSE 0 END) as low_score,
        SUM(CASE WHEN score = 0 AND search_error IS NULL THEN 1 ELSE 0 END) as no_result,
        SUM(CASE WHEN selector_errors_json IS NOT NULL THEN 1 ELSE 0 END) as selector_issues,
        SUM(CASE WHEN human_review = 'pending' THEN 1 ELSE 0 END) as pending_review,
        SUM(CASE WHEN review_result = 'correct' THEN 1 ELSE 0 END) as reviewed_correct,
        SUM(CASE WHEN review_result = 'incorrect' THEN 1 ELSE 0 END) as reviewed_incorrect,
        SUM(CASE WHEN review_result = 'needs_adjustment' THEN 1 ELSE 0 END) as reviewed_needs_adj,
        ROUND(AVG(CASE WHEN score > 0 THEN score END), 1) as avg_score
      FROM merge_verification_logs
    `).get();

    return NextResponse.json({ logs, total, limit, offset, report });
  } catch (error) {
    console.error("Merge verification GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/merge-verification
 *
 * レビュー結果を記録
 *
 * Body:
 *   id: number
 *   review_result: 'correct' | 'incorrect' | 'needs_adjustment'
 *   review_note: string (optional)
 */
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, review_result, review_note } = body;

    if (!id || !review_result) {
      return NextResponse.json({ error: "id and review_result required" }, { status: 400 });
    }

    const validResults = ["correct", "incorrect", "needs_adjustment"];
    if (!validResults.includes(review_result)) {
      return NextResponse.json({ error: `review_result must be one of: ${validResults.join(", ")}` }, { status: 400 });
    }

    const db = getDb();
    db.prepare(`
      UPDATE merge_verification_logs
      SET human_review = 'reviewed',
          review_result = ?,
          review_note = ?,
          reviewed_at = datetime('now')
      WHERE id = ?
    `).run(review_result, review_note || null, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Merge verification PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
