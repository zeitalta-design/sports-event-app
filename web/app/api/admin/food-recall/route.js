import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { listFoodRecallAdminItems } from "@/lib/repositories/food-recall";

export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { searchParams } = new URL(request.url);
    return NextResponse.json(
      listFoodRecallAdminItems({
        keyword: searchParams.get("keyword") || "",
        page: parseInt(searchParams.get("page") || "1"),
      })
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
