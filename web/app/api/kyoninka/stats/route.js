import { NextResponse } from "next/server";
import { getKyoninkaStats } from "@/lib/repositories/kyoninka";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const stats = getKyoninkaStats({
      keyword: searchParams.get("keyword") || "",
      prefecture: searchParams.get("prefecture") || "",
      license_family: searchParams.get("license_family") || "",
      entity_status: searchParams.get("entity_status") || "",
      has_corporate_number: searchParams.get("has_corporate_number") || "",
      has_disciplinary: searchParams.get("has_disciplinary") || "",
    });
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
