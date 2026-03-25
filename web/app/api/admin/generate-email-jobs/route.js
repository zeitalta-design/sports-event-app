import { NextResponse } from "next/server";
import { generateEmailJobs } from "@/lib/email-service";
import { requireAdminApi } from "@/lib/admin-api-guard";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    const startTime = Date.now();
    const result = generateEmailJobs();
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      ...result,
      durationMs,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
