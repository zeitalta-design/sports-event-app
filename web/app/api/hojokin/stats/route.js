import { NextResponse } from "next/server";
import { getHojokinStats } from "@/lib/repositories/hojokin";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const stats = getHojokinStats({
      keyword: searchParams.get("keyword") || "",
      category: searchParams.get("category") || "",
    });
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
