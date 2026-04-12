/**
 * 都道府県別行政処分 — Cron自動取得API
 *
 * GET  /api/cron/fetch-prefecture-shobun               → 対応県一覧（dry-run）
 * POST /api/cron/fetch-prefecture-shobun               → 全対応県を実行（最大5県）
 * POST /api/cron/fetch-prefecture-shobun?prefs=tokyo,osaka → 指定県のみ実行
 */

import { NextResponse } from "next/server";
import { runPrefectureFetch, getSupportedPrefectures } from "@/lib/prefecture-scraper";

function verifyCronAuth(request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth === `Bearer ${secret}`) return true;
  }
  const adminSession = request.cookies?.get?.("admin_session")?.value;
  if (adminSession) return true;
  if (!secret) return true;
  return false;
}

export async function GET() {
  const supported = getSupportedPrefectures();
  return NextResponse.json({
    supported,
    count: supported.length,
    note: "POST で実行。?prefs=tokyo,osaka で指定県のみ実行可能。",
  });
}

export async function POST(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const prefsParam = searchParams.get("prefs");
    const dryRun = searchParams.get("dryRun") === "true";
    const maxPrefectures = Math.min(parseInt(searchParams.get("max") || "5", 10), 10);

    const prefectures = prefsParam ? prefsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

    const result = await runPrefectureFetch({ prefectures, maxPrefectures, dryRun });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
