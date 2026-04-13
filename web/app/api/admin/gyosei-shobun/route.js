import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getDb } from "@/lib/db";
import { listGyoseiShobunAdminItems } from "@/lib/repositories/gyosei-shobun";

export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { searchParams } = new URL(request.url);

    // ステータス件数のみ返すモード
    if (searchParams.get("counts") === "1") {
      const db = getDb();
      const rows = db.prepare(
        "SELECT review_status, COUNT(*) as c FROM administrative_actions GROUP BY review_status"
      ).all();
      const counts = { pending: 0, approved: 0, rejected: 0, total: 0 };
      for (const r of rows) {
        const key = r.review_status || "pending";
        if (counts[key] !== undefined) counts[key] = r.c;
        counts.total += r.c;
      }
      return NextResponse.json({ statusCounts: counts });
    }

    return NextResponse.json(
      listGyoseiShobunAdminItems({
        keyword: searchParams.get("keyword") || "",
        page: parseInt(searchParams.get("page") || "1"),
      })
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
