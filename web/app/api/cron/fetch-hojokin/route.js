/**
 * 補助金 — J-Grants API 自動取得
 *
 * POST /api/cron/fetch-hojokin
 * J-Grants公開APIから補助金情報を取得しDBに登録。
 * コアロジックは `@/lib/hojokin-fetcher` に集約（CLI/GitHub Actions と共通）。
 *
 * Vercel Hobby の10秒制限があるため、API route 経由では `max=1` など
 * 少数キーワードのみ処理する。全キーワード取得は GitHub Actions で実行。
 */

import { NextResponse } from "next/server";
import { fetchAndUpsertHojokin } from "@/lib/hojokin-fetcher";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") === "true";
    const maxKeywords = Math.min(parseInt(searchParams.get("max") || "1", 10), 15);

    const result = await fetchAndUpsertHojokin({ maxKeywords, dryRun });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
