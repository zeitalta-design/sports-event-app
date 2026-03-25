import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { listMinpakuAdminItems, createMinpakuItem } from "@/lib/repositories/minpaku";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";

export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { searchParams } = new URL(request.url);
    return NextResponse.json(listMinpakuAdminItems({ keyword: searchParams.get("keyword") || "", page: parseInt(searchParams.get("page") || "1") }));
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const body = await request.json();
    if (!body.title) return NextResponse.json({ error: "title は必須です" }, { status: 400 });
    const item = { slug: body.slug || "", title: String(body.title).trim(), category: body.category || "other", area: body.area || null, property_type: body.property_type || "entire", capacity: body.capacity ? Number(body.capacity) : null, price_per_night: body.price_per_night ? Number(body.price_per_night) : null, min_nights: body.min_nights ? Number(body.min_nights) : 1, host_name: body.host_name || null, rating: body.rating ? Number(body.rating) : null, review_count: body.review_count ? Number(body.review_count) : 0, summary: body.summary || null, status: body.status || "active", is_published: body.is_published != null ? (body.is_published ? 1 : 0) : 1 };
    const result = createMinpakuItem(item);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({ userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_CREATED, targetType: "minpaku_item", targetId: String(result.id), details: { domain: "minpaku", slug: item.slug, title: item.title }, ipAddress, userAgent });
    return NextResponse.json(result, { status: 201 });
  } catch (error) { if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ error: "slug が重複しています" }, { status: 409 }); return NextResponse.json({ error: error.message }, { status: 500 }); }
}
