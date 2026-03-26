import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { runSyncWithTracking } from "@/lib/core/automation/sync-runner";
import { foodRecallAdapter } from "@/lib/core/automation/adapters/food-recall-adapter";
import { shiteiAdapter } from "@/lib/core/automation/adapters/shitei-adapter";
import { sanpaiAdapter } from "@/lib/core/automation/adapters/sanpai-adapter";
import { kyoninkaAdapter } from "@/lib/core/automation/adapters/kyoninka-adapter";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";

const ADAPTERS = {
  "food-recall": foodRecallAdapter,
  "sanpai": sanpaiAdapter,
  "kyoninka": kyoninkaAdapter,
  "shitei": shiteiAdapter,
};

/**
 * POST /api/admin/automation/sync-execute
 * 手動同期実行
 * Body: { domain_id, source_id?, items: [...], dry_run? }
 */
export async function POST(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;

    const body = await request.json();
    const { domain_id, source_id, items, dry_run } = body;

    if (!domain_id) return NextResponse.json({ error: "domain_id は必須です" }, { status: 400 });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items は空でない配列である必要があります" }, { status: 400 });
    }

    const adapter = ADAPTERS[domain_id];
    if (!adapter) {
      return NextResponse.json({ error: `未対応のドメイン: ${domain_id}` }, { status: 400 });
    }

    const report = runSyncWithTracking({
      adapter,
      rawItems: items,
      sourceId: source_id ? Number(source_id) : null,
      runType: "manual",
      dryRun: dry_run || false,
      verbose: false,
    });

    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({
      userId: guard.user.id,
      action: AUDIT_ACTIONS.ADMIN_ITEM_CREATED,
      targetType: "sync_run",
      targetId: String(report.runId || "dry-run"),
      details: {
        domain: domain_id,
        total: report.total,
        created: report.created,
        updated: report.updated,
        review: report.review,
        failed: report.failed,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json(report, { status: 200 });
  } catch (error) {
    console.error("POST /api/admin/automation/sync-execute error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
