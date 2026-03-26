import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { updateRegistration, deleteRegistration, refreshEntityRegistrationStats } from "@/lib/repositories/kyoninka";
import { getDb } from "@/lib/db";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";

export async function PUT(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const body = await request.json();
    const reg = {
      license_family: body.license_family || "other",
      license_type: body.license_type || null,
      registration_number: body.registration_number || null,
      authority_name: body.authority_name || null,
      prefecture: body.prefecture || null,
      valid_from: body.valid_from || null,
      valid_to: body.valid_to || null,
      registration_status: body.registration_status || "active",
      disciplinary_flag: body.disciplinary_flag ? 1 : 0,
      source_name: body.source_name || null,
      source_url: body.source_url || null,
      detail_url: body.detail_url || null,
    };
    updateRegistration(Number(id), reg);
    if (body.entity_id) refreshEntityRegistrationStats(Number(body.entity_id));
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function DELETE(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const numId = Number(id);
    const db = getDb();
    const reg = db.prepare("SELECT entity_id FROM kyoninka_registrations WHERE id = ?").get(numId);
    deleteRegistration(numId);
    if (reg) refreshEntityRegistrationStats(reg.entity_id);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({ userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_UPDATED, targetType: "kyoninka_registration", targetId: String(numId), details: { domain: "kyoninka", action: "delete" }, ipAddress, userAgent });
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
