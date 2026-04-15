import { NextResponse } from "next/server";
import { getSanpaiStats } from "@/lib/repositories/sanpai";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const stats = getSanpaiStats({
      keyword: searchParams.get("keyword") || "",
      prefecture: searchParams.get("prefecture") || "",
      license_type: searchParams.get("license_type") || "",
      risk_level: searchParams.get("risk_level") || "",
      status: searchParams.get("status") || "",
    });
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
