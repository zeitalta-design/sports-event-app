/**
 * GET  /api/watchlist  — ウォッチ一覧（一般ユーザー）
 * POST /api/watchlist  — ウォッチ追加
 * DELETE /api/watchlist — ウォッチ解除
 *
 * 無料ユーザー: 最大3件まで
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  listWatches,
  addWatch,
  removeWatch,
  removeWatchById,
  getWatchedOrgSet,
} from "@/lib/repositories/watched-organizations";

const FREE_WATCH_LIMIT = 3;

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode === "set") {
      const set = getWatchedOrgSet(user.id);
      return NextResponse.json({ watchedKeys: [...set] });
    }

    const items = listWatches(user.id);
    return NextResponse.json({ items, total: items.length, limit: FREE_WATCH_LIMIT });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { organization_name, industry } = body;
    if (!organization_name) {
      return NextResponse.json({ error: "organization_name is required" }, { status: 400 });
    }

    // 無料ユーザー: 3件制限
    const existing = listWatches(user.id);
    if (existing.length >= FREE_WATCH_LIMIT) {
      return NextResponse.json(
        { error: "WATCH_LIMIT_REACHED", message: `ウォッチ登録は最大${FREE_WATCH_LIMIT}件までです。` },
        { status: 403 }
      );
    }

    const result = addWatch(user.id, organization_name, industry || "");
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    if (body.id) {
      const result = removeWatchById(user.id, body.id);
      return NextResponse.json(result);
    }
    const { organization_name, industry } = body;
    const result = removeWatch(user.id, organization_name, industry || "");
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
