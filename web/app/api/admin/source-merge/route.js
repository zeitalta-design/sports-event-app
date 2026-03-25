import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getDb } from "@/lib/db";
import { findMoshicomMatch } from "@/lib/moshicom-search";
import { mergeSourceData, detectDifferences } from "@/lib/source-merge-service";
import { fetchAndParseMoshicom } from "@/lib/moshicom-fetcher";

/**
 * GET /api/admin/source-merge?eventId=X
 *
 * 指定イベントに対しMOSHICOMを自動検索し、マッチ候補を返す。
 *
 * GET /api/admin/source-merge?q=keyword&status=unmerged
 *
 * イベント一覧を返す（統合ステータスフィルタ付き）。
 */
export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const q = searchParams.get("q") || "";
    const status = searchParams.get("status") || "all";
    const limit = Math.min(parseInt(searchParams.get("limit")) || 50, 200);
    const offset = parseInt(searchParams.get("offset")) || 0;

    const db = getDb();

    // --- 単一イベントのMOSHICOM検索 ---
    if (eventId) {
      const event = db.prepare(`
        SELECT e.*, md.source_priority, md.moshicom_url
        FROM events e
        LEFT JOIN marathon_details md ON md.marathon_id = e.id
        WHERE e.id = ?
      `).get(parseInt(eventId));

      if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }

      // 既にMOSHICOM統合済みか
      if (event.moshicom_url) {
        return NextResponse.json({
          event: { id: event.id, title: event.title, event_date: event.event_date },
          alreadyMerged: true,
          moshicomUrl: event.moshicom_url,
          sourcePriority: event.source_priority,
        });
      }

      // MOSHICOM検索
      const matchResult = await findMoshicomMatch({
        title: event.title,
        event_date: event.event_date,
        prefecture: event.prefecture,
      });

      return NextResponse.json({
        event: {
          id: event.id,
          title: event.title,
          event_date: event.event_date,
          prefecture: event.prefecture,
        },
        alreadyMerged: false,
        matchResult,
      });
    }

    // --- イベント一覧 ---
    let where = "WHERE e.is_active = 1";
    const params = [];

    if (q) {
      where += " AND e.title LIKE ?";
      params.push(`%${q}%`);
    }

    if (status === "unmerged") {
      where += " AND (md.source_priority IS NULL OR md.source_priority = 'runnet')";
    } else if (status === "merged") {
      where += " AND md.source_priority = 'moshicom'";
    }

    const total = db.prepare(`
      SELECT COUNT(*) as cnt
      FROM events e
      LEFT JOIN marathon_details md ON md.marathon_id = e.id
      ${where}
    `).get(...params).cnt;

    const events = db.prepare(`
      SELECT e.id, e.title, e.event_date, e.prefecture, e.source_site,
             e.source_url, e.official_url,
             md.source_priority, md.moshicom_url, md.source_updated_at
      FROM events e
      LEFT JOIN marathon_details md ON md.marathon_id = e.id
      ${where}
      ORDER BY e.event_date DESC NULLS LAST
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return NextResponse.json({ events, total, limit, offset });
  } catch (error) {
    console.error("Source merge GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/source-merge
 *
 * Body:
 *   eventId: number    — 対象events.id
 *   moshicomUrl: string — MOSHICOM URL
 *   dryRun: boolean     — trueならプレビューのみ
 */
export async function POST(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const body = await request.json();
    const { eventId, moshicomUrl, dryRun = false } = body;

    if (!eventId || !moshicomUrl) {
      return NextResponse.json(
        { error: "eventId と moshicomUrl は必須です" },
        { status: 400 }
      );
    }

    if (!moshicomUrl.includes("moshicom.com/")) {
      return NextResponse.json(
        { error: "有効なMOSHICOM URLを入力してください" },
        { status: 400 }
      );
    }

    const result = await mergeSourceData(parseInt(eventId), moshicomUrl, {
      useLlm: true,
      dryRun,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Source merge POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
