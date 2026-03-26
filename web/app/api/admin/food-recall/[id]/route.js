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
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function PUT(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const numId = Number(id);
    const before = getFoodRecallAdminById(numId);
    const body = await request.json();
    if (!body.product_name) return NextResponse.json({ error: "product_name は必須です" }, { status: 400 });
    const item = {
      slug: body.slug || "",
      product_name: String(body.product_name).trim(),
      manufacturer: body.manufacturer || null,
      category: body.category || "other",
      recall_type: body.recall_type || "voluntary",
      reason: body.reason || "other",
      risk_level: body.risk_level || "unknown",
      affected_area: body.affected_area || null,
      lot_number: body.lot_number || null,
      recall_date: body.recall_date || null,
      status: body.status || "active",
      consumer_action: body.consumer_action || null,
      source_url: body.source_url || null,
      manufacturer_url: body.manufacturer_url || null,
      summary: body.summary || null,
      is_published: body.is_published != null ? (body.is_published ? 1 : 0) : 1,
    };
    updateFoodRecallItem(numId, item);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    const details = { domain: "food-recall", slug: item.slug, product_name: item.product_name };
    if (before && before.is_published !== item.is_published) details.is_published_changed = `${before.is_published} → ${item.is_published}`;
    writeAuditLog({ userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_UPDATED, targetType: "food_recall_item", targetId: String(numId), details, ipAddress, userAgent });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ error: "slug が重複しています" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
