#!/usr/bin/env node

/**
 * 株主優待ナビ — 外部データ取り込み CLI
 *
 * Usage:
 *   node scripts/import-yutai.js <input.json> [options]
 *   node scripts/import-yutai.js --remote <URL> [options]
 *   node scripts/import-yutai.js --source <name> [options]
 *
 * Options:
 *   --source <name>  実データソースから取得 (primary)
 *   --remote <URL>   外部 URL から JSON を取得
 *   --dry-run        DB を更新せず、取り込み予定件数のみ表示
 *   --verbose        各レコードの処理結果を表示
 *   --limit <N>      先頭 N 件のみ処理
 *
 * Source env:
 *   --source primary → YUTAI_SOURCE_PRIMARY_URL
 *
 * Examples:
 *   node scripts/import-yutai.js data/yutai-sample.json --dry-run
 *   node scripts/import-yutai.js --remote https://example.com/yutai.json --verbose
 *   node scripts/import-yutai.js --source primary --dry-run
 */

import "dotenv/config";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { loadJson, loadRemoteJson, runImport } = await import(pathToFileURL(resolve(__dirname, "../lib/importers/yutai.js")).href);
const { fetchFromSource, getAvailableSources } = await import(pathToFileURL(resolve(__dirname, "../lib/importers/yutai-source.js")).href);
const { getDb } = await import(pathToFileURL(resolve(__dirname, "../lib/db.js")).href);

// upsert
function upsertYutaiItem(item) {
  const db = getDb();
  let existing = null;
  if (item.code) {
    existing = db.prepare("SELECT id FROM yutai_items WHERE code = ?").get(item.code);
  }
  if (!existing && item.slug) {
    existing = db.prepare("SELECT id FROM yutai_items WHERE slug = ?").get(item.slug);
  }
  if (existing) {
    db.prepare(`
      UPDATE yutai_items SET
        slug = @slug, title = @title, category = @category,
        confirm_months = @confirm_months, min_investment = @min_investment,
        benefit_summary = @benefit_summary, dividend_yield = @dividend_yield,
        benefit_yield = @benefit_yield, is_published = @is_published,
        updated_at = datetime('now')
      WHERE id = @id
    `).run({ ...item, id: existing.id });
    return { action: "update", id: existing.id };
  }
  const result = db.prepare(`
    INSERT INTO yutai_items
      (code, slug, title, category, confirm_months, min_investment,
       benefit_summary, dividend_yield, benefit_yield, is_published,
       created_at, updated_at)
    VALUES
      (@code, @slug, @title, @category, @confirm_months, @min_investment,
       @benefit_summary, @dividend_yield, @benefit_yield, @is_published,
       datetime('now'), datetime('now'))
  `).run(item);
  return { action: "insert", id: result.lastInsertRowid };
}

// ─── 引数パース ──────────────────────

const args = process.argv.slice(2);
let inputPath = null;
let remoteUrl = null;
let sourceName = null;
let dryRun = false;
let verbose = false;
let limit = 0;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--dry-run") dryRun = true;
  else if (args[i] === "--verbose") verbose = true;
  else if (args[i] === "--limit" && args[i + 1]) limit = parseInt(args[++i], 10);
  else if (args[i] === "--remote" && args[i + 1]) remoteUrl = args[++i];
  else if (args[i] === "--source" && args[i + 1]) sourceName = args[++i];
  else if (!args[i].startsWith("--")) inputPath = args[i];
}

// 排他チェック
const modeCount = [inputPath, remoteUrl, sourceName].filter(Boolean).length;
if (modeCount > 1) {
  console.error("❌ --source, --remote, ローカルパスは同時に指定できません");
  process.exit(1);
}

if (modeCount === 0) {
  console.error(`
Usage:
  node scripts/import-yutai.js <input.json> [options]
  node scripts/import-yutai.js --remote <URL> [options]
  node scripts/import-yutai.js --source <name> [options]

Options:
  --source <name>  実データソースから取得 (${getAvailableSources().join(", ")})
  --remote <URL>   外部 URL から JSON を取得
  --dry-run        DB を更新しない
  --verbose        各レコードの結果を表示
  --limit <N>      先頭 N 件のみ処理

Examples:
  node scripts/import-yutai.js data/yutai-sample.json --dry-run
  node scripts/import-yutai.js --remote https://example.com/yutai.json --verbose
  node scripts/import-yutai.js --source primary --dry-run
`);
  process.exit(1);
}

// ─── データ取得 ──────────────────────

let sourceLabel;
if (sourceName) sourceLabel = `SOURCE: ${sourceName}`;
else if (remoteUrl) sourceLabel = `REMOTE: ${remoteUrl}`;
else sourceLabel = `FILE: ${path.resolve(inputPath)}`;

console.log(`\n📥 株主優待ナビ データ取り込み`);
console.log(`   ソース: ${sourceLabel}`);
console.log(`   モード: ${dryRun ? "DRY RUN（DB 更新なし）" : "EXECUTE"}`);
if (limit > 0) console.log(`   制限: 先頭 ${limit} 件`);
console.log();

let rawItems;
try {
  if (sourceName) {
    console.log(`🔌 source "${sourceName}" からデータ取得中...`);
    rawItems = await fetchFromSource(sourceName);
    console.log(`✅ 取得完了 (${rawItems.length} 件)\n`);
  } else if (remoteUrl) {
    console.log(`🌐 リモート取得中...`);
    rawItems = await loadRemoteJson(remoteUrl);
    console.log(`✅ 取得完了\n`);
  } else {
    rawItems = loadJson(path.resolve(inputPath));
  }
} catch (err) {
  console.error(`❌ データ取得エラー: ${err.message}`);
  process.exit(1);
}

if (limit > 0) {
  rawItems = rawItems.slice(0, limit);
}

console.log(`📊 入力件数: ${rawItems.length}`);
console.log();

if (!dryRun) {
  getDb();
}

const report = runImport(rawItems, {
  dryRun,
  upsertFn: upsertYutaiItem,
  verbose,
});

// ─── レポート出力 ──────────────────────

console.log("\n" + "═".repeat(50));
console.log("📋 取り込みレポート");
console.log("═".repeat(50));
console.log(`   ソース:      ${sourceName ? `source:${sourceName}` : remoteUrl ? "リモート" : "ローカルファイル"}`);
console.log(`   入力件数:    ${report.total}`);
console.log(`   有効件数:    ${report.valid}`);
if (!dryRun) {
  console.log(`   INSERT:      ${report.inserted}`);
  console.log(`   UPDATE:      ${report.updated}`);
}
console.log(`   スキップ:    ${report.skipped}`);
console.log(`   エラー:      ${report.errors.length}`);

if (report.errors.length > 0) {
  console.log("\n⚠️  エラー詳細:");
  report.errors.forEach((e) => console.log(`   - ${e}`));
}

if (dryRun) {
  console.log(`\n💡 これは dry-run です。実際に取り込むには --dry-run を外してください。`);
} else {
  try {
    const db = getDb();
    const count = db.prepare("SELECT COUNT(*) as c FROM yutai_items").get();
    console.log(`\n📊 yutai_items 合計: ${count.c} 件`);
  } catch {}
}

console.log();
