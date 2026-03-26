import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { createPenalty, refreshSanpaiItemPenaltyStats } from "@/lib/repositories/sanpai";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";

export async function POST(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const body = await request.json();
    if (!body.sanpai_item_id) return NextResponse.json({ error: "sanpai_item_id は必須です" }, { status: 400 });
    const penalty = {
      sanpai_item_id: Number(body.sanpai_item_id),
      penalty_date: body.penalty_date || null,
      penalty_type: body.penalty_type || "other",
      authority_name: body.authority_name || null,
      summary: body.summary || null,
      disposition_period: body.disposition_period || null,
      source_url: body.source_url || null,
    };
    const result = createPenalty(penalty);
    refreshSanpaiItemPenaltyStats(penalty.sanpai_item_id);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({ userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_CREATED, targetType: "sanpai_penalty", targetId: String(result.id), details: { domain: "sanpai", sanpai_item_id: penalty.sanpai_item_id, penalty_type: penalty.penalty_type }, ipAddress, userAgent });
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
