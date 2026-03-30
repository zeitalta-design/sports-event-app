/**
 * GET  /api/admin/watchlist — ウォッチ一覧取得
 * POST /api/admin/watchlist — ウォッチ登録
 * DELETE /api/admin/watchlist — ウォッチ解除
 *
 * 一括確認済みは POST /api/admin/watchlist/seen を使用
 */

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import {
  listWatches,
  addWatch,
  removeWatch,
  removeWatchById,
  getWatchedOrgSet,
} from "@/lib/repositories/watched-organizations";

export async function GET(request) {
  const { user, error } = await requireAdminApi();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");

  // mode=set: ウォッチ済み企業名セットを返す（一覧画面のボタン判定用）
  if (mode === "set") {
    const set = getWatchedOrgSet(user.id);
    return NextResponse.json({ watchedKeys: [...set] });
  }

  const items = listWatches(user.id);
  return NextResponse.json({ items, total: items.length });
}

export async function POST(request) {
  const { user, error } = await requireAdminApi();
  if (error) return error;

  const body = await request.json();
  const { organization_name, industry } = body;

  if (!organization_name) {
    return NextResponse.json({ error: "organization_name is required" }, { status: 400 });
  }

  const result = addWatch(user.id, organization_name, industry || "");
  return NextResponse.json(result, { status: result.action === "added" ? 201 : 200 });
}

export async function DELETE(request) {
  const { user, error } = await requireAdminApi();
  if (error) return error;

  const body = await request.json();

  // id で解除 or organization_name + industry で解除
  if (body.id) {
    const result = removeWatchById(user.id, body.id);
    return NextResponse.json(result);
  }

  const { organization_name, industry } = body;
  if (!organization_name) {
    return NextResponse.json({ error: "organization_name or id is required" }, { status: 400 });
  }

  const result = removeWatch(user.id, organization_name, industry || "");
  return NextResponse.json(result);
}
