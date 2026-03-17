import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRunnerStats } from "@/lib/runner-stats-service";

/**
 * Phase191: Runner Stats API
 * GET /api/runner-stats — ログインユーザーの実績統計
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const stats = getRunnerStats(user.id);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("GET /api/runner-stats error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
