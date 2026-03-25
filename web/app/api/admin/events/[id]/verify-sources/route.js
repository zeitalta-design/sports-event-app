import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getDb } from "@/lib/db";
import { getEventSourceLinks, ensureEventSourceLinks } from "@/lib/event-sources";
import { verifyEventSources, getLatestSnapshots } from "@/lib/event-source-verifier";

/**
 * GET /api/admin/events/[id]/verify-sources
 *
 * 当該大会のソースリンク・最新snapshot・矛盾サマリーを返す
 */
export async function GET(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const eventId = parseInt(id, 10);
    if (isNaN(eventId)) {
      return NextResponse.json({ success: false, error: "Invalid event ID" }, { status: 400 });
    }

    const db = getDb();
    const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
    if (!event) {
      return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 });
    }

    // source_links を確保
    ensureEventSourceLinks(event);

    const sourceLinks = getEventSourceLinks(eventId);
    const snapshots = getLatestSnapshots(eventId);

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        title: event.title,
        event_date: event.event_date,
        entry_status: event.entry_status,
        source_url: event.source_url,
        official_url: event.official_url,
        verification_status: event.verification_status,
        verification_conflict: event.verification_conflict,
        verification_conflict_level: event.verification_conflict_level,
        verification_conflict_summary: event.verification_conflict_summary,
        verification_conflict_updated_at: event.verification_conflict_updated_at,
      },
      sourceLinks,
      snapshots,
    });
  } catch (err) {
    console.error("Verify sources GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/events/[id]/verify-sources
 *
 * 当該大会の再検証を実行する
 *
 * Body:
 *   force - true なら強制再検証
 *   addSourceUrl - 新しいソースURLを追加して検証
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const eventId = parseInt(id, 10);
    if (isNaN(eventId)) {
      return NextResponse.json({ success: false, error: "Invalid event ID" }, { status: 400 });
    }

    const db = getDb();
    const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
    if (!event) {
      return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));

    // 新しいソースURL追加
    if (body.addSourceUrl) {
      const { addEventSourceLink, detectSourceTypeFromUrl } = await import("@/lib/event-sources");
      const sourceType = detectSourceTypeFromUrl(body.addSourceUrl);
      addEventSourceLink({
        eventId,
        sourceUrl: body.addSourceUrl,
        sourceType,
      });
    }

    // 検証実行
    const result = await verifyEventSources(event, { delayMs: 1000 });

    // 更新後のデータを取得
    const updatedEvent = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
    const sourceLinks = getEventSourceLinks(eventId);
    const snapshots = getLatestSnapshots(eventId);

    return NextResponse.json({
      success: true,
      verificationResult: result,
      event: {
        id: updatedEvent.id,
        title: updatedEvent.title,
        verification_status: updatedEvent.verification_status,
        verification_conflict: updatedEvent.verification_conflict,
        verification_conflict_level: updatedEvent.verification_conflict_level,
        verification_conflict_summary: updatedEvent.verification_conflict_summary,
      },
      sourceLinks,
      snapshots,
    });
  } catch (err) {
    console.error("Verify sources POST error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
