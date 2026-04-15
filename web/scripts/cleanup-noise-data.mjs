#!/usr/bin/env node
/**
 * 行政処分・産廃データから「企業名らしくない」ノイズレコードを削除する。
 *
 * shouldSkipAsCompanyName で skip 判定されるレコードを対象とする。
 *
 * オプション:
 *   --dry-run    削除せず対象だけリスト表示
 *   --confirm    実際に削除（dry-run でない場合のみ削除実行）
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const c = fs.readFileSync(envLocalPath, "utf8");
  for (const line of c.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);

const dryRun = !process.argv.includes("--confirm");

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error("[cleanup] ERROR: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN が未設定");
  process.exit(1);
}

const { getDb } = await import("../lib/db.js");
const { shouldSkipAsCompanyName } = await import("../lib/company-name-validator.js");

const db = getDb();
console.log(`[cleanup] mode: ${dryRun ? "DRY-RUN (削除しない)" : "DELETE (実際に削除)"}`);

// 1. administrative_actions
console.log("\n=== administrative_actions ===");
const actionsAll = db.prepare("SELECT id, organization_name_raw, prefecture, action_date FROM administrative_actions").all();
console.log(`total: ${actionsAll.length}`);

const actionsToDelete = [];
const reasonCounts = {};
for (const row of actionsAll) {
  const reason = shouldSkipAsCompanyName(row.organization_name_raw);
  if (reason) {
    actionsToDelete.push({ id: row.id, name: row.organization_name_raw, reason, prefecture: row.prefecture });
    const reasonKey = reason.split("(")[0]; // 詳細 (kw) を除いた集計
    reasonCounts[reasonKey] = (reasonCounts[reasonKey] || 0) + 1;
  }
}

console.log(`削除候補: ${actionsToDelete.length}件 (全体の ${(actionsToDelete.length / actionsAll.length * 100).toFixed(1)}%)`);
console.log("理由別:");
for (const [reason, count] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${reason}: ${count}件`);
}
console.log("サンプル:");
for (const r of actionsToDelete.slice(0, 10)) {
  console.log(`  [${r.reason}] ${String(r.name).slice(0, 50)} (${r.prefecture || "-"})`);
}

if (!dryRun && actionsToDelete.length > 0) {
  const stmt = db.prepare("DELETE FROM administrative_actions WHERE id = ?");
  let deleted = 0;
  for (const r of actionsToDelete) {
    try { stmt.run(r.id); deleted++; } catch (e) { console.log(`! ${r.id}: ${e.message}`); }
  }
  console.log(`\n→ DELETED ${deleted} rows from administrative_actions`);
}

// 2. sanpai_items
console.log("\n=== sanpai_items ===");
const sanpaiAll = db.prepare("SELECT id, company_name, prefecture FROM sanpai_items").all();
console.log(`total: ${sanpaiAll.length}`);

const sanpaiToDelete = [];
const sanpaiReasons = {};
for (const row of sanpaiAll) {
  const reason = shouldSkipAsCompanyName(row.company_name);
  if (reason) {
    sanpaiToDelete.push({ id: row.id, name: row.company_name, reason });
    const reasonKey = reason.split("(")[0];
    sanpaiReasons[reasonKey] = (sanpaiReasons[reasonKey] || 0) + 1;
  }
}
console.log(`削除候補: ${sanpaiToDelete.length}件`);
for (const [reason, count] of Object.entries(sanpaiReasons).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${reason}: ${count}件`);
}
for (const r of sanpaiToDelete.slice(0, 5)) {
  console.log(`  [${r.reason}] ${String(r.name).slice(0, 50)}`);
}

if (!dryRun && sanpaiToDelete.length > 0) {
  const stmt = db.prepare("DELETE FROM sanpai_items WHERE id = ?");
  let deleted = 0;
  for (const r of sanpaiToDelete) {
    try { stmt.run(r.id); deleted++; } catch (e) { console.log(`! ${r.id}: ${e.message}`); }
  }
  console.log(`\n→ DELETED ${deleted} rows from sanpai_items`);
}

// 3. kyoninka_entities (gbiz-プレフィックスで誤って登録された entity)
console.log("\n=== kyoninka_entities (gbiz-* のみ) ===");
const kyoAll = db.prepare("SELECT id, slug, entity_name, corporate_number FROM kyoninka_entities WHERE slug LIKE 'gbiz-%'").all();
console.log(`gbiz total: ${kyoAll.length}`);

const kyoToDelete = [];
for (const row of kyoAll) {
  const reason = shouldSkipAsCompanyName(row.entity_name);
  if (reason) {
    kyoToDelete.push({ id: row.id, name: row.entity_name, reason, corporate_number: row.corporate_number });
  }
}
console.log(`削除候補: ${kyoToDelete.length}件`);
for (const r of kyoToDelete.slice(0, 5)) {
  console.log(`  [${r.reason}] ${String(r.name).slice(0, 80)}`);
}

if (!dryRun && kyoToDelete.length > 0) {
  // registrations はカスケード削除（FK ON DELETE CASCADE があるため自動）
  const stmt = db.prepare("DELETE FROM kyoninka_entities WHERE id = ?");
  let deleted = 0;
  for (const r of kyoToDelete) {
    try { stmt.run(r.id); deleted++; } catch (e) { console.log(`! ${r.id}: ${e.message}`); }
  }
  console.log(`\n→ DELETED ${deleted} rows from kyoninka_entities`);
}

console.log("\n[cleanup] Done");
if (dryRun) {
  console.log("→ 実際に削除するには --confirm オプションを付けて再実行");
}
