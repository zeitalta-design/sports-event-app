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
const maxArg = process.argv.find((a) => a.startsWith("--max-pages="));
const maxPages = maxArg ? parseInt(maxArg.split("=")[1], 10) : 30;

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error("[fetch-caa] ERROR: TURSO env が未設定");
  process.exit(1);
}

console.log(`[fetch-caa] Start: maxPages=${maxPages} dryRun=${dryRun}`);
const start = Date.now();

const { fetchAndUpsertCaaShobun } = await import("../lib/gyosei-shobun-caa-fetcher.js");
const result = await fetchAndUpsertCaaShobun({ dryRun, maxPages });

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log("\n========================================");
console.log(`[fetch-caa] Done (${elapsed}s)`);
console.log(`  totalPages: ${result.totalPages}`);
console.log(`  processed:  ${result.processed}`);
console.log(`  created:    ${result.created}`);
console.log(`  updated:    ${result.updated}`);
console.log(`  skipped:    ${result.skipped}`);
console.log("========================================");

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    "## 消費者庁 特商法違反 取得結果",
    "",
    "| 項目 | 値 |",
    "|------|----|",
    `| ページ数 | ${result.totalPages} |`,
    `| 処理 | ${result.processed} |`,
    `| 新規 | ${result.created} |`,
    `| 更新 | ${result.updated} |`,
    `| スキップ | ${result.skipped} |`,
    `| 所要 | ${elapsed}s |`,
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}

process.exit(0);
