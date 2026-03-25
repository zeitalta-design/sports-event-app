import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getNyusatsuAdminById, updateNyusatsuItem } from "@/lib/repositories/nyusatsu";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";

export async function GET(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const item = getNyusatsuAdminById(Number(id));
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function PUT(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const numId = Number(id);
    const before = getNyusatsuAdminById(numId);
    const body = await request.json();
    if (!body.title) return NextResponse.json({ error: "title は必須です" }, { status: 400 });
    const item = { slug: body.slug || "", title: String(body.title).trim(), category: body.category || "other", issuer_name: body.issuer_name || null, target_area: body.target_area || null, deadline: body.deadline || null, budget_amount: body.budget_amount ? Number(body.budget_amount) : null, bidding_method: body.bidding_method || null, summary: body.summary || null, status: body.status || "open", is_published: body.is_published != null ? (body.is_published ? 1 : 0) : 1, qualification: body.qualification || null, announcement_url: body.announcement_url || null, contact_info: body.contact_info || null, delivery_location: body.delivery_location || null, has_attachment: body.has_attachment ? 1 : 0, announcement_date: body.announcement_date || null, contract_period: body.contract_period || null };
    updateNyusatsuItem(numId, item);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    const details = { domain: "nyusatsu", slug: item.slug, title: item.title };
    if (before && before.is_published !== item.is_published) details.is_published_changed = `${before.is_published} → ${item.is_published}`;
    writeAuditLog({ userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_UPDATED, targetType: "nyusatsu_item", targetId: String(numId), details, ipAddress, userAgent });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ error: "slug が重複しています" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
