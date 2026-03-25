import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getHojokinAdminById, updateHojokinItem } from "@/lib/repositories/hojokin";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";

export async function GET(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const item = getHojokinAdminById(Number(id));
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
    const before = getHojokinAdminById(numId);
    const body = await request.json();
    if (!body.title) return NextResponse.json({ error: "title は必須です" }, { status: 400 });
    const item = { slug: body.slug || "", title: String(body.title).trim(), category: body.category || "other", target_type: body.target_type || "corp", max_amount: body.max_amount ? Number(body.max_amount) : null, subsidy_rate: body.subsidy_rate || null, deadline: body.deadline || null, status: body.status || "open", provider_name: body.provider_name || null, summary: body.summary || null, is_published: body.is_published != null ? (body.is_published ? 1 : 0) : 1 };
    updateHojokinItem(numId, item);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    const details = { domain: "hojokin", slug: item.slug, title: item.title };
    if (before && before.is_published !== item.is_published) details.is_published_changed = `${before.is_published} → ${item.is_published}`;
    writeAuditLog({ userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_UPDATED, targetType: "hojokin_item", targetId: String(numId), details, ipAddress, userAgent });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ error: "slug が重複しています" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
