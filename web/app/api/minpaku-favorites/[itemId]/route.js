import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    const { itemId } = await params;
    getDb().prepare("DELETE FROM minpaku_favorites WHERE user_key = ? AND minpaku_id = ?").run(user.userKey, itemId);
    return NextResponse.json({ removed: true });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
