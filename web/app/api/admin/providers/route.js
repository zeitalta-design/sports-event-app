import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";
import { getAllProviders, createProvider } from "@/lib/items-service";

export async function GET() {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    return NextResponse.json({ providers: getAllProviders() });
  } catch (error) {
    console.error("GET /api/admin/providers error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const body = await request.json();
    if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (!body.slug) body.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const id = createProvider(body);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({ userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_CREATED, targetType: "saas_provider", targetId: String(id), details: { domain: "saas", slug: body.slug, title: body.name }, ipAddress, userAgent });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/providers error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
