import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { listYutaiAdminItems, createYutaiItem } from "@/lib/repositories/yutai";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";

export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { searchParams } = new URL(request.url);
    return NextResponse.json(listYutaiAdminItems({ keyword: searchParams.get("keyword") || "", page: parseInt(searchParams.get("page") || "1") }));
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const body = await request.json();
    if (!body.title) return NextResponse.json({ error: "title は必須です" }, { status: 400 });
    if (!body.code) return NextResponse.json({ error: "code は必須です" }, { status: 400 });
    const item = {
      code: String(body.code).trim(), slug: body.slug || `${body.code}-item`,
      title: String(body.title).trim(), category: body.category || "other",
      confirm_months: body.confirm_months || "[]",
      min_investment: body.min_investment ? Number(body.min_investment) : null,
      benefit_summary: body.benefit_summary || null,
      dividend_yield: body.dividend_yield ? Number(body.dividend_yield) : null,
      benefit_yield: body.benefit_yield ? Number(body.benefit_yield) : null,
      is_published: body.is_published != null ? (body.is_published ? 1 : 0) : 1,
    };
    const result = createYutaiItem(item);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({ userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_CREATED, targetType: "yutai_item", targetId: String(result.id), details: { domain: "yutai", slug: item.slug, title: item.title }, ipAddress, userAgent });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ error: "code または slug が重複しています" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
