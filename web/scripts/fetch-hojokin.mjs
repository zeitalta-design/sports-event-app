#!/usr/bin/env node
/**
 * 補助金（J-Grants）を全15キーワードで取得する CLI。
 *
 * Vercel Hobby の10秒タイムアウトでは全キーワード処理が間に合わないため、
 * GitHub Actions の Ubuntu ランナーで定期実行する。
 *
 * 環境変数:
 *   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN … Turso接続情報（GitHub Secrets）
 *
 * 実行:
 *   npm run fetch:hojokin
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

// 開発時のため .env.local を読み込む（CI では GitHub Secrets が直接セットされる）
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, "utf8");
  for (const line of envContent.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error("[fetch-hojokin] ERROR: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN が未設定");
  process.exit(1);
}

const start = Date.now();
console.log("[fetch-hojokin] Start: J-Grants API 全キーワード取得");

const { fetchAndUpsertHojokin } = await import("../lib/hojokin-fetcher.js");

const result = await fetchAndUpsertHojokin({
  maxKeywords: 15,
  fetchTimeoutMs: 15000,
  delayMs: 500,
  dryRun: false,
});

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log("\n========================================");
console.log(`[fetch-hojokin] Done (${elapsed}s)`);
console.log(`  total fetched: ${result.totalFetched}`);
console.log(`  unique:        ${result.unique}`);
console.log(`  created:       ${result.created}`);
console.log(`  updated:       ${result.updated}`);
if (result.errors?.length > 0) {
  console.log(`  errors (${result.errors.length}):`);
  for (const e of result.errors) console.log(`    - ${e}`);
}
console.log("========================================");

if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = [
    "## 補助金（J-Grants）取得結果",
    "",
    "| 項目 | 値 |",
    "|------|----|",
    `| 取得件数（延べ） | ${result.totalFetched} |`,
    `| ユニーク件数 | ${result.unique} |`,
    `| 新規作成 | ${result.created} |`,
    `| 更新 | ${result.updated} |`,
    `| エラー | ${result.errors?.length || 0} |`,
    `| 所要時間 | ${elapsed}s |`,
  ].join("\n");
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
}

// 全キーワードでエラーが出た場合のみ失敗扱い
const allFailed = result.errors && result.errors.length >= 15;
process.exit(allFailed ? 1 : 0);
