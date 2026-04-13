import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { listShiteiAdminItems } from "@/lib/repositories/shitei";
import { getReviewStatusCounts } from "@/lib/repositories/generic-review";

export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { searchParams } = new URL(request.url);
    if (searchParams.get("counts") === "1") {
      return NextResponse.json({ statusCounts: getReviewStatusCounts("shitei_items") });
    }
    return NextResponse.json(
      listShiteiAdminItems({
        keyword: searchParams.get("keyword") || "",
        page: parseInt(searchParams.get("page") || "1"),
      })
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
