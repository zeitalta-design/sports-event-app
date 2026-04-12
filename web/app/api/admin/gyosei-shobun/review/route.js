/**
 * 行政処分DB — 審査ワークフローAPI
 *
 * PUT  /api/admin/gyosei-shobun/review  → 個別 or 一括ステータス更新
 *   body: { id, status }             → 個別
 *   body: { ids: [...], status }      → 一括
 */

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { updateReviewStatus, bulkUpdateReviewStatus } from "@/lib/repositories/gyosei-shobun-review";

export async function PUT(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;

    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }

    // 一括更新
    if (body.ids && Array.isArray(body.ids)) {
      const ids = body.ids.map(Number).filter(Boolean);
      if (ids.length === 0) {
        return NextResponse.json({ error: "ids must not be empty" }, { status: 400 });
      }
      const result = bulkUpdateReviewStatus(ids, status);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    // 個別更新
    if (body.id) {
      const result = updateReviewStatus(Number(body.id), status);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 400 });
      }
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "id or ids is required" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
