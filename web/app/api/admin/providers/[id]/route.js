import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";
import { getProviderById, updateProvider, deleteProvider } from "@/lib/items-service";

export async function GET(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const provider = getProviderById(id);
    if (!provider) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ provider });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function PUT(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const body = await request.json();
    if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    updateProvider(id, body);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({ userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_UPDATED, targetType: "saas_provider", targetId: String(id), details: { domain: "saas", title: body.name, slug: body.slug }, ipAddress, userAgent });
    return NextResponse.json({ updated: true });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function DELETE(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    deleteProvider(id);
    return NextResponse.json({ deleted: true });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
