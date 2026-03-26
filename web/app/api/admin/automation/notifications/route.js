import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { listAdminNotifications, getUnreadNotificationCount } from "@/lib/core/automation/publish-decision";

export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { searchParams } = new URL(request.url);
    const result = listAdminNotifications({
      domainId: searchParams.get("domain_id") || "",
      unreadOnly: searchParams.get("unread_only") === "true",
      limit: parseInt(searchParams.get("limit") || "50"),
      page: parseInt(searchParams.get("page") || "1"),
    });
    const unreadCount = getUnreadNotificationCount(searchParams.get("domain_id") || "");
    return NextResponse.json({ ...result, unreadCount });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
