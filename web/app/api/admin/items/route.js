import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";
import {
  adminSearchItems, createItem, upsertSaasDetails, replaceVariants, replaceTags,
} from "@/lib/items-service";

export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { searchParams } = new URL(request.url);
    const result = adminSearchItems({
      keyword: searchParams.get("keyword") || undefined,
      category: searchParams.get("category") || undefined,
      isPublished: searchParams.get("is_published") ?? undefined,
      page: parseInt(searchParams.get("page") || "1"),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/admin/items error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const body = await request.json();
    const { item: itemData, saas, variants, tags } = body;

    if (!itemData?.title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    if (!itemData.slug) {
      itemData.slug = itemData.title
        .toLowerCase()
        .replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g, "-")
        .replace(/^-|-$/g, "");
    }

    const itemId = createItem(itemData);

    if (saas) upsertSaasDetails(itemId, saas);
    if (variants && variants.length > 0) replaceVariants(itemId, variants);
    if (tags && tags.length > 0) replaceTags(itemId, tags);

    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({ userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_CREATED, targetType: "saas_item", targetId: String(itemId), details: { domain: "saas", slug: itemData.slug, title: itemData.title }, ipAddress, userAgent });

    return NextResponse.json({ id: itemId }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/items error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
