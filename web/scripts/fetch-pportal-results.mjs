#!/usr/bin/env node
/**
 * 調達ポータル落札実績オープンデータを取得する CLI。
 *
 * 使い方:
 *   node scripts/fetch-pportal-results.mjs [--mode all|diff] [--date YYYYMMDD] [--year YYYY] [--dry-run] [--local]
 *
 *   --mode diff (default): 日次差分（昨日分）
 *   --mode all: 全件（指定年度 or 今年度）
 *   --date 20260415: diff モードの日付指定
 *   --year 2025: all モードの年度指定
 *   --local: ローカル sqlite を使用
 *   --dry-run: DB書き込みスキップ
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const dryRun = process.argv.includes("--dry-run");
const useLocal = process.argv.includes("--local");
const modeArg = process.argv.find((a, i) => process.argv[i - 1] === "--mode") || "diff";
const dateArg = process.argv.find((a, i) => process.argv[i - 1] === "--date");
const yearArg = process.argv.find((a, i) => process.argv[i - 1] === "--year");

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

if (useLocal) {
  // --local 指定時は Turso 環境変数を一時的に解除（getDb() が local sqlite を使うように）
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
}

if (!useLocal && (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN)) {
  console.error("[fetch-pportal] ERROR: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN が未設定。--local を指定するか環境変数を設定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);

// 新パイプライン経由: collect (fetch+parse) → process (format+upsert)
const { collectPPortalRaw } = await import("../lib/nyusatsu-result-fetcher.js");
const { processPPortalResults } = await import("../lib/agents/pipeline/nyusatsu.js");

console.log(`[fetch-pportal] Start: mode=${modeArg} dryRun=${dryRun}`);
const t0 = Date.now();

const collected = await collectPPortalRaw({
  mode: modeArg,
  date: dateArg || undefined,
  year: yearArg ? parseInt(yearArg) : undefined,
});
const stats = processPPortalResults(collected.rawRecords, {
  sourceUrl: collected.url,
  dryRun,
});
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

console.log("\n========================================");
console.log(`[fetch-pportal] Done (${elapsed}s)`);
console.log(`  file:      ${collected.filename}`);
console.log(`  total:     ${collected.rawRecords.length}`);
console.log(`  formatted: ${stats.formatted}`);
console.log(`  inserted:  ${stats.inserted}`);
console.log(`  updated:   ${stats.updated}`);
console.log(`  skipped:   ${stats.skipped}`);
console.log("========================================");

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    "## 調達ポータル 落札実績取得結果",
    "",
    "| 項目 | 値 |",
    "|------|----|",
    `| ファイル | ${collected.filename} |`,
    `| 総行数 | ${collected.rawRecords.length} |`,
    `| 整形 | ${stats.formatted} |`,
    `| 新規追加 | ${stats.inserted} |`,
    `| 更新 | ${stats.updated} |`,
    `| スキップ | ${stats.skipped} |`,
    `| 所要時間 | ${elapsed}s |`,
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}

process.exit(0);
