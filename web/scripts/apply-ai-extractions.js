#!/usr/bin/env node
/**
 * AI抽出結果の半自動反映 + review ワークフロー（改善版）
 *
 * Usage:
 *   node scripts/apply-ai-extractions.js status                        # 概要
 *   node scripts/apply-ai-extractions.js classify                      # P1-P4分類
 *   node scripts/apply-ai-extractions.js preview <domain> [--limit 10] # 反映プレビュー
 *   node scripts/apply-ai-extractions.js apply <domain> [--dry-run]    # 半自動反映
 *   node scripts/apply-ai-extractions.js reclassify-shitei             # shitei 保留再分類
 *   node scripts/apply-ai-extractions.js bulk-approve [--domain <d>]   # P1一括承認
 *
 * 反映ルール（改善版）:
 *   - P1: confidence≥0.5 + quality good/draft + missing≤3 + データあり → 反映候補
 *   - P2: confidence≥0.4 + quality any → 要確認
 *   - 反映は「空項目のみ補完」（上書きなし）
 *   - 反映後 applied_at を記録
 */

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "status";

  const { getDb } = await import("../lib/db.js");
  const db = getDb();

  switch (command) {
    case "status": showStatus(db); break;
    case "classify": classifyExtractions(db); break;
    case "preview": previewApply(db, args[1], args); break;
    case "apply": await applyExtractions(db, args[1], args.includes("--dry-run")); break;
    case "reclassify-shitei": reclassifyShitei(db); break;
    case "bulk-approve": bulkApprove(db, args); break;
    default: console.log("Usage: apply-ai-extractions.js <status|classify|preview|apply|reclassify-shitei|bulk-approve>"); break;
  }
}

// ─── P1-P4 分類ロジック（改善版） ─────────────────────

function classifyExtraction(ext) {
  const missing = JSON.parse(ext.missing_fields || "[]");
  const data = JSON.parse(ext.extracted_json || "{}");
  const hasData = Object.keys(data).filter(k => !k.startsWith("_") && data[k]).length > 0;

  if (ext.quality_level === "raw" || ext.confidence_score < 0.3 || !hasData) return "P4";
  if (ext.confidence_score >= 0.5 && missing.length <= 3 && hasData) return "P1";
  if (ext.confidence_score >= 0.4 && hasData) return "P2";
  return "P3";
}

function showStatus(db) {
  console.log("\n=== AI半自動反映ステータス ===\n");

  const total = db.prepare("SELECT COUNT(*) as c FROM ai_extractions").get().c;
  const applied = db.prepare("SELECT COUNT(*) as c FROM ai_extractions WHERE applied_at IS NOT NULL").get().c;

  console.log(`AI抽出総件数: ${total}`);
  console.log(`反映済み: ${applied}`);
  console.log(`未反映: ${total - applied}`);

  // ドメイン別
  const byDomain = db.prepare(`
    SELECT domain_id, COUNT(*) as total,
      SUM(CASE WHEN applied_at IS NOT NULL THEN 1 ELSE 0 END) as applied,
      AVG(confidence_score) as avg_conf
    FROM ai_extractions GROUP BY domain_id
  `).all();
  console.log("\nドメイン別:");
  byDomain.forEach(d => console.log(`  ${d.domain_id}: ${d.total}件 (反映${d.applied}, 未反映${d.total - d.applied}, avg conf=${d.avg_conf?.toFixed(2)})`));

  // P1-P4分類
  const pending = db.prepare("SELECT * FROM ai_extractions WHERE applied_at IS NULL").all();
  const counts = { P1: 0, P2: 0, P3: 0, P4: 0 };
  pending.forEach(ext => { counts[classifyExtraction(ext)]++; });
  console.log(`\n未反映の優先度: P1=${counts.P1} P2=${counts.P2} P3=${counts.P3} P4=${counts.P4}`);

  // shitei 公開状態
  const shiteiPublished = db.prepare("SELECT COUNT(*) as c FROM shitei_items WHERE is_published = 1").get().c;
  const shiteiHold = db.prepare("SELECT COUNT(*) as c FROM shitei_items WHERE is_published = 0").get().c;
  console.log(`\nshitei: 公開${shiteiPublished}件, 保留${shiteiHold}件`);
}

