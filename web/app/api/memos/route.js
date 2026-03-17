import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getUserEventMemos,
  saveUserMemo,
  deleteUserEventMemos,
  getUserMemoSummary,
} from "@/lib/memo-service";

/**
 * Phase171: メモAPI
 *
 * GET  /api/memos?event_id=X   → 特定大会のメモ取得
 * GET  /api/memos?summary=1    → 全大会メモサマリー
 * POST /api/memos              → メモ保存
 * DELETE /api/memos             → 大会メモ全削除
 */

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  // サマリー取得
  if (searchParams.get("summary") === "1") {
    const summary = getUserMemoSummary(user.id);
    return NextResponse.json({ summary });
  }

  // 特定大会メモ取得
  const eventId = parseInt(searchParams.get("event_id"), 10);
  if (!eventId) {
    return NextResponse.json({ error: "event_id required" }, { status: 400 });
  }

  const memos = getUserEventMemos(user.id, eventId);
  return NextResponse.json({ memos });
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { event_id, category, text } = body;

    if (!event_id || !category) {
      return NextResponse.json({ error: "event_id and category required" }, { status: 400 });
    }

    const result = saveUserMemo(user.id, event_id, category, text || "");
    return NextResponse.json(result);
  } catch (err) {
    console.error("Memo save error:", err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}

export async function DELETE(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { event_id } = body;

    if (!event_id) {
      return NextResponse.json({ error: "event_id required" }, { status: 400 });
    }

    const result = deleteUserEventMemos(user.id, event_id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Memo delete error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
