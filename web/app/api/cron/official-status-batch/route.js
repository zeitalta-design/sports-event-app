import { NextResponse } from "next/server";
import { batchUpdateOfficialStatuses } from "@/lib/official-entry-status";

/**
 * Phase73: official_entry_status 一括更新バッチ
 *
 * POST /api/cron/official-status-batch
 *
 * 既存の entry-status-monitor（ソースサイト巡回）とは別に、
 * DB上の情報から official_entry_status を再計算する軽量バッチ。
 *
 * - entry_status, entry_end_date, event_date, signals 等から判定
 * - 6時間以上未更新のイベントが対象
 * - entry-status-monitor で取得した最新テキストの反映にも使う
 *
 * 実行タイミング:
 *   - entry-status-monitor の後に連続実行（推奨）
 *   - 独立した定期ジョブとしても可（例: 毎時間）
 *
 * Query params:
 *   limit - 最大処理件数（デフォルト: 100、最大: 300）
 */
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "100", 10),
      300
    );

    const result = batchUpdateOfficialStatuses({ limit });

    return NextResponse.json({
      success: true,
      updated: result.updated,
      changes: result.changes,
      limit,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Official status batch error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/official-status-batch
 * ヘルスチェック用
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    description: "Official entry status batch updater. POST to run.",
  });
}
