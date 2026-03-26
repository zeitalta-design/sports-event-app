import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { updatePenalty, deletePenalty, refreshSanpaiItemPenaltyStats } from "@/lib/repositories/sanpai";
import { getDb } from "@/lib/db";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";

export async function PUT(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const body = await request.json();
    const penalty = {
      penalty_date: body.penalty_date || null,
      penalty_type: body.penalty_type || "other",
      authority_name: body.authority_name || null,
      summary: body.summary || null,
      disposition_period: body.disposition_period || null,
      source_url: body.source_url || null,
    };
    updatePenalty(Number(id), penalty);
    if (body.sanpai_item_id) refreshSanpaiItemPenaltyStats(Number(body.sanpai_item_id));
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
    const penalty = db.prepare("SELECT sanpai_item_id FROM sanpai_penalties WHERE id = ?").get(numId);
    deletePenalty(numId);
    if (penalty) refreshSanpaiItemPenaltyStats(penalty.sanpai_item_id);
    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({ userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_UPDATED, targetType: "sanpai_penalty", targetId: String(numId), details: { domain: "sanpai", action: "delete" }, ipAddress, userAgent });
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
