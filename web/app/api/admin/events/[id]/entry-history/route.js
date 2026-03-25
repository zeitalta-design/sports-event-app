import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getEntryHistoryRecords, getEntryHistorySummary } from "@/lib/entry-history";
import { getEntryUrgencyMeta } from "@/lib/entry-urgency";
import { getDb } from "@/lib/db";

/**
 * GET /api/admin/events/[id]/entry-history
 *
 * 大会の受付状態履歴・緊急度判定情報を返す（監査・確認用）
 */
export async function GET(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const eventId = parseInt(id, 10);
    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: "無効なIDです" },
        { status: 400 }
      );
    }

    const db = getDb();
    const event = db
      .prepare("SELECT * FROM events WHERE id = ?")
      .get(eventId);

    if (!event) {
      return NextResponse.json(
        { success: false, error: "大会が見つかりません" },
        { status: 404 }
      );
    }

    // 生の履歴レコード
    const records = getEntryHistoryRecords(eventId);

    // サマリー
    const summary = getEntryHistorySummary(eventId);

    // 緊急度判定
    const urgencyMeta = getEntryUrgencyMeta(event, summary);

    return NextResponse.json({
      success: true,
      eventId,
      eventTitle: event.title,
      currentStatus: event.entry_status,
      cachedUrgencyLabel: event.urgency_label || null,
      cachedUrgencyLevel: event.urgency_level || null,
      cachedSignals: event.entry_signals_json
        ? JSON.parse(event.entry_signals_json)
        : [],
      urgency: {
        label: urgencyMeta.urgencyLabel,
        level: urgencyMeta.urgencyLevel,
        reasonText: urgencyMeta.reasonText,
        confidence: urgencyMeta.confidence,
        signals: urgencyMeta.signals,
        historicalDaysToClose: urgencyMeta.historicalDaysToClose,
        daysBeforeEventClosed: urgencyMeta.daysBeforeEventClosed,
      },
      summary: {
        hasHistory: summary.hasHistory,
        totalRecords: summary.totalRecords,
        firstObserved: summary.firstObserved,
        lastObserved: summary.lastObserved,
        daysOpenToClose: summary.daysOpenToClose,
        daysBeforeEventClosed: summary.daysBeforeEventClosed,
        closeReason: summary.closeReason,
        isCapacityBased: summary.isCapacityBased,
        allSignals: summary.allSignals,
        capacityCloseCount: summary.capacityCloseCount,
      },
      records: records.map((r) => ({
        id: r.id,
        sourceType: r.source_type,
        sourceUrl: r.source_url,
        observedStatus: r.observed_status,
        entryOpenAt: r.entry_open_at,
        entryCloseAt: r.entry_close_at,
        eventDate: r.event_date,
        closeReason: r.close_reason,
        isCapacityBased: !!r.is_capacity_based,
        detectedSignals: r.detected_signals_json
          ? JSON.parse(r.detected_signals_json)
          : [],
        observedAt: r.observed_at,
        note: r.note,
      })),
    });
  } catch (err) {
    console.error("Entry history API error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
