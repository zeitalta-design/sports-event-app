import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api-guard";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    const db = getDb();
    const result = db
      .prepare(
        "UPDATE email_jobs SET status = 'pending', error_message = NULL WHERE status = 'failed'"
      )
      .run();

    return NextResponse.json({
      success: true,
      reset: result.changes,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
