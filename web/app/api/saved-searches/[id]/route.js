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
    const userKey = user.userKey;

    const result = db.prepare(
      "DELETE FROM saved_searches WHERE id = ? AND user_key = ?"
    ).run(id, userKey);

    if (result.changes === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/saved-searches/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
