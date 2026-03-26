import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { listChangeLogs, getReviewPendingCount } from "@/lib/core/automation/change-detector";

export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { searchParams } = new URL(request.url);
    const result = listChangeLogs({
      domainId: searchParams.get("domain_id") || "",
      changeType: searchParams.get("change_type") || "",
      requiresReview: searchParams.get("requires_review") === "true" ? true : searchParams.get("requires_review") === "false" ? false : null,
      limit: parseInt(searchParams.get("limit") || "50"),
      page: parseInt(searchParams.get("page") || "1"),
    });
    const reviewPending = getReviewPendingCount(searchParams.get("domain_id") || "");
    return NextResponse.json({ ...result, reviewPending });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