function classifyExtractions(db) {
  console.log("\n=== AI抽出結果分類（P1-P4） ===\n");

  const extractions = db.prepare("SELECT * FROM ai_extractions WHERE applied_at IS NULL ORDER BY confidence_score DESC").all();
  const groups = { P1: [], P2: [], P3: [], P4: [] };

  for (const ext of extractions) {
    groups[classifyExtraction(ext)].push(ext);
  }

  console.log(`✅ P1 反映候補: ${groups.P1.length}件`);
  groups.P1.forEach(e => {
    const data = JSON.parse(e.extracted_json || "{}");
    const fields = Object.keys(data).filter(k => !k.startsWith("_") && data[k]);
    console.log(`   [${e.id}] ${e.domain_id}/${e.entity_slug} conf=${e.confidence_score.toFixed(2)} 項目=${fields.length}`);
  });

  console.log(`\n⚠️ P2 要確認: ${groups.P2.length}件`);
  groups.P2.forEach(e => console.log(`   [${e.id}] ${e.domain_id}/${e.entity_slug} conf=${e.confidence_score.toFixed(2)}`));

  console.log(`\n⏸️ P3 保留: ${groups.P3.length}件`);
  console.log(`❌ P4 失敗: ${groups.P4.length}件`);
}

function previewApply(db, domainId, args) {
  if (!domainId) { console.log("Usage: preview <domain-id>"); return; }
  const limit = args.includes("--limit") ? parseInt(args[args.indexOf("--limit") + 1]) : 10;

  console.log(`\n=== 反映プレビュー: ${domainId} (最大${limit}件) ===\n`);

  const extractions = db.prepare(`
    SELECT * FROM ai_extractions WHERE domain_id = ? AND applied_at IS NULL ORDER BY confidence_score DESC LIMIT ?
  `).all(domainId, limit);

  if (extractions.length === 0) { console.log("反映対象なし"); return; }

  const tableMap = { "food-recall": "food_recall_items", "shitei": "shitei_items", "sanpai": "sanpai_items", "kyoninka": "kyoninka_entities" };
  const table = tableMap[domainId];
  if (!table) { console.log("未対応ドメイン"); return; }

  let previewCount = 0;
  for (const ext of extractions) {
    const data = JSON.parse(ext.extracted_json || "{}");
    if (!ext.entity_id) continue;
    const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(ext.entity_id);
    if (!existing) continue;

    const updates = [];
    for (const [key, value] of Object.entries(data)) {
      if (!value || String(value).trim() === "" || key.startsWith("_")) continue;
      if (existing[key] === undefined) continue;
      if (!existing[key] || String(existing[key]).trim() === "" || existing[key] === "—") {
        updates.push({ key, value: String(value).trim().substring(0, 100) });
      }
    }

    if (updates.length === 0) continue;

    const priority = classifyExtraction(ext);
    console.log(`[${priority}] ${ext.entity_slug} (conf=${ext.confidence_score.toFixed(2)}):`);
    updates.forEach(u => console.log(`  + ${u.key}: "${u.value}${u.value.length >= 100 ? "..." : ""}"`));
    console.log("");
    previewCount++;
  }

  console.log(`反映候補: ${previewCount}件`);
}

async function applyExtractions(db, domainId, dryRun) {
  if (!domainId) { console.log("Usage: apply <domain-id> [--dry-run]"); return; }

  console.log(`\n=== AI半自動反映: ${domainId} ${dryRun ? "[DRY RUN]" : ""} ===\n`);

  const extractions = db.prepare(`
    SELECT * FROM ai_extractions WHERE domain_id = ? AND applied_at IS NULL AND confidence_score >= 0.4 ORDER BY confidence_score DESC
  `).all(domainId);

  if (extractions.length === 0) { console.log("反映対象なし"); return; }

  const tableMap = { "food-recall": "food_recall_items", "shitei": "shitei_items", "sanpai": "sanpai_items", "kyoninka": "kyoninka_entities" };
  const table = tableMap[domainId];
  if (!table) { console.log("未対応ドメイン"); return; }

  let applied = 0, skipped = 0, fieldsUpdated = 0;

  for (const ext of extractions) {
    const data = JSON.parse(ext.extracted_json || "{}");
    if (!ext.entity_id) { skipped++; continue; }
    const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(ext.entity_id);
    if (!existing) { skipped++; continue; }

    const updates = [];
    for (const [key, value] of Object.entries(data)) {
      if (!value || String(value).trim() === "" || key.startsWith("_")) continue;
      if (existing[key] === undefined) continue;
      if (!existing[key] || String(existing[key]).trim() === "" || existing[key] === "—") {
        updates.push({ key, value: String(value).trim() });
      }
    }

    if (updates.length === 0) { skipped++; continue; }

    if (!dryRun) {
      for (const u of updates) {
        try {
          db.prepare(`UPDATE ${table} SET ${u.key} = ? WHERE id = ?`).run(u.value, ext.entity_id);
          fieldsUpdated++;
        } catch {}
      }
      db.prepare("UPDATE ai_extractions SET applied_at = datetime('now') WHERE id = ?").run(ext.id);
    }

    console.log(`  ✅ ${ext.entity_slug}: ${updates.length}項目補完`);
    applied++;
  }

  console.log(`\n結果: 反映${applied}件(${fieldsUpdated}項目), スキップ${skipped}件`);
}

