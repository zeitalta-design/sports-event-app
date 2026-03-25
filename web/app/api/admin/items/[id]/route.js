import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";
import {
  getItemById, updateItem, upsertSaasDetails, replaceVariants, replaceTags,
} from "@/lib/items-service";

export async function GET(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const db = getDb();

    const item = db.prepare(`
      SELECT i.*, p.name as provider_name
      FROM items i LEFT JOIN providers p ON p.id = i.provider_id
      WHERE i.id = ?
    `).get(id);
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

    const saas = db.prepare("SELECT * FROM saas_details WHERE item_id = ?").get(id);
    const variants = db.prepare("SELECT * FROM item_variants WHERE item_id = ? ORDER BY sort_order").all(id);
    const tags = db.prepare("SELECT * FROM item_tags WHERE item_id = ?").all(id);

    return NextResponse.json({ item, saas, variants, tags });
  } catch (error) {
    console.error("GET /api/admin/items/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const numId = Number(id);
    const db = getDb();
    const before = db.prepare("SELECT is_published, slug, title FROM items WHERE id = ?").get(numId);
    const body = await request.json();
    const { item: itemData, saas, variants, tags } = body;

    if (!itemData?.title) return NextResponse.json({ error: "title is required" }, { status: 400 });

    updateItem(id, itemData);
    if (saas) upsertSaasDetails(id, saas);
    if (variants) replaceVariants(id, variants);
    if (tags) replaceTags(id, tags);

    const { ipAddress, userAgent } = extractRequestInfo(request);
    const details = { domain: "saas", slug: itemData.slug, title: itemData.title };
    if (before && itemData.is_published != null && before.is_published !== (itemData.is_published ? 1 : 0)) {
      details.is_published_changed = `${before.is_published} → ${itemData.is_published ? 1 : 0}`;
    }
    writeAuditLog({ userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_UPDATED, targetType: "saas_item", targetId: String(numId), details, ipAddress, userAgent });

    return NextResponse.json({ updated: true });
  } catch (error) {
    console.error("PUT /api/admin/items/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const db = getDb();

    db.prepare("DELETE FROM saas_details WHERE item_id = ?").run(id);
    db.prepare("DELETE FROM item_variants WHERE item_id = ?").run(id);
    db.prepare("DELETE FROM item_tags WHERE item_id = ?").run(id);
    db.prepare("DELETE FROM item_favorites WHERE item_id = ?").run(id);
    db.prepare("DELETE FROM item_reviews WHERE item_id = ?").run(id);
    db.prepare("DELETE FROM items WHERE id = ?").run(id);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/admin/items/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
