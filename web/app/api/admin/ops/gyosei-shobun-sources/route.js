import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ops/gyosei-shobun-sources
 * カテゴリ別のデータソース一覧を返す
 * ?category=sanpai でフィルタ
 */
export async function GET(request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "";

    if (!category) {
      // カテゴリ未指定: 全ソースのサマリーを返す
      const sources = db.prepare(`
        SELECT domain_id, COUNT(*) as count,
               SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
               MAX(last_checked_at) as last_checked
        FROM data_sources
        GROUP BY domain_id
        ORDER BY domain_id
      `).all();
      return NextResponse.json({ sources });
    }

    // カテゴリ指定: そのドメインのソース一覧
    const sources = db.prepare(`
      SELECT * FROM data_sources
      WHERE domain_id = ?
      ORDER BY source_name
    `).all(category);

    return NextResponse.json({ sources, category });
  } catch (error) {
    console.error("GET /api/admin/ops/gyosei-shobun-sources error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/ops/gyosei-shobun-sources
 * 新規データソースを登録
 */
export async function POST(request) {
  try {
    const db = getDb();
    const body = await request.json();
    const { domain_id, source_name, source_type, source_url, fetch_method, run_frequency, notes } = body;

    if (!domain_id || !source_name) {
      return NextResponse.json({ error: "domain_id と source_name は必須です" }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO data_sources (domain_id, source_name, source_type, source_url, fetch_method, run_frequency, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(domain_id, source_name, source_type || "web", source_url || null, fetch_method || "manual", run_frequency || "daily", notes || null);

    return NextResponse.json({ ok: true, id: Number(result.lastInsertRowid) });
  } catch (error) {
    console.error("POST /api/admin/ops/gyosei-shobun-sources error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
