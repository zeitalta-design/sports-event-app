import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { listSyncRuns } from "@/lib/core/automation/sync-logger";

export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { searchParams } = new URL(request.url);
    return NextResponse.json(listSyncRuns({
      domainId: searchParams.get("domain_id") || "",
      limit: parseInt(searchParams.get("limit") || "50"),
      page: parseInt(searchParams.get("page") || "1"),
    }));
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
