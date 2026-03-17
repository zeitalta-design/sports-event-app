import { NextResponse } from "next/server";
import {
  getEventResults,
  getEventResultYears,
  getEventResultCategories,
  getEventResultsSummary,
} from "@/lib/results-service";

/**
 * Phase148: 公開結果API
 *
 * GET /api/results?event_id=X&year=Y&category=Z&limit=50&offset=0
 *
 * プライバシー: 個人名は一切返さない。ゼッケン番号のみ公開識別子。
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("event_id");

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 });
    }

    const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined;
    const category = searchParams.get("category") || undefined;
    const gender = searchParams.get("gender") || undefined;
    const ageGroup = searchParams.get("age_group") || undefined;
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
    const offset = Number(searchParams.get("offset")) || 0;

    const { results, total } = getEventResults(Number(eventId), {
      year, category, gender, ageGroup, limit, offset,
    });

    const years = getEventResultYears(Number(eventId));
    const categories = getEventResultCategories(Number(eventId), year);
    const summary = getEventResultsSummary(Number(eventId), year);

    return NextResponse.json({
      results,
      total,
      years,
      categories,
      summary,
    });
  } catch (err) {
    console.error("Results API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
