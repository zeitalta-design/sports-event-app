import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { markAsRead, markAsUnread } from "@/lib/user-notifications";

export async function PATCH(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json();

    const isRead = body.is_read !== undefined ? !!body.is_read : true;

    const result = isRead
      ? markAsRead(Number(id), user.userKey)
      : markAsUnread(Number(id), user.userKey);

    if (!result.success) {
      const status = result.error === "not_found" ? 404 : 403;
      const message = result.error === "not_found" ? "通知が見つかりません" : "権限がありません";
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("PATCH /api/notifications/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
