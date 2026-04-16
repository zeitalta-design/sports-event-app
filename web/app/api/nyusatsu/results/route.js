import { NextResponse } from "next/server";
import { listNyusatsuResults } from "@/lib/repositories/nyusatsu";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = listNyusatsuResults({
      keyword: searchParams.get("keyword") || "",
      category: searchParams.get("category") || "",
      area: searchParams.get("area") || "",
      winner: searchParams.get("winner") || "",
      issuer: searchParams.get("issuer") || "",
      year: searchParams.get("year") || "",
      award_date_from: searchParams.get("award_date_from") || "",
      award_date_to: searchParams.get("award_date_to") || "",
      sort: searchParams.get("sort") || "newest",
      page: parseInt(searchParams.get("page") || "1"),
      pageSize: parseInt(searchParams.get("pageSize") || "20"),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/nyusatsu/results error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
