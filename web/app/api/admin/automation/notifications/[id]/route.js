import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { markNotificationRead } from "@/lib/core/automation/publish-decision";

export async function PUT(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    markNotificationRead(Number(id));
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
