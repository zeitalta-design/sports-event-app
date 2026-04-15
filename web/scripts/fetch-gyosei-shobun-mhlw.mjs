#!/usr/bin/env node
/**
 * 厚労省ブラック企業リスト（労働基準関係法令違反公表事案）取得 CLI
 *
 * 47都道府県労働局のページから PDF を取得・パースし、
 * administrative_actions に upsert する。
 *
 * オプション:
 *   --max=N      1回に処理する労働局数（デフォルト10、ローテーション）
 *   --dry-run
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

const args = process.argv.slice(2);
const maxArg = args.find((a) => a.startsWith("--max="));
const maxBureaus = maxArg ? parseInt(maxArg.split("=")[1], 10) : 10;
const dryRun = args.includes("--dry-run");

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error("[fetch-gyosei-shobun-mhlw] ERROR: TURSO env が未設定");
  process.exit(1);
}

console.log(`[fetch-gyosei-shobun-mhlw] Start: max=${maxBureaus} dryRun=${dryRun}`);
const start = Date.now();

const { fetchAndUpsertMhlwBlackList } = await import("../lib/gyosei-shobun-mhlw-fetcher.js");
const result = await fetchAndUpsertMhlwBlackList({ maxBureaus, dryRun });

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log("\n========================================");
console.log(`[fetch-gyosei-shobun-mhlw] Done (${elapsed}s)`);
console.log(`  totalEntries: ${result.totalEntries}`);
console.log(`  totalCreated: ${result.totalCreated}`);
console.log(`  totalUpdated: ${result.totalUpdated}`);
for (const b of result.perBureau) {
  if (b.error) {
    console.log(`  ! ${b.pref}: ${b.error}`);
  } else {
    console.log(`  ${b.pref}: entries=${b.entries} created=${b.created} updated=${b.updated}`);
  }
}
console.log("========================================");

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    "## 厚労省ブラック企業リスト 取得結果",
    "",
    "| 項目 | 値 |",
    "|------|----|",
    `| 抽出件数 | ${result.totalEntries} |`,
    `| 新規追加 | ${result.totalCreated} |`,
    `| 更新 | ${result.totalUpdated} |`,
    `| 所要時間 | ${elapsed}s |`,
    "",
    "### 労働局別",
    "",
    "| 労働局 | 抽出 | 新規 | 更新 | エラー |",
    "|--------|------|------|------|--------|",
    ...result.perBureau.map((b) =>
      `| ${b.pref} | ${b.entries || 0} | ${b.created || 0} | ${b.updated || 0} | ${b.error || "-"} |`
    ),
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}

process.exit(0);
