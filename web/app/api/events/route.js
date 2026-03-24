import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getEventDisplayStatus } from "@/lib/entry-status";
import { getAllEventActivityMetrics } from "@/lib/event-activity";
import { calculatePopularityScore, getPopularityLabel } from "@/lib/event-popularity";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sportType = searchParams.get("sport_type") || "marathon";
    const prefecture = searchParams.get("prefecture");
    const month = searchParams.get("month");
    const keyword = searchParams.get("keyword");
    const distance = searchParams.get("distance");
    const sort = searchParams.get("sort") || "event_date";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = (page - 1) * limit;

    const db = getDb();
    // 過去開催大会の公開ルール: 終了後31日以降は一般一覧から除外
    // ただし event_date が NULL の場合は除外しない（日付未設定は表示継続）
    const archiveCutoff = new Date(Date.now() - 31 * 86400000).toISOString().split("T")[0];
    let where = [
      "e.is_active = 1",
      "e.canonical_event_id IS NULL",
      "e.sport_type = ?",
      "(e.event_date IS NULL OR e.event_date = '' OR e.event_date >= ?)",
    ];
    let params = [sportType, archiveCutoff];
    let joins = "";

    if (prefecture) {
      where.push("e.prefecture = ?");
      params.push(prefecture);
    }
    if (month) {
      where.push("e.event_month = ?");
      params.push(month);
    }
    if (keyword) {
      where.push("(e.title LIKE ? OR e.normalized_title LIKE ? OR e.venue_name LIKE ?)");
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw);
    }
    // Phase113: 募集状況フィルタ
    const entryStatusFilter = searchParams.get("entry_status");
    if (entryStatusFilter) {
      where.push("e.entry_status = ?");
      params.push(entryStatusFilter);
    }

    if (distance) {
      const ranges = {
        "5": [0, 5],
        "10": [5.1, 10],
        "half": [20, 22],
        "full": [42, 43],
        "ultra": [43.1, 999],
        // Phase52: trail用距離帯
        "short": [0, 20],
        "middle": [20.1, 50],
        "long": [50.1, 999],
      };
      const range = ranges[distance];
      if (range) {
        joins = "JOIN event_races er_filter ON er_filter.event_id = e.id";
        where.push("er_filter.distance_km >= ? AND er_filter.distance_km <= ?");
        params.push(range[0], range[1]);
      }
    }

    const whereClause = where.join(" AND ");

    const countRow = db.prepare(
      `SELECT COUNT(DISTINCT e.id) as total FROM events e ${joins} WHERE ${whereClause}`
    ).get(...params);

    // popularity ソートの場合は全件取得後にJSでソート
    const isPopularitySort = sort === "popularity";

    const orderClauses = {
      event_date: "e.event_date ASC",
      entry_end_date: "e.entry_end_date ASC NULLS LAST",
      newest: "e.created_at DESC",
      popularity: "e.event_date ASC", // 一旦全件取得用（後でJSソート）
      // Phase113: 募集状況優先ソート（受付中→受付予定→その他）
      entry_status_priority: "CASE e.entry_status WHEN 'open' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END ASC, e.event_date ASC",
    };
    const orderBy = orderClauses[sort] || orderClauses.event_date;

    // popularity ソートは全件取得してJSでソートするため LIMIT/OFFSET を後で適用
    if (isPopularitySort) {
      const allEvents = db.prepare(`
        SELECT e.*,
          (SELECT GROUP_CONCAT(er.race_name, ', ')
           FROM event_races er WHERE er.event_id = e.id
           ORDER BY er.sort_order LIMIT 5
          ) as race_names,
          (SELECT GROUP_CONCAT(d, ',') FROM (
             SELECT DISTINCT CAST(er.distance_km AS TEXT) as d
             FROM event_races er WHERE er.event_id = e.id AND er.distance_km IS NOT NULL
           )) as distance_list,
          (SELECT SUM(er2.capacity)
           FROM event_races er2 WHERE er2.event_id = e.id AND er2.capacity IS NOT NULL
          ) as total_capacity,
          (SELECT COUNT(*)
           FROM event_reviews rv WHERE rv.event_id = e.id
          ) as review_count,
          (SELECT COUNT(*) FROM favorites f WHERE f.event_id = e.id) as fav_count
        FROM events e
        ${joins}
        WHERE ${whereClause}
        GROUP BY e.id
      `).all(...params);

      // 行動ログメトリクスを一括取得
      const activityMap = getAllEventActivityMetrics({ days: 30, limit: 500 });

      // スコア計算 + ソート
      const scored = allEvents.map((e) => {
        const displayStatus = getEventDisplayStatus(e);
        const activity = activityMap.get(e.id) || { detail_views: 0, favorites: 0, entry_clicks: 0 };
        const favoritesForScore = activity.favorites > 0 ? activity.favorites : (e.fav_count || 0);
        const metrics = { detail_views: activity.detail_views, favorites: favoritesForScore, entry_clicks: activity.entry_clicks };
        const { raw_score, popularity_score } = calculatePopularityScore(metrics);
        const popLabel = getPopularityLabel(popularity_score);
        return {
          ...e,
          entry_status_raw: e.entry_status,
          entry_status: displayStatus.status,
          entry_status_label: displayStatus.label,
          popularity_score,
          popularity_label: popLabel?.label || null,
          popularity_key: popLabel?.key || null,
        };
      });

      scored.sort((a, b) => {
        if (b.popularity_score !== a.popularity_score) return b.popularity_score - a.popularity_score;
        return b.id - a.id;
      });

      const totalPages = Math.ceil(countRow.total / limit);
      const paged = scored.slice(offset, offset + limit);

      return NextResponse.json({
        events: paged,
        total: countRow.total,
        page,
        totalPages,
        limit,
      });
    }

    // 通常ソート
    params.push(limit, offset);
    const events = db.prepare(`
      SELECT e.*,
        (SELECT GROUP_CONCAT(er.race_name, ', ')
         FROM event_races er WHERE er.event_id = e.id
         ORDER BY er.sort_order LIMIT 5
        ) as race_names,
        (SELECT GROUP_CONCAT(d, ',') FROM (
           SELECT DISTINCT CAST(er.distance_km AS TEXT) as d
           FROM event_races er WHERE er.event_id = e.id AND er.distance_km IS NOT NULL
         )) as distance_list,
        (SELECT SUM(er2.capacity)
         FROM event_races er2 WHERE er2.event_id = e.id AND er2.capacity IS NOT NULL
        ) as total_capacity,
        (SELECT COUNT(*)
         FROM event_reviews rv WHERE rv.event_id = e.id
        ) as review_count,
        (SELECT COUNT(*) FROM favorites f WHERE f.event_id = e.id) as fav_count
      FROM events e
      ${joins}
      WHERE ${whereClause}
      GROUP BY e.id
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...params);

    const totalPages = Math.ceil(countRow.total / limit);

    // 行動ログメトリクスを一括取得（人気バッジ表示用）
    const eventIds = events.map((e) => e.id);
    const activityMap = eventIds.length > 0 ? getAllEventActivityMetrics({ days: 30, limit: 500 }) : new Map();

    // 受付状態を日付ロジックで再計算 + 人気指数付与
    const eventsWithStatus = events.map((e) => {
      const displayStatus = getEventDisplayStatus(e);
      const activity = activityMap.get(e.id) || { detail_views: 0, favorites: 0, entry_clicks: 0 };
      const favoritesForScore = activity.favorites > 0 ? activity.favorites : (e.fav_count || 0);
      const metrics = { detail_views: activity.detail_views, favorites: favoritesForScore, entry_clicks: activity.entry_clicks };
      const { popularity_score } = calculatePopularityScore(metrics);
      const popLabel = getPopularityLabel(popularity_score);
      return {
        ...e,
        entry_status_raw: e.entry_status,
        entry_status: displayStatus.status,
        entry_status_label: displayStatus.label,
        popularity_score,
        popularity_label: popLabel?.label || null,
        popularity_key: popLabel?.key || null,
      };
    });

    return NextResponse.json({
      events: eventsWithStatus,
      total: countRow.total,
      page,
      totalPages,
      limit,
    });
  } catch (error) {
    console.error("GET /api/events error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
