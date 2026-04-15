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
  console.error("[fetch-nta] ERROR: TURSO env が未設定");
  process.exit(1);
}

console.log(`[fetch-nta] Start: dryRun=${dryRun}`);
const start = Date.now();
const { fetchAndUpsertNtaZeirishi } = await import("../lib/gyosei-shobun-nta-fetcher.js");
const result = await fetchAndUpsertNtaZeirishi({ dryRun });
const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`\n[fetch-nta] Done (${elapsed}s)`);
console.log(`  processed: ${result.totalProcessed}, created: ${result.totalCreated}, updated: ${result.totalUpdated}`);
for (const s of result.perSource) {
  if (s.error) console.log(`  ! ${s.label}: ${s.error}`);
  else console.log(`  ${s.label}: processed=${s.processed} created=${s.created} updated=${s.updated}`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    "## 国税庁 税理士懲戒処分 取得結果",
    "",
    "| 項目 | 値 |",
    "|------|----|",
    `| 処理 | ${result.totalProcessed} |`,
    `| 新規 | ${result.totalCreated} |`,
    `| 更新 | ${result.totalUpdated} |`,
    `| 所要 | ${elapsed}s |`,
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}
process.exit(0);
