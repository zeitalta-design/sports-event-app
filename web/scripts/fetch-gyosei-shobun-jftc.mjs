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
  console.error("[fetch-jftc] ERROR: TURSO env が未設定");
  process.exit(1);
}

console.log(`[fetch-jftc] Start: dryRun=${dryRun}`);
const start = Date.now();

const { fetchAndUpsertJftcOrders } = await import("../lib/gyosei-shobun-jftc-fetcher.js");
const result = await fetchAndUpsertJftcOrders({ dryRun });

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log("\n========================================");
console.log(`[fetch-jftc] Done (${elapsed}s)`);
console.log(`  totalProcessed: ${result.totalProcessed}`);
console.log(`  totalCreated:   ${result.totalCreated}`);
console.log(`  totalUpdated:   ${result.totalUpdated}`);
for (const y of result.perYear) {
  if (y.error) console.log(`  ! ${y.year}: ${y.error}`);
  else console.log(`  ${y.year}: processed=${y.processed} created=${y.created} updated=${y.updated}`);
}
console.log("========================================");

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    "## 公正取引委員会 排除措置命令 取得結果",
    "",
    "| 項目 | 値 |",
    "|------|----|",
    `| 処理 | ${result.totalProcessed} |`,
    `| 新規 | ${result.totalCreated} |`,
    `| 更新 | ${result.totalUpdated} |`,
    `| 所要 | ${elapsed}s |`,
    "",
    "### 年度別",
    "| 年度 | 処理 | 新規 | 更新 |",
    "|------|------|------|------|",
    ...result.perYear.map((y) => `| ${y.year} | ${y.processed || 0} | ${y.created || 0} | ${y.updated || 0} |`),
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}

process.exit(0);
