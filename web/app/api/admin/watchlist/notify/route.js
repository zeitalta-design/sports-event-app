/**
 * POST /api/admin/watchlist/notify — ウォッチ通知を実行
 *
 * body: { dryRun?: boolean }
 *
 * 認証: admin セッション（管理画面ボタン）or CRON_SECRET（自動実行）
 */

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { runWatchlistNotifications } from "@/lib/watchlist-notification-service";

export const dynamic = "force-dynamic";

function verifyCronSecret(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(request) {
  // CRON_SECRET or admin session
  const isCron = verifyCronSecret(request);
  if (!isCron) {
    const { error } = await requireAdminApi();
    if (error) return error;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = !!body.dryRun;

    const result = await runWatchlistNotifications({ dryRun });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
