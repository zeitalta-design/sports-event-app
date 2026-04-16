import { NextResponse } from "next/server";
import { getNyusatsuResultStats } from "@/lib/repositories/nyusatsu";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const stats = getNyusatsuResultStats({
      keyword: searchParams.get("keyword") || "",
      category: searchParams.get("category") || "",
      area: searchParams.get("area") || "",
      winner: searchParams.get("winner") || "",
      issuer: searchParams.get("issuer") || "",
      year: searchParams.get("year") || "",
    });
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
