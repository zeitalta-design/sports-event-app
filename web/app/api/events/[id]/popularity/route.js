import { NextResponse } from "next/server";
import { getEventPopularity } from "@/lib/event-popularity";

/**
 * GET /api/events/[id]/popularity
 *
 * 単一大会の人気指数を返す。
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const eventId = parseInt(id, 10);
    if (isNaN(eventId) || eventId <= 0) {
      return NextResponse.json(
        { error: "Invalid event ID" },
        { status: 400 }
      );
    }

    const popularity = getEventPopularity(eventId);

    return NextResponse.json(popularity);
  } catch (err) {
    console.error("GET /api/events/[id]/popularity error:", err);
    return NextResponse.json({
      event_id: 0,
      popularity_score: 0,
      popularity_label: null,
      raw_score: 0,
      detail_views_30d: 0,
      favorites_30d: 0,
      entry_clicks_30d: 0,
      period_days: 30,
    });
  }
}
