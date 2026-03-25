import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }
    const { id } = await params;
    const db = getDb();
    db.prepare(
      "DELETE FROM item_saved_searches WHERE id = ? AND user_key = ?"
    ).run(id, user.userKey);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/item-saved-searches/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
