import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getGyoseiShobunAdminById } from "@/lib/repositories/gyosei-shobun";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";
import { getDb } from "@/lib/db";

export async function GET(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const item = getGyoseiShobunAdminById(Number(id));
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
    if (!body.organization_name_raw) return NextResponse.json({ error: "organization_name_raw は必須です" }, { status: 400 });
    const db = getDb();
    db.prepare(`
      UPDATE administrative_actions SET
        slug=@slug, organization_name_raw=@organization_name_raw, action_type=@action_type,
        action_date=@action_date, authority_name=@authority_name, authority_level=@authority_level,
        prefecture=@prefecture, industry=@industry, legal_basis=@legal_basis,
        penalty_period=@penalty_period, summary=@summary, detail=@detail,
        source_url=@source_url, source_name=@source_name,
        is_published=@is_published, updated_at=datetime('now')
      WHERE id=@id
    `).run({
      id: numId, slug: body.slug || "",
      organization_name_raw: String(body.organization_name_raw).trim(),
      action_type: body.action_type || "other", action_date: body.action_date || null,
      authority_name: body.authority_name || null, authority_level: body.authority_level || "national",
      prefecture: body.prefecture || null, industry: body.industry || null,
      legal_basis: body.legal_basis || null, penalty_period: body.penalty_period || null,
      summary: body.summary || null, detail: body.detail || null,
      source_url: body.source_url || null, source_name: body.source_name || null,
      is_published: body.is_published != null ? (body.is_published ? 1 : 0) : 1,
    });
    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({
      userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_UPDATED,
      targetType: "administrative_action", targetId: String(numId),
      details: { domain: "gyosei-shobun", slug: body.slug, organization_name_raw: body.organization_name_raw },
      ipAddress, userAgent,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ error: "slug が重複しています" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
