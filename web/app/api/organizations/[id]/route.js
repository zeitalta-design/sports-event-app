/**
 * GET /api/organizations/[id]
 *
 * organizations テーブル 1 行の薄い lookup API。
 * 企業詳細ページ（/organizations/[id]）がヘッダ描画用に使う。
 *
 * 集計は /api/companies/[key] に任せるので、ここは raw row + source_domain
 * （どのドメインで観測された企業か）のメタだけ返す。
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const orgId = parseInt(id, 10);
    if (!Number.isFinite(orgId) || orgId <= 0) {
      return NextResponse.json({ error: "invalid id" }, { status: 400 });
    }
    const db = getDb();

    const org = db.prepare(`
      SELECT id, normalized_name, display_name, corporate_number,
             entity_type, prefecture, city, address,
             merged_into_id, is_active, source,
             created_at, updated_at
      FROM organizations
      WHERE id = ?
    `).get(orgId);

    if (!org) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    // 表記ゆれ（どのドメインで観測されたか）
    const variants = db.prepare(`
      SELECT raw_name, source_domain, source_entity_type, match_method, confidence
      FROM organization_name_variants
      WHERE organization_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `).all(orgId);

    // entity_links（resolved_entities への橋渡し件数）
    const links = db.prepare(`
      SELECT l.resolved_entity_id, l.link_type, l.confidence, l.source,
             r.canonical_name AS resolved_canonical_name
      FROM entity_links l
      LEFT JOIN resolved_entities r ON r.id = l.resolved_entity_id
      WHERE l.organization_id = ?
    `).all(orgId);

    return NextResponse.json({ organization: org, variants, links });
  } catch (e) {
    console.error("GET /api/organizations/[id] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
