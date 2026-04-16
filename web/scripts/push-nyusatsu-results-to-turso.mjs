#!/usr/bin/env node
/**
 * ローカル sqlite の nyusatsu_results を Turso にバッチ転送する。
 *
 * Turso への単発 INSERT は HTTP 往復が遅いため、batch execute を使って
 * 数百件ずつまとめて転送する。
 *
 * 使い方:
 *   node scripts/push-nyusatsu-results-to-turso.mjs [--batch 200] [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { createClient } from "@libsql/client";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error("ERROR: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 未設定");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const batchSize = parseInt(
  process.argv.find((a, i) => process.argv[i - 1] === "--batch") || "200", 10,
);

const local = new Database(path.resolve(process.cwd(), "data/risk-monitor.db"));
const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

console.log(`[push] batchSize=${batchSize} dryRun=${dryRun}`);

// local からすべての results を取得
const rows = local.prepare("SELECT * FROM nyusatsu_results ORDER BY id").all();
console.log(`[push] local rows: ${rows.length}`);

// Turso の既存 slugs を取得（更新対象を確定）
const existingSlugsRes = await turso.execute("SELECT slug FROM nyusatsu_results");
const existingSlugs = new Set(existingSlugsRes.rows.map((r) => r.slug));
console.log(`[push] turso existing: ${existingSlugs.size}`);

const toInsert = rows.filter((r) => !existingSlugs.has(r.slug));
console.log(`[push] to insert: ${toInsert.length}`);

if (toInsert.length === 0) { console.log("[push] 差分なし"); process.exit(0); }
if (dryRun) { console.log("[push] dry-run 終了"); process.exit(0); }

const columns = [
  "slug", "nyusatsu_item_id", "title", "issuer_name", "winner_name",
  "winner_corporate_number", "award_amount", "award_date",
  "num_bidders", "award_rate", "budget_amount", "category",
  "target_area", "bidding_method", "result_url", "source_name",
  "source_url", "summary", "is_published",
];

const start = Date.now();
let done = 0;

for (let i = 0; i < toInsert.length; i += batchSize) {
  const batch = toInsert.slice(i, i + batchSize);
  const stmts = batch.map((row) => ({
    sql: `INSERT INTO nyusatsu_results (${columns.join(",")}, created_at, updated_at) VALUES (${columns.map(() => "?").join(",")}, datetime('now'), datetime('now'))`,
    args: columns.map((c) => row[c] ?? null),
  }));

  try {
    await turso.batch(stmts, "write");
    done += batch.length;
  } catch (e) {
    console.warn(`[batch ${i}] error: ${e.message}`);
    // 個別投入にフォールバック
    for (const stmt of stmts) {
      try { await turso.execute(stmt); done++; } catch { /* skip */ }
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const rate = (done / parseFloat(elapsed)).toFixed(0);
  process.stdout.write(`\r[push] ${done}/${toInsert.length}  (${rate} rows/s, ${elapsed}s)`);
}

console.log(`\n[done] ${done}件転送完了`);
