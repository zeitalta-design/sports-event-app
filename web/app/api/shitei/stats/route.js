import { NextResponse } from "next/server";
import { getShiteiStats } from "@/lib/repositories/shitei";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const stats = getShiteiStats({
      keyword: searchParams.get("keyword") || "",
      prefecture: searchParams.get("prefecture") || "",
      facility_category: searchParams.get("facility_category") || "",
      recruitment_status: searchParams.get("recruitment_status") || "",
      municipality: searchParams.get("municipality") || "",
    });
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
