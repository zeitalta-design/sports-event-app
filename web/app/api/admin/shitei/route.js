import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { listShiteiAdminItems, createShiteiItem } from "@/lib/repositories/shitei";
import { calculateRecruitmentStatus } from "@/lib/shitei-config";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";

export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { searchParams } = new URL(request.url);
    return NextResponse.json(listShiteiAdminItems({ keyword: searchParams.get("keyword") || "", page: parseInt(searchParams.get("page") || "1") }));
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const body = await request.json();
    if (!body.title) return NextResponse.json({ error: "title は必須です" }, { status: 400 });
    const item = {
      slug: body.slug || "",
      title: String(body.title).trim(),
      municipality_name: body.municipality_name || null,
      prefecture: body.prefecture || null,
      facility_category: body.facility_category || "other",
      facility_name: body.facility_name || null,
      recruitment_status: body.recruitment_status || "unknown",
      application_start_date: body.application_start_date || null,
      application_deadline: body.application_deadline || null,
      opening_date: body.opening_date || null,
      contract_start_date: body.contract_start_date || null,
      contract_end_date: body.contract_end_date || null,
      summary: body.summary || null,
      eligibility: body.eligibility || null,
      application_method: body.application_method || null,
      detail_url: body.detail_url || null,
      source_name: body.source_name || null,
      source_url: body.source_url || null,
      attachment_count: body.attachment_count || 0,
      notes: body.notes || null,
      is_published: body.is_published != null ? (body.is_published ? 1 : 0) : 1,
      published_at: body.published_at || null,
    };
    item.recruitment_status = calculateRecruitmentStatus(item);
    const result = createShiteiItem(item);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({ userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_CREATED, targetType: "shitei_item", targetId: String(result.id), details: { domain: "shitei", slug: item.slug, title: item.title }, ipAddress, userAgent });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ error: "slug が重複しています" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
