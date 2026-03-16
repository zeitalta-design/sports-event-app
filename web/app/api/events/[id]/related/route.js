import { NextResponse } from "next/server";
import { getRelatedMarathons, getSeriesMarathons } from "@/lib/related-marathons";

/**
 * GET /api/events/[id]/related
 * 関連大会 + 系列大会の確認用API
 *
 * Query params:
 *   limit - 取得件数（デフォルト6）
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const marathonId = parseInt(id, 10);
    if (isNaN(marathonId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "6", 10);

    const relatedResult = getRelatedMarathons(marathonId, { limit });
    const seriesResult = getSeriesMarathons(marathonId, { limit });

    if (!relatedResult.base) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({
      base: {
        id: relatedResult.base.id,
        title: relatedResult.base.title,
        prefecture: relatedResult.base.prefecture,
        event_date: relatedResult.base.event_date,
        event_month: relatedResult.base.event_month,
      },
      related: relatedResult.related,
      related_count: relatedResult.related.length,
      series: seriesResult.series,
      series_count: seriesResult.series.length,
      strategy: "attribute",
    });
  } catch (err) {
    console.error("Related marathons API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
