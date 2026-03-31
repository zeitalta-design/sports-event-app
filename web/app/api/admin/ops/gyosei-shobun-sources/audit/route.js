/**
 * POST /api/admin/ops/gyosei-shobun-sources/audit
 * 情報源台帳の全有効ソースに対して到達性監査を実行
 */

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { SOURCE_REGISTRY } from "@/lib/gyosei-shobun-source-registry";
import { auditAllSources } from "@/lib/gyosei-shobun-source-audit";

export async function POST() {
  try {
    const guard = await requireAdminApi();
    if (guard) return guard;

    const results = await auditAllSources(SOURCE_REGISTRY);
    return NextResponse.json({ results, checkedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
