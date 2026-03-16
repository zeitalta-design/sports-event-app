import { NextResponse } from "next/server";
import { runEntryStatusMonitor } from "@/lib/entry-monitor";

/**
 * POST /api/cron/entry-status-monitor
 *
 * 定期実行用: 受付状態の監視ジョブを実行する。
 * 外部cronサービスやVercel Cronから呼ばれる想定。
 *
 * Query params:
 *   limit - 最大監視件数（デフォルト: 30）
 *   delay - リクエスト間隔ms（デフォルト: 1500）
 */
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "30", 10);
    const delayMs = parseInt(searchParams.get("delay") || "1500", 10);

    const result = await runEntryStatusMonitor({
      limit: Math.min(limit, 100),
      delayMs: Math.max(delayMs, 500),
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("Entry status monitor cron error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/entry-status-monitor
 *
 * ヘルスチェック用
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    description: "Entry status monitor cron endpoint. POST to run.",
  });
}
