/**
 * 行政処分DB — Cron自動取得API
 *
 * GET  /api/cron/fetch-gyosei-shobun              → ステータス確認（dry-run）
 * POST /api/cron/fetch-gyosei-shobun              → 実行
 * POST /api/cron/fetch-gyosei-shobun?sector=takuti → 宅建業を取得
 *
 * Vercel Cron または手動呼び出しで使用。
 * 認証: CRON_SECRET ヘッダー or 管理者セッション
 */

import { NextResponse } from "next/server";
import { runFetch } from "@/lib/gyosei-shobun-fetcher";

function verifyCronAuth(request) {
  // CRON_SECRET が設定されている場合はチェック
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth === `Bearer ${secret}`) return true;
  }
  // 管理者セッションでもOK
  const adminSession = request.cookies?.get?.("admin_session")?.value;
  if (adminSession) return true;
  // 開発環境ではスキップ
  if (!secret) return true;
  return false;
}

/** GET: ステータス確認（dry-run） */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sector = searchParams.get("sector") || "kensetugyousya";
    const result = await runFetch({ sector, maxPages: 1, dryRun: true });
    return NextResponse.json({ preview: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** POST: 実行 */
export async function POST(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const sector = searchParams.get("sector") || "kensetugyousya";
    const maxPages = Math.min(parseInt(searchParams.get("maxPages") || "3", 10), 10);
    const dryRun = searchParams.get("dryRun") === "true";

    const result = await runFetch({ sector, maxPages, dryRun });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
