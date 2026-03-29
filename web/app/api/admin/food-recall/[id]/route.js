import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getFoodRecallAdminById, updateFoodRecallItem } from "@/lib/repositories/food-recall";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";

export async function GET(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const item = getFoodRecallAdminById(Number(id));
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
    if (!body.product_name) return NextResponse.json({ error: "product_name は必須です" }, { status: 400 });
    const item = {
      slug: body.slug || "", product_name: String(body.product_name).trim(),
      manufacturer: body.manufacturer || null, category: body.category || null,
      recall_type: body.recall_type || null, reason: body.reason || null,
      risk_level: body.risk_level || "low", status: body.status || "ongoing",
      recall_date: body.recall_date || null, affected_area: body.affected_area || null,
      consumer_action: body.consumer_action || null, summary: body.summary || null,
      source_url: body.source_url || null,
      is_published: body.is_published != null ? (body.is_published ? 1 : 0) : 1,
    };
    updateFoodRecallItem(numId, item);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({
      userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_UPDATED,
      targetType: "food_recall_item", targetId: String(numId),
      details: { domain: "food-recall", slug: item.slug, product_name: item.product_name },
      ipAddress, userAgent,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ error: "slug が重複しています" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
