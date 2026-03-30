/**
 * POST /api/admin/watchlist/[id]/seen — 新着確認済みにする
 */

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { markAsSeen } from "@/lib/repositories/watched-organizations";

export async function POST(request, { params }) {
  const { user, error } = await requireAdminApi();
  if (error) return error;

  const { id } = await params;
  markAsSeen(user.id, Number(id));
  return NextResponse.json({ ok: true });
}
