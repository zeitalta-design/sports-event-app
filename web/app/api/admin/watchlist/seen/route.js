/**
 * POST /api/admin/watchlist/seen — 全件確認済みにする
 */

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { markAllAsSeen } from "@/lib/repositories/watched-organizations";

export async function POST(request) {
  const { user, error } = await requireAdminApi();
  if (error) return error;

  markAllAsSeen(user.id);
  return NextResponse.json({ ok: true });
}
