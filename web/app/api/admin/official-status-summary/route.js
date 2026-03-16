import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * Phase78: 運用管理 — official_entry_status 集計API
 *
 * GET /api/admin/official-status-summary
 *
 * 返す情報:
 *   statusCounts  - ステータス別件数
 *   freshness     - 鮮度分布
 *   confidenceDist - confidence 分布
 *   recentChanges - 直近の状態変化
 *   staleEvents   - 長時間未確認イベント
 */
export async function GET() {
  try {
    const db = getDb();

    // 1. ステータス別件数
    const statusCounts = db
      .prepare(`
        SELECT
          COALESCE(official_entry_status, 'unset') as status,
          COUNT(*) as count
        FROM events
        WHERE is_active = 1
          AND (event_date IS NULL OR event_date >= date('now', '-1 day'))
        GROUP BY COALESCE(official_entry_status, 'unset')
        ORDER BY count DESC
      `)
      .all();

    // 2. 鮮度分布
    const freshness = db
      .prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN official_checked_at IS NULL THEN 1 ELSE 0 END) as never_checked,
          SUM(CASE WHEN official_checked_at >= datetime('now', '-6 hours') THEN 1 ELSE 0 END) as fresh_6h,
          SUM(CASE WHEN official_checked_at >= datetime('now', '-24 hours') AND official_checked_at < datetime('now', '-6 hours') THEN 1 ELSE 0 END) as normal_24h,
          SUM(CASE WHEN official_checked_at >= datetime('now', '-72 hours') AND official_checked_at < datetime('now', '-24 hours') THEN 1 ELSE 0 END) as stale_72h,
          SUM(CASE WHEN official_checked_at < datetime('now', '-72 hours') THEN 1 ELSE 0 END) as very_stale
        FROM events
        WHERE is_active = 1
          AND (event_date IS NULL OR event_date >= date('now', '-1 day'))
      `)
      .get();

    // 3. confidence 分布
    const confidenceDist = db
      .prepare(`
        SELECT
          SUM(CASE WHEN official_status_confidence >= 80 THEN 1 ELSE 0 END) as high,
          SUM(CASE WHEN official_status_confidence >= 60 AND official_status_confidence < 80 THEN 1 ELSE 0 END) as medium,
          SUM(CASE WHEN official_status_confidence >= 40 AND official_status_confidence < 60 THEN 1 ELSE 0 END) as low,
          SUM(CASE WHEN official_status_confidence < 40 OR official_status_confidence IS NULL THEN 1 ELSE 0 END) as unknown
        FROM events
        WHERE is_active = 1
          AND (event_date IS NULL OR event_date >= date('now', '-1 day'))
      `)
      .get();

    // 4. 直近の状態変化（24時間以内）
    const recentChanges = db
      .prepare(`
        SELECT esc.id, esc.event_id, esc.previous_status, esc.new_status,
               esc.previous_label, esc.new_label, esc.confidence,
               esc.note, esc.created_at,
               e.title as event_title
        FROM entry_status_changes esc
        JOIN events e ON e.id = esc.event_id
        WHERE esc.created_at >= datetime('now', '-24 hours')
        ORDER BY esc.created_at DESC
        LIMIT 20
      `)
      .all();

    // 5. 長時間未確認の受付中イベント (Phase79: awaiting_update も含める)
    const staleEvents = db
      .prepare(`
        SELECT id, title, official_entry_status, official_entry_status_label,
               official_checked_at, official_status_confidence, entry_end_date,
               official_unknown_reason
        FROM events
        WHERE is_active = 1
          AND (event_date IS NULL OR event_date >= date('now'))
          AND (
            official_entry_status IN ('open', 'closing_soon', 'capacity_warning', 'awaiting_update')
            OR (official_entry_status IN ('open', 'closing_soon', 'capacity_warning')
                AND (official_checked_at IS NULL OR official_checked_at < datetime('now', '-24 hours')))
          )
        ORDER BY entry_end_date ASC NULLS LAST
        LIMIT 30
      `)
      .all();

    // Phase79: unknown理由別件数
    const unknownReasonCounts = db
      .prepare(`
        SELECT
          COALESCE(official_unknown_reason, 'unset') as reason,
          COUNT(*) as count
        FROM events
        WHERE is_active = 1
          AND (event_date IS NULL OR event_date >= date('now', '-1 day'))
          AND official_entry_status IN ('unknown', 'awaiting_update')
        GROUP BY COALESCE(official_unknown_reason, 'unset')
        ORDER BY count DESC
      `)
      .all();

    // Phase79: ソース種別別件数
    const sourceTypeCounts = db
      .prepare(`
        SELECT
          COALESCE(official_status_source_type, 'unset') as source_type,
          COUNT(*) as count,
          ROUND(AVG(official_status_confidence), 1) as avg_confidence
        FROM events
        WHERE is_active = 1
          AND (event_date IS NULL OR event_date >= date('now', '-1 day'))
          AND official_entry_status IS NOT NULL
        GROUP BY COALESCE(official_status_source_type, 'unset')
        ORDER BY count DESC
      `)
      .all();

    return NextResponse.json({
      statusCounts,
      freshness,
      confidenceDist,
      recentChanges,
      staleEvents,
      unknownReasonCounts,
      sourceTypeCounts,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Admin official status summary error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
