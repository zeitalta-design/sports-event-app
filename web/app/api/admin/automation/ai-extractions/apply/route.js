import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { getDb } from "@/lib/db";

/**
 * POST /api/admin/automation/ai-extractions/apply
 * AI抽出結果を主テーブルに半自動反映
 * Body: { extraction_id } または { domain_id, bulk: true }
 */
export async function POST(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const body = await request.json();
    const db = getDb();

    if (body.extraction_id) {
      // 単一反映
      const result = applySingleExtraction(db, body.extraction_id);
      return NextResponse.json(result);
    }

    if (body.domain_id && body.bulk) {
      // 一括反映（P1のみ）
      const result = applyBulk(db, body.domain_id);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "extraction_id または domain_id + bulk が必要" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function applySingleExtraction(db, extractionId) {
  const ext = db.prepare("SELECT * FROM ai_extractions WHERE id = ?").get(extractionId);
  if (!ext) return { error: "not found", applied: 0 };
  if (ext.applied_at) return { error: "already applied", applied: 0 };

  const tableMap = { "food-recall": "food_recall_items", "shitei": "shitei_items", "sanpai": "sanpai_items", "kyoninka": "kyoninka_entities" };
  const table = tableMap[ext.domain_id];
  if (!table || !ext.entity_id) return { error: "invalid domain/entity", applied: 0 };

  const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(ext.entity_id);
  if (!existing) return { error: "entity not found", applied: 0 };

  const data = JSON.parse(ext.extracted_json || "{}");
  let updated = 0;
  for (const [key, value] of Object.entries(data)) {
    if (!value || key.startsWith("_")) continue;
    if (existing[key] === undefined) continue;
    if (!existing[key] || String(existing[key]).trim() === "") {
      try { db.prepare(`UPDATE ${table} SET ${key} = ? WHERE id = ?`).run(String(value).trim(), ext.entity_id); updated++; } catch {}
    }
  }

  db.prepare("UPDATE ai_extractions SET applied_at = datetime('now') WHERE id = ?").run(extractionId);
  return { applied: 1, fieldsUpdated: updated };
}

function applyBulk(db, domainId) {
  const extractions = db.prepare("SELECT * FROM ai_extractions WHERE domain_id = ? AND applied_at IS NULL AND confidence_score >= 0.5").all(domainId);
  const tableMap = { "food-recall": "food_recall_items", "shitei": "shitei_items", "sanpai": "sanpai_items", "kyoninka": "kyoninka_entities" };
  const table = tableMap[domainId];
  if (!table) return { error: "invalid domain", applied: 0 };

  let applied = 0, fieldsTotal = 0;
  for (const ext of extractions) {
    if (!ext.entity_id) continue;
    const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(ext.entity_id);
    if (!existing) continue;
    const data = JSON.parse(ext.extracted_json || "{}");
    let updated = 0;
    for (const [key, value] of Object.entries(data)) {
      if (!value || key.startsWith("_")) continue;
      if (existing[key] === undefined) continue;
      if (!existing[key] || String(existing[key]).trim() === "") {
        try { db.prepare(`UPDATE ${table} SET ${key} = ? WHERE id = ?`).run(String(value).trim(), ext.entity_id); updated++; } catch {}
      }
    }
    if (updated > 0) {
      db.prepare("UPDATE ai_extractions SET applied_at = datetime('now') WHERE id = ?").run(ext.id);
      applied++;
      fieldsTotal += updated;
    }
  }
  return { applied, fieldsUpdated: fieldsTotal, total: extractions.length };
}
