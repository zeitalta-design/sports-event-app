#!/usr/bin/env node
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

const dryRun = process.argv.includes("--dry-run");
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error("[fetch-ppc] ERROR: TURSO env が未設定");
  process.exit(1);
}

console.log(`[fetch-ppc] Start: dryRun=${dryRun}`);
const start = Date.now();
const { fetchAndUpsertPpcActions } = await import("../lib/gyosei-shobun-ppc-fetcher.js");
const result = await fetchAndUpsertPpcActions({ dryRun });
const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`\n[fetch-ppc] Done (${elapsed}s)`);
console.log(`  collected: ${result.collected}, processed: ${result.processed}, created: ${result.created}, updated: ${result.updated}, skipped: ${result.skipped}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    "## 個人情報保護委員会 行政上の対応 取得結果",
    "",
    "| 項目 | 値 |",
    "|------|----|",
    `| 収集 | ${result.collected} |`,
    `| 処理 | ${result.processed} |`,
    `| 新規 | ${result.created} |`,
    `| 更新 | ${result.updated} |`,
    `| スキップ | ${result.skipped} |`,
    `| 所要 | ${elapsed}s |`,
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}

process.exit(0);
