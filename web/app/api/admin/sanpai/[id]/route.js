import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getSanpaiAdminById, updateSanpaiItem } from "@/lib/repositories/sanpai";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";

export async function GET(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const item = getSanpaiAdminById(Number(id));
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
    if (!body.company_name) return NextResponse.json({ error: "company_name は必須です" }, { status: 400 });
    const item = {
      slug: body.slug || "",
      company_name: String(body.company_name).trim(),
      prefecture: body.prefecture || null,
      license_type: body.license_type || null,
      license_number: body.license_number || null,
      risk_level: body.risk_level || "low",
      status: body.status || "active",
      business_area: body.business_area || null,
      notes: body.notes || null,
      is_published: body.is_published != null ? (body.is_published ? 1 : 0) : 1,
    };
    updateSanpaiItem(numId, item);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({
      userId: guard.user.id,
      action: AUDIT_ACTIONS.ADMIN_ITEM_UPDATED,
      targetType: "sanpai_item",
      targetId: String(numId),
      details: { domain: "sanpai", slug: item.slug, company_name: item.company_name },
      ipAddress, userAgent,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ error: "slug が重複しています" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
