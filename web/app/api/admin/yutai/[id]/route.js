import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getYutaiAdminById, updateYutaiItem } from "@/lib/repositories/yutai";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";

export async function GET(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const item = getYutaiAdminById(Number(id));
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
    const before = getYutaiAdminById(numId);
    const body = await request.json();
    if (!body.title) return NextResponse.json({ error: "title は必須です" }, { status: 400 });
    const item = {
      code: String(body.code || "").trim(), slug: body.slug || "", title: String(body.title).trim(),
      category: body.category || "other", confirm_months: body.confirm_months || "[]",
      min_investment: body.min_investment ? Number(body.min_investment) : null,
      benefit_summary: body.benefit_summary || null,
      dividend_yield: body.dividend_yield ? Number(body.dividend_yield) : null,
      benefit_yield: body.benefit_yield ? Number(body.benefit_yield) : null,
      is_published: body.is_published != null ? (body.is_published ? 1 : 0) : 1,
    };
    updateYutaiItem(numId, item);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    const details = { domain: "yutai", slug: item.slug, title: item.title };
    if (before && before.is_published !== item.is_published) { details.is_published_changed = `${before.is_published} → ${item.is_published}`; }
    writeAuditLog({ userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_UPDATED, targetType: "yutai_item", targetId: String(numId), details, ipAddress, userAgent });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ error: "code または slug が重複しています" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
