import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * Phase60: GET /api/events/by-ids?ids=1,2,3
 *
 * 複数大会IDから通知センター用の軽量情報を一括取得する。
 * 保存済み大会・比較候補の状態チェックに使用。
 *
 * 返却フィールド:
 *   id, title, sport_type, event_date, prefecture, city,
 *   entry_status, entry_end_date, source_url, notes,
 *   capacity_info, last_verified_at, summary
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");

    if (!idsParam) {
      return NextResponse.json({ events: [] });
    }

    const ids = idsParam
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0)
      .slice(0, 30); // 最大30件

    if (ids.length === 0) {
      return NextResponse.json({ events: [] });
    }

    const db = getDb();

    // events テーブルから基本情報を取得
    const placeholders = ids.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT
           e.id,
           e.title,
           e.sport_type,
           e.event_date,
           e.prefecture,
           e.city,
           e.entry_status,
           e.entry_start_date,
           e.entry_end_date,
           e.source_url,
           e.last_verified_at,
           d.summary,
           d.notes,
           d.capacity_info,
           d.venue_name
         FROM events e
         LEFT JOIN marathon_details d ON d.marathon_id = e.id
         WHERE e.id IN (${placeholders})
           AND e.is_active = 1`
      )
      .all(...ids);

    // sportSlug を決定して path を生成
    const events = rows.map((row) => {
      const sportSlug = mapSportTypeToSlug(row.sport_type);
      const path =
        sportSlug === "marathon"
          ? `/marathon/${row.id}`
          : `/${sportSlug}/${row.id}`;

      return {
        id: row.id,
        title: row.title,
        sport_slug: sportSlug,
        event_date: row.event_date,
        prefecture: row.prefecture,
        city: row.city,
        entry_status: row.entry_status,
        entry_start_date: row.entry_start_date,
        entry_end_date: row.entry_end_date,
        source_url: row.source_url,
        last_verified_at: row.last_verified_at,
        summary: row.summary ? row.summary.slice(0, 200) : null,
        notes: row.notes ? row.notes.slice(0, 300) : null,
        capacity_info: row.capacity_info || null,
        venue_name: row.venue_name || null,
        path,
      };
    });

    return NextResponse.json({ events });
  } catch (err) {
    console.error("Events by-ids API error:", err);
    return NextResponse.json(
      { events: [], error: err.message },
      { status: 500 }
    );
  }
}

/**
 * sport_type → URL slug 変換
 */
function mapSportTypeToSlug(sportType) {
  const map = {
    marathon: "marathon",
    running: "marathon",
    trail: "trail",
    trail_running: "trail",
  };
  return map[sportType] || "marathon";
}
