import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { listSanpaiAdminItems, createSanpaiItem } from "@/lib/repositories/sanpai";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";

export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { searchParams } = new URL(request.url);
    return NextResponse.json(listSanpaiAdminItems({ keyword: searchParams.get("keyword") || "", page: parseInt(searchParams.get("page") || "1") }));
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const body = await request.json();
    if (!body.company_name) return NextResponse.json({ error: "company_name は必須です" }, { status: 400 });
    const item = {
      slug: body.slug || "",
      company_name: String(body.company_name).trim(),
      corporate_number: body.corporate_number || null,
      prefecture: body.prefecture || null,
      city: body.city || null,
      license_type: body.license_type || "other",
      waste_category: body.waste_category || "industrial",
      business_area: body.business_area || null,
      status: body.status || "active",
      risk_level: body.risk_level || "none",
      penalty_count: body.penalty_count || 0,
      latest_penalty_date: body.latest_penalty_date || null,
      source_name: body.source_name || null,
      source_url: body.source_url || null,
      detail_url: body.detail_url || null,
      notes: body.notes || null,
      is_published: body.is_published != null ? (body.is_published ? 1 : 0) : 1,
      published_at: body.published_at || null,
    };
    const result = createSanpaiItem(item);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({ userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_CREATED, targetType: "sanpai_item", targetId: String(result.id), details: { domain: "sanpai", slug: item.slug, company_name: item.company_name }, ipAddress, userAgent });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ error: "slug が重複しています" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
