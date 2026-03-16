import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/admin/marathon-details
 * 大会一覧 + marathon_details有無
 *
 * Query params:
 *   q      - 大会名キーワード検索
 *   filter - "all" | "with_detail" | "without_detail"
 *   limit  - 取得件数（デフォルト100）
 *   offset - オフセット（デフォルト0）
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const filter = searchParams.get("filter") || "all";
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const db = getDb();

    let whereClause = "WHERE e.is_active = 1";
    const params = [];

    if (q) {
      whereClause += " AND e.title LIKE ?";
      params.push(`%${q}%`);
    }

    if (filter === "with_detail") {
      whereClause += " AND md.id IS NOT NULL";
    } else if (filter === "without_detail") {
      whereClause += " AND md.id IS NULL";
    }

    // 総件数
    const countRow = db
      .prepare(
        `SELECT COUNT(*) as total FROM events e
         LEFT JOIN marathon_details md ON md.marathon_id = e.id
         ${whereClause}`
      )
      .get(...params);

    // 一覧取得
    const rows = db
      .prepare(
        `SELECT e.id, e.title, e.event_date, e.prefecture, e.entry_status,
                md.id as detail_id, md.organizer_name, md.series_events_json,
                md.updated_at as detail_updated_at,
                md.tagline, md.summary
         FROM events e
         LEFT JOIN marathon_details md ON md.marathon_id = e.id
         ${whereClause}
         ORDER BY e.event_date DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    const events = rows.map((row) => ({
      id: row.id,
      title: row.title,
      event_date: row.event_date,
      prefecture: row.prefecture,
      entry_status: row.entry_status,
      has_detail: !!row.detail_id,
      organizer_name: row.organizer_name || null,
      has_series: !!(row.series_events_json && row.series_events_json !== "[]"),
      has_tagline: !!row.tagline,
      has_summary: !!row.summary,
      detail_updated_at: row.detail_updated_at || null,
    }));

    return NextResponse.json({
      events,
      total: countRow.total,
      limit,
      offset,
    });
  } catch (err) {
    console.error("Admin marathon-details list error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