function reclassifyShitei(db) {
  console.log("\n=== shitei 保留案件再分類 ===\n");

  const holdItems = db.prepare("SELECT * FROM shitei_items WHERE is_published = 0").all();
  console.log(`保留案件: ${holdItems.length}件\n`);

  let publishCandidate = 0, reviewRequired = 0, stillHold = 0;

  for (const item of holdItems) {
    // AI抽出結果があるか確認
    const aiResult = db.prepare("SELECT * FROM ai_extractions WHERE domain_id = 'shitei' AND entity_id = ? ORDER BY id DESC LIMIT 1").get(item.id);

    // 公開候補条件の再評価
    const hasTitle = item.title && item.title.length >= 10;
    const hasMunicipality = !!item.municipality_name;
    const isRelevant = item.title && item.title.match(/指定管理|公募|募集|委託|選定|管理者|運営/);

    if (hasTitle && hasMunicipality && isRelevant) {
      // AI抽出で追加情報があるか
      if (aiResult) {
        const data = JSON.parse(aiResult.extracted_json || "{}");
        const hasExtra = Object.keys(data).filter(k => !k.startsWith("_") && data[k]).length > 0;
        if (hasExtra) {
          publishCandidate++;
          continue;
        }
      }
      reviewRequired++;
    } else {
      stillHold++;
    }
  }

  console.log(`✅ 公開候補: ${publishCandidate}件`);
  console.log(`⚠️ 要確認: ${reviewRequired}件`);
  console.log(`⏸️ 引き続き保留: ${stillHold}件`);

  // 公開候補を is_published=1 に更新するか表示
  if (publishCandidate > 0) {
    console.log(`\n公開候補を公開するには:`);
    console.log(`  node scripts/apply-ai-extractions.js apply shitei`);
  }
}

function bulkApprove(db, args) {
  const domainFilter = args.includes("--domain") ? args[args.indexOf("--domain") + 1] : null;

  console.log(`\n=== P1 一括承認 ${domainFilter ? `(${domainFilter})` : "(全ドメイン)"} ===\n`);

  let query = "SELECT * FROM ai_extractions WHERE applied_at IS NULL";
  const params = [];
  if (domainFilter) { query += " AND domain_id = ?"; params.push(domainFilter); }

  const extractions = db.prepare(query).all(...params);
  const p1Items = extractions.filter(ext => classifyExtraction(ext) === "P1");

  if (p1Items.length === 0) {
    console.log("P1 一括承認対象なし");
    console.log("\nヒント: P2の件数を確認してください:");
    const p2Items = extractions.filter(ext => classifyExtraction(ext) === "P2");
    console.log(`  P2 要確認: ${p2Items.length}件`);
    console.log("  P2 を反映するには: node scripts/apply-ai-extractions.js apply <domain>");
    return;
  }

  console.log(`P1 対象: ${p1Items.length}件\n`);

  const tableMap = { "food-recall": "food_recall_items", "shitei": "shitei_items", "sanpai": "sanpai_items", "kyoninka": "kyoninka_entities" };
  let approved = 0;

  for (const ext of p1Items) {
    const table = tableMap[ext.domain_id];
    if (!table || !ext.entity_id) continue;

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
      console.log(`  ✅ [${ext.domain_id}] ${ext.entity_slug}: ${updated}項目反映`);
      approved++;
    }
  }

  console.log(`\n一括承認完了: ${approved}件反映`);
}

main().catch((err) => { console.error(err); process.exit(1); });
