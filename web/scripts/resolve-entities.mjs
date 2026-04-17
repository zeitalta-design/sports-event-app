#!/usr/bin/env node
/**
 * Resolver バッチ CLI
 *
 * 既存の nyusatsu_items / nyusatsu_results / sanpai_items の事業者名を
 * Resolver に通し、resolved_entities / resolution_aliases / resolution_scores を
 * 埋める。
 *
 * 使い方:
 *   node scripts/resolve-entities.mjs [--local] [--source nyusatsu_items|nyusatsu_results|sanpai_items]
 *                                     [--limit N] [--threshold 0.9]
 *
 *   --source   対象テーブル。省略時は全部
 *   --limit    各テーブルから処理する上限件数（省略時は全件）
 *   --threshold fuzzy 閾値（既定 0.9）
 *   --local    ローカル sqlite を対象
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const argVal = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : null;
};
const hasFlag = (name) => argv.includes(`--${name}`);

const useLocal = hasFlag("local");
const sourceArg = argVal("source"); // null or table name
const limit = argVal("limit") ? parseInt(argVal("limit"), 10) : null;
const threshold = argVal("threshold") ? parseFloat(argVal("threshold")) : 0.90;

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (useLocal) {
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
}
if (!useLocal && (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN)) {
  console.error("[resolve-entities] TURSO env 未設定。--local を指定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");
const { resolveEntity, createDataStore } = await import("../lib/agents/resolver/index.js");

const db = getDb();
const store = createDataStore(db);

// ソース定義: どのテーブルから どのカラムを引くか
const SOURCES = [
  {
    table: "nyusatsu_items",
    sql: "SELECT id, issuer_name AS name, NULL AS corp, target_area AS area FROM nyusatsu_items WHERE issuer_name IS NOT NULL AND issuer_name != '' AND is_published = 1",
    fieldLabel: "issuer_name (発注機関)",
  },
  {
    table: "nyusatsu_results",
    sql: "SELECT id, winner_name AS name, winner_corporate_number AS corp, target_area AS area FROM nyusatsu_results WHERE winner_name IS NOT NULL AND winner_name != '' AND is_published = 1",
    fieldLabel: "winner_name (落札者)",
  },
  {
    table: "sanpai_items",
    sql: "SELECT id, company_name AS name, corporate_number AS corp, prefecture AS area FROM sanpai_items WHERE company_name IS NOT NULL AND company_name != '' AND is_published = 1",
    fieldLabel: "company_name (産廃事業者)",
  },
];

const targets = sourceArg
  ? SOURCES.filter((s) => s.table === sourceArg)
  : SOURCES;

if (targets.length === 0) {
  console.error(`[resolve-entities] 未知の --source: ${sourceArg}`);
  process.exit(1);
}

console.log(`[resolve-entities] Start: local=${useLocal} threshold=${threshold} limit=${limit || "none"}`);
const start = Date.now();

const totals = { processed: 0, corpNumber: 0, normalized: 0, fuzzy: 0, created: 0, errors: 0 };

for (const src of targets) {
  console.log(`\n=== ${src.table} (${src.fieldLabel}) ===`);
  let sql = src.sql;
  if (limit) sql += ` LIMIT ${limit}`;
  const rows = db.prepare(sql).all();
  console.log(`  target rows: ${rows.length}`);

  let processed = 0;
  const stat = { corp_number: 0, normalized: 0, fuzzy: 0, new: 0 };

  for (const row of rows) {
    try {
      const r = await resolveEntity(
        { name: row.name, corporateNumber: row.corp, prefecture: row.area ? String(row.area).split(" ")[0] : null },
        { store, fuzzyThreshold: threshold }
      );
      stat[r.layer]++;
      processed++;
      if (processed % 500 === 0) {
        process.stdout.write(`\r  processed ${processed}/${rows.length}`);
      }
    } catch (e) {
      totals.errors++;
    }
  }
  process.stdout.write("\r");
  console.log(`  done ${processed}/${rows.length}`);
  console.log(`  layer別: corp_number=${stat.corp_number} normalized=${stat.normalized} fuzzy=${stat.fuzzy} new=${stat.new}`);

  totals.processed += processed;
  totals.corpNumber += stat.corp_number;
  totals.normalized += stat.normalized;
  totals.fuzzy      += stat.fuzzy;
  totals.created    += stat.new;
}

// 集計
const entityCount = db.prepare("SELECT COUNT(*) c FROM resolved_entities").get().c;
const aliasCount  = db.prepare("SELECT COUNT(*) c FROM resolution_aliases").get().c;
const elapsed = ((Date.now() - start) / 1000).toFixed(1);

console.log("\n========================================");
console.log(`[resolve-entities] Done (${elapsed}s)`);
console.log(`  processed: ${totals.processed}`);
console.log(`  corp_number-hit: ${totals.corpNumber}`);
console.log(`  normalized-hit:  ${totals.normalized}`);
console.log(`  fuzzy-hit:       ${totals.fuzzy}`);
console.log(`  new entities:    ${totals.created}`);
console.log(`  errors:          ${totals.errors}`);
console.log(`  DB: entities=${entityCount} aliases=${aliasCount}`);
console.log("========================================");
