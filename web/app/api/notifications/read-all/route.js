import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { markAllAsRead } from "@/lib/user-notifications";

export async function PATCH() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const result = markAllAsRead(user.userKey);

    return NextResponse.json(result);
  } catch (error) {
    console.error("PATCH /api/notifications/read-all error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
