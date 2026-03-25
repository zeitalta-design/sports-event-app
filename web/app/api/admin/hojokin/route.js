import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { listHojokinAdminItems, createHojokinItem } from "@/lib/repositories/hojokin";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";

export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { searchParams } = new URL(request.url);
    return NextResponse.json(listHojokinAdminItems({ keyword: searchParams.get("keyword") || "", page: parseInt(searchParams.get("page") || "1") }));
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const body = await request.json();
    if (!body.title) return NextResponse.json({ error: "title は必須です" }, { status: 400 });
    const item = { slug: body.slug || "", title: String(body.title).trim(), category: body.category || "other", target_type: body.target_type || "corp", max_amount: body.max_amount ? Number(body.max_amount) : null, subsidy_rate: body.subsidy_rate || null, deadline: body.deadline || null, status: body.status || "open", provider_name: body.provider_name || null, summary: body.summary || null, is_published: body.is_published != null ? (body.is_published ? 1 : 0) : 1 };
    const result = createHojokinItem(item);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({ userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_CREATED, targetType: "hojokin_item", targetId: String(result.id), details: { domain: "hojokin", slug: item.slug, title: item.title }, ipAddress, userAgent });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ error: "slug が重複しています" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
