import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getDataReadinessReport } from "@/lib/data-readiness";

/**
 * Phase230: データ充実度チェックAPI
 *
 * GET /api/admin/data-readiness
 */
export async function GET() {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;
  const report = getDataReadinessReport();
  return NextResponse.json(report);
}
