import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyEventSources } from "@/lib/event-source-verifier";
import { getEventsWithMultipleSources, getSourceLinkStats } from "@/lib/event-sources";

/**
 * GET /api/admin/verification-conflicts
 *
 * 矛盾管理のサマリー・一覧を返す
 *
 * Query params:
 *   view   - "stats" (デフォルト) | "conflicts" | "all"
 *   limit  - 件数制限
 *   offset - オフセット
 */
export async function GET(request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "stats";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // 統計
    const conflictStats = db
      .prepare(
        `SELECT
          COUNT(*) as total_events,
          SUM(CASE WHEN verification_conflict = 1 THEN 1 ELSE 0 END) as conflict_count,
          SUM(CASE WHEN verification_conflict_level >= 3 THEN 1 ELSE 0 END) as level3,
          SUM(CASE WHEN verification_conflict_level = 2 THEN 1 ELSE 0 END) as level2,
          SUM(CASE WHEN verification_conflict_level = 1 THEN 1 ELSE 0 END) as level1,
          SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END) as verified,
          SUM(CASE WHEN verification_status = 'single_source' THEN 1 ELSE 0 END) as single_source,
          SUM(CASE WHEN verification_status = 'unverified' OR verification_status IS NULL THEN 1 ELSE 0 END) as unverified
         FROM events
         WHERE is_active = 1
           AND (event_date IS NULL OR event_date >= date('now', '-1 day'))`
      )
      .get();

    const sourceLinkStats = getSourceLinkStats();

    if (view === "conflicts") {
      // 矛盾ありのみ
      const conflicts = db
        .prepare(
          `SELECT id, title, event_date, entry_status, source_url, source_site,
                  verification_status, verification_conflict_level,
                  verification_conflict_summary, verification_conflict_updated_at,
                  last_verified_at
           FROM events
           WHERE is_active = 1
             AND verification_conflict = 1
           ORDER BY verification_conflict_level DESC, event_date ASC
           LIMIT ? OFFSET ?`
        )
        .all(limit, offset);

      return NextResponse.json({
        success: true,
        stats: conflictStats,
        sourceLinkStats,
        conflicts,
      });
    }

    if (view === "all") {
      // 全検証済み
      const events = db
        .prepare(
          `SELECT id, title, event_date, entry_status, source_url, source_site,
                  verification_status, verification_conflict_level,
                  verification_conflict_summary, verification_conflict_updated_at,
                  last_verified_at
           FROM events
           WHERE is_active = 1
             AND verification_status IS NOT NULL
             AND verification_status != 'unverified'
           ORDER BY verification_conflict_level DESC, event_date ASC
           LIMIT ? OFFSET ?`
        )
        .all(limit, offset);

      return NextResponse.json({
        success: true,
        stats: conflictStats,
        sourceLinkStats,
        events,
      });
    }

    // Default: stats + recent conflicts + multi-source events
    const recentConflicts = db
      .prepare(
        `SELECT id, title, event_date, entry_status, source_url,
                verification_status, verification_conflict_level,
                verification_conflict_summary, verification_conflict_updated_at
         FROM events
         WHERE is_active = 1
           AND verification_conflict = 1
         ORDER BY verification_conflict_updated_at DESC
         LIMIT 20`
      )
      .all();

    const multiSourceEvents = getEventsWithMultipleSources({ limit: 30 });

    return NextResponse.json({
      success: true,
      stats: conflictStats,
      sourceLinkStats,
      recentConflicts,
      multiSourceEvents,
    });
  } catch (err) {
    console.error("Verification conflicts admin error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/verification-conflicts
 *
 * 再検証実行
 *
 * Body:
 *   action  - "verify" (デフォルト)
 *   limit   - 最大検証件数（デフォルト: 10）
 *   eventId - 単体指定
 *   conflictOnly - true なら矛盾ありのみ
 */
export async function POST(request) {
  try {
    const db = getDb();
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(body.limit || 10, 50);
    const eventId = body.eventId;
    const conflictOnly = body.conflictOnly || false;

    let events;
    if (eventId) {
      events = db.prepare("SELECT * FROM events WHERE id = ? AND is_active = 1").all(eventId);
    } else if (conflictOnly) {
      events = db
        .prepare(
          `SELECT * FROM events
           WHERE is_active = 1 AND verification_conflict = 1
           ORDER BY verification_conflict_level DESC
           LIMIT ?`
        )
        .all(limit);
    } else {
      events = getEventsWithMultipleSources({ limit });
      // Re-fetch full event records
      if (events.length > 0) {
        const ids = events.map((e) => e.id);
        events = db
          .prepare(
            `SELECT * FROM events WHERE id IN (${ids.map(() => "?").join(",")}) AND is_active = 1`
          )
          .all(...ids);
      }
    }

    const results = {
      total: events.length,
      verified: 0,
      conflicts: 0,
      singleSource: 0,
      errors: [],
    };

    for (const event of events) {
      try {
        const verifyResult = await verifyEventSources(event, { delayMs: 1000 });
        results.verified++;
        if (verifyResult.conflict?.conflict) {
          results.conflicts++;
        }
        if (verifyResult.reason === "single_source") {
          results.singleSource++;
        }
      } catch (err) {
        results.errors.push({
          eventId: event.id,
          title: event.title,
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (err) {
    console.error("Verification conflicts run error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
