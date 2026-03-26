import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { listDataSources, createDataSource } from "@/lib/core/automation/sync-logger";

export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { searchParams } = new URL(request.url);
    const sources = listDataSources({ domainId: searchParams.get("domain_id") || "" });
    return NextResponse.json({ sources });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const body = await request.json();
    if (!body.domain_id || !body.source_name) return NextResponse.json({ error: "domain_id と source_name は必須です" }, { status: 400 });
    const source = {
      domain_id: body.domain_id,
      source_name: body.source_name,
      source_type: body.source_type || "web",
      source_url: body.source_url || null,
      fetch_method: body.fetch_method || "manual",
      status: body.status || "active",
      review_policy: body.review_policy || "review_required",
      publish_policy: body.publish_policy || "manual",
      run_frequency: body.run_frequency || "daily",
      notes: body.notes || null,
    };
    const result = createDataSource(source);
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
