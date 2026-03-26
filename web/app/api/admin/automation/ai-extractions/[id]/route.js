import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getAiExtractionById } from "@/lib/core/automation/ai-drafter";

export async function GET(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const extraction = getAiExtractionById(Number(id));
    if (!extraction) return NextResponse.json({ error: "not found" }, { status: 404 });
    // JSON文字列をパースして返す
    try { extraction.extracted_json = JSON.parse(extraction.extracted_json); } catch {}
    try { extraction.missing_fields = JSON.parse(extraction.missing_fields); } catch {}
    try { extraction.review_reasons = JSON.parse(extraction.review_reasons); } catch {}
    return NextResponse.json({ extraction });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
