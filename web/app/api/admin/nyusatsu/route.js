import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { listNyusatsuAdminItems, createNyusatsuItem } from "@/lib/repositories/nyusatsu";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";

export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { searchParams } = new URL(request.url);
    return NextResponse.json(listNyusatsuAdminItems({ keyword: searchParams.get("keyword") || "", page: parseInt(searchParams.get("page") || "1") }));
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const body = await request.json();
    if (!body.title) return NextResponse.json({ error: "title は必須です" }, { status: 400 });
    const item = { slug: body.slug || "", title: String(body.title).trim(), category: body.category || "other", issuer_name: body.issuer_name || null, target_area: body.target_area || null, deadline: body.deadline || null, budget_amount: body.budget_amount ? Number(body.budget_amount) : null, bidding_method: body.bidding_method || null, summary: body.summary || null, status: body.status || "open", is_published: body.is_published != null ? (body.is_published ? 1 : 0) : 1, qualification: body.qualification || null, announcement_url: body.announcement_url || null, contact_info: body.contact_info || null, delivery_location: body.delivery_location || null, has_attachment: body.has_attachment ? 1 : 0, announcement_date: body.announcement_date || null, contract_period: body.contract_period || null };
    const result = createNyusatsuItem(item);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({ userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_CREATED, targetType: "nyusatsu_item", targetId: String(result.id), details: { domain: "nyusatsu", slug: item.slug, title: item.title }, ipAddress, userAgent });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ error: "slug が重複しています" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
