import { NextResponse } from "next/server";
import {
  getPlacementEffectSummary,
  getPlacementAverageStats,
  setEventPlacement,
  endEventPlacement,
  getActiveEventPlacements,
  VALID_PLACEMENTS,
} from "@/lib/placement-analytics";

/**
 * GET /api/admin/placement-analytics
 *
 * 掲載効果サマリーを取得。
 * Query: days=14, limit=50, placement=featured
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "14", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const placement = searchParams.get("placement") || undefined;

    const summary = getPlacementEffectSummary({ days, limit, placement });
    const averages = getPlacementAverageStats({ days });

    return NextResponse.json({
      ok: true,
      days,
      summary,
      averages,
      placements: VALID_PLACEMENTS,
    });
  } catch (err) {
    console.error("GET /api/admin/placement-analytics error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/placement-analytics
 *
 * 掲載区分の設定・解除。
 * Body: { action: "set"|"end", eventId, placement }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, eventId, placement } = body;

    if (!eventId || !placement) {
      return NextResponse.json({ ok: false, error: "eventId and placement required" }, { status: 400 });
    }

    if (!VALID_PLACEMENTS.includes(placement)) {
      return NextResponse.json({ ok: false, error: `Invalid placement: ${placement}` }, { status: 400 });
    }

    let result;
    if (action === "end") {
      result = endEventPlacement(eventId, placement);
    } else {
      result = setEventPlacement(eventId, placement);
    }

    // 変更後のアクティブな掲載区分を返す
    const activePlacements = getActiveEventPlacements(eventId);

    return NextResponse.json({ ...result, activePlacements });
  } catch (err) {
    console.error("POST /api/admin/placement-analytics error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
