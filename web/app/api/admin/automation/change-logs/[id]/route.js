import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { markAsReviewed } from "@/lib/core/automation/change-detector";

export async function PUT(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const body = await request.json();
    if (body.action === "mark_reviewed") {
      markAsReviewed(Number(id), guard.user?.email || "admin");
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
