import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getShiteiAdminById, updateShiteiItem } from "@/lib/repositories/shitei";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";

export async function GET(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const item = getShiteiAdminById(Number(id));
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const numId = Number(id);
    const body = await request.json();
    if (!body.title) return NextResponse.json({ error: "title は必須です" }, { status: 400 });
    const item = {
      slug: body.slug || "", title: String(body.title).trim(),
      municipality_name: body.municipality_name || null, prefecture: body.prefecture || null,
      facility_category: body.facility_category || null, facility_name: body.facility_name || null,
      recruitment_status: body.recruitment_status || "unknown",
      application_deadline: body.application_deadline || null,
      contract_start_date: body.contract_start_date || null, contract_end_date: body.contract_end_date || null,
      detail_url: body.detail_url || null, summary: body.summary || null,
      eligibility: body.eligibility || null,
      is_published: body.is_published != null ? (body.is_published ? 1 : 0) : 1,
    };
    updateShiteiItem(numId, item);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({
      userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_UPDATED,
      targetType: "shitei_item", targetId: String(numId),
      details: { domain: "shitei", slug: item.slug, title: item.title },
      ipAddress, userAgent,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ error: "slug が重複しています" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
