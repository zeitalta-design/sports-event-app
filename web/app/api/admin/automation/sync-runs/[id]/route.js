import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getSyncRunById } from "@/lib/core/automation/sync-logger";
import { listChangeLogs } from "@/lib/core/automation/change-detector";

export async function GET(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const run = getSyncRunById(Number(id));
    if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
    const changes = listChangeLogs({ syncRunId: Number(id), limit: 200 });
    return NextResponse.json({ run, changes: changes.items });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
