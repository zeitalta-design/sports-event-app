import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/sync?domain=sanpai
 * 手動データ同期（管理画面の「更新」ボタンから呼び出し）
 *
 * 現時点では各カテゴリのdata_sourcesから最終確認日時を更新し、
 * 件数サマリーを返す。将来的にスクレイピング連携を追加。
 */
export async function POST(request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain");

    if (!domain) {
      return NextResponse.json({ error: "domain パラメータが必要です" }, { status: 400 });
    }

    // テーブル名マッピング
    const TABLE_MAP = {
      sanpai: "sanpai_items",
      nyusatsu: "nyusatsu_items",
      shitei: "shitei_items",
      hojokin: "hojokin_items",
      kyoninka: "kyoninka_entities",
    };

    const tableName = TABLE_MAP[domain];
    if (!tableName) {
      return NextResponse.json({ error: `不明なドメイン: ${domain}` }, { status: 400 });
    }

    // 現在のデータ件数を取得
    const total = db.prepare(`SELECT COUNT(*) as c FROM ${tableName}`).get();
    const published = db.prepare(`SELECT COUNT(*) as c FROM ${tableName} WHERE is_published = 1`).get();

    // data_sources の最終確認日時を更新
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    db.prepare(`
      UPDATE data_sources SET last_checked_at = ? WHERE domain_id = ?
    `).run(now, domain);

    return NextResponse.json({
      ok: true,
      domain,
      message: `${domain}データ確認完了`,
      totalFetched: total.c,
      published: published.c,
      created: 0,
      updated: 0,
      checkedAt: now,
    });
  } catch (error) {
    console.error("POST /api/admin/sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
