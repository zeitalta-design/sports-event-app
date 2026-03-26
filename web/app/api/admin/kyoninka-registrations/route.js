import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { createRegistration, refreshEntityRegistrationStats } from "@/lib/repositories/kyoninka";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";

export async function POST(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const body = await request.json();
    if (!body.entity_id) return NextResponse.json({ error: "entity_id は必須です" }, { status: 400 });
    const reg = {
      entity_id: Number(body.entity_id),
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
    const result = createRegistration(reg);
    refreshEntityRegistrationStats(reg.entity_id);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({ userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_CREATED, targetType: "kyoninka_registration", targetId: String(result.id), details: { domain: "kyoninka", entity_id: reg.entity_id, license_family: reg.license_family }, ipAddress, userAgent });
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
