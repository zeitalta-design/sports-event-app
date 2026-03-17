import { NextResponse } from "next/server";
import { getDataReadinessReport } from "@/lib/data-readiness";

/**
 * Phase230: データ充実度チェックAPI
 *
 * GET /api/admin/data-readiness
 */
export async function GET() {
  const report = getDataReadinessReport();
  return NextResponse.json(report);
}
