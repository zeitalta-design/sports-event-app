import { NextResponse } from "next/server";
import { sendPendingEmailJobs } from "@/lib/email-sender";
import { requireAdminApi } from "@/lib/admin-api-guard";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 50, 200);
    const dryRun = !!body.dryRun;

    const result = await sendPendingEmailJobs({ limit, dryRun });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
