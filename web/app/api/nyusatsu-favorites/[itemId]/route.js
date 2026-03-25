import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    const { itemId } = await params;
    const db = getDb();
    db.prepare("DELETE FROM nyusatsu_favorites WHERE user_key = ? AND nyusatsu_id = ?").run(user.userKey, itemId);
    return NextResponse.json({ removed: true });
  } catch (error) {
    console.error("DELETE /api/nyusatsu-favorites error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
