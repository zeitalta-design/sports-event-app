#!/usr/bin/env node
/**
 * 入札情報を取得する CLI（農水省・経産省・総務省・厚労省・国交省）。
 *
 * 旧 ingest-nyusatsu.mjs の Python / better-sqlite3 依存を排除し、
 * Turso対応化＋情報源を3→5省に拡充。
 *
 * 環境変数:
 *   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
 *
 * オプション:
 *   --dry-run   DB書き込みをスキップ
 *
 * 実行:
 *   npm run fetch:nyusatsu
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

const dryRun = process.argv.includes("--dry-run");

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error("[fetch-nyusatsu] ERROR: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN が未設定");
  process.exit(1);
}

console.log(`[fetch-nyusatsu] Start: dryRun=${dryRun}`);
const start = Date.now();

const { fetchAndUpsertNyusatsu } = await import("../lib/nyusatsu-fetcher.js");
const result = await fetchAndUpsertNyusatsu({ dryRun });

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log("\n========================================");
console.log(`[fetch-nyusatsu] Done (${elapsed}s)`);
console.log(`  totalFetched: ${result.totalFetched}`);
console.log(`  inserted:     ${result.inserted}`);
console.log(`  updated:      ${result.updated}`);
console.log(`  skipped:      ${result.skipped}`);
console.log("\n--- ソース別 ---");
for (const s of result.perSource) {
  if (s.error) {
    console.log(`  ! ${s.name} (${s.label}): ${s.error}`);
  } else {
    console.log(`  ${s.name} (${s.label}): ${s.fetched}件`);
  }
}
console.log("========================================");

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    "## 入札情報取得結果",
    "",
    "| 項目 | 値 |",
    "|------|----|",
    `| 取得件数 | ${result.totalFetched} |`,
    `| 新規追加 | ${result.inserted} |`,
    `| 更新 | ${result.updated} |`,
    `| スキップ | ${result.skipped} |`,
    `| 所要時間 | ${elapsed}s |`,
    "",
    "### ソース別",
    "",
    "| ソース | 省庁 | 件数 | エラー |",
    "|--------|------|------|--------|",
    ...result.perSource.map((s) =>
      `| ${s.name} | ${s.label} | ${s.fetched || 0} | ${s.error || "-"} |`
    ),
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}

// 全ソース失敗時のみfailure
const allFailed = result.perSource.every((s) => s.error || s.fetched === 0);
process.exit(allFailed ? 1 : 0);
