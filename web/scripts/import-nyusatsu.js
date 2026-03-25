#!/usr/bin/env node
/**
 * 入札ナビ — 外部データ取り込み CLI
 *
 * Usage:
 *   node scripts/import-nyusatsu.js <input.json> [options]
 *   node scripts/import-nyusatsu.js --remote <URL> [options]
 *   node scripts/import-nyusatsu.js --source <name> [options]
 *
 * Source env: --source primary → NYUSATSU_SOURCE_PRIMARY_URL
 */

import "dotenv/config";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { loadJson, loadRemoteJson, runImport } = await import(pathToFileURL(resolve(__dirname, "../lib/importers/nyusatsu.js")).href);
const { fetchFromSource, getAvailableSources } = await import(pathToFileURL(resolve(__dirname, "../lib/importers/nyusatsu-source.js")).href);
const { getDb } = await import(pathToFileURL(resolve(__dirname, "../lib/db.js")).href);

function upsertNyusatsuItem(item) {
  const db = getDb();
  const existing = item.slug ? db.prepare("SELECT id FROM nyusatsu_items WHERE slug = ?").get(item.slug) : null;
  if (existing) {
    db.prepare(`UPDATE nyusatsu_items SET title=@title, category=@category, issuer_name=@issuer_name, target_area=@target_area, deadline=@deadline, budget_amount=@budget_amount, bidding_method=@bidding_method, summary=@summary, status=@status, is_published=@is_published, updated_at=datetime('now') WHERE id=@id`).run({ ...item, id: existing.id });
    return { action: "update", id: existing.id };
  }
  const r = db.prepare(`INSERT INTO nyusatsu_items (slug, title, category, issuer_name, target_area, deadline, budget_amount, bidding_method, summary, status, is_published, created_at, updated_at) VALUES (@slug, @title, @category, @issuer_name, @target_area, @deadline, @budget_amount, @bidding_method, @summary, @status, @is_published, datetime('now'), datetime('now'))`).run(item);
  return { action: "insert", id: r.lastInsertRowid };
}

const args = process.argv.slice(2);
let inputPath = null, remoteUrl = null, sourceName = null, dryRun = false, verbose = false, limit = 0;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--dry-run") dryRun = true;
  else if (args[i] === "--verbose") verbose = true;
  else if (args[i] === "--limit" && args[i + 1]) limit = parseInt(args[++i], 10);
  else if (args[i] === "--remote" && args[i + 1]) remoteUrl = args[++i];
  else if (args[i] === "--source" && args[i + 1]) sourceName = args[++i];
  else if (!args[i].startsWith("--")) inputPath = args[i];
}

const modeCount = [inputPath, remoteUrl, sourceName].filter(Boolean).length;
if (modeCount > 1) { console.error("❌ --source, --remote, ローカルパスは同時に指定できません"); process.exit(1); }
if (modeCount === 0) { console.error(`Usage:\n  node scripts/import-nyusatsu.js <input.json> [options]\n  node scripts/import-nyusatsu.js --remote <URL> [options]\n  node scripts/import-nyusatsu.js --source <name> [options]\n\nSources: ${getAvailableSources().join(", ")}`); process.exit(1); }

let sourceLabel;
if (sourceName) sourceLabel = `SOURCE: ${sourceName}`;
else if (remoteUrl) sourceLabel = `REMOTE: ${remoteUrl}`;
else sourceLabel = `FILE: ${path.resolve(inputPath)}`;

console.log(`\n📥 入札ナビ データ取り込み`);
console.log(`   ソース: ${sourceLabel}`);
console.log(`   モード: ${dryRun ? "DRY RUN" : "EXECUTE"}`);
if (limit > 0) console.log(`   制限: 先頭 ${limit} 件`);
console.log();

let rawItems;
try {
  if (sourceName) { console.log(`🔌 source "${sourceName}" からデータ取得中...`); rawItems = await fetchFromSource(sourceName); console.log(`✅ 取得完了 (${rawItems.length} 件)\n`); }
  else if (remoteUrl) { console.log(`🌐 リモート取得中...`); rawItems = await loadRemoteJson(remoteUrl); console.log(`✅ 取得完了\n`); }
  else { rawItems = loadJson(path.resolve(inputPath)); }
} catch (err) { console.error(`❌ データ取得エラー: ${err.message}`); process.exit(1); }

if (limit > 0) rawItems = rawItems.slice(0, limit);
console.log(`📊 入力件数: ${rawItems.length}\n`);
if (!dryRun) getDb();

const report = runImport(rawItems, { dryRun, upsertFn: upsertNyusatsuItem, verbose });

console.log("\n" + "═".repeat(50));
console.log("📋 取り込みレポート");
console.log("═".repeat(50));
console.log(`   ソース:      ${sourceName ? `source:${sourceName}` : remoteUrl ? "リモート" : "ローカルファイル"}`);
console.log(`   入力件数:    ${report.total}`);
console.log(`   有効件数:    ${report.valid}`);
if (!dryRun) { console.log(`   INSERT:      ${report.inserted}`); console.log(`   UPDATE:      ${report.updated}`); }
console.log(`   スキップ:    ${report.skipped}`);
console.log(`   エラー:      ${report.errors.length}`);
if (report.errors.length > 0) { console.log("\n⚠️  エラー詳細:"); report.errors.forEach((e) => console.log(`   - ${e}`)); }
if (dryRun) { console.log(`\n💡 dry-run です。実行するには --dry-run を外してください。`); }
else { try { const c = getDb().prepare("SELECT COUNT(*) as c FROM nyusatsu_items").get(); console.log(`\n📊 nyusatsu_items 合計: ${c.c} 件`); } catch {} }
console.log();
