#!/usr/bin/env node
/**
 * PDF型都道府県（宅建業）の行政処分を取得する CLI。
 *
 * Vercel Hobby の10秒タイムアウトと pdf-parse の互換性問題により、
 * PDF型の7県は Vercel 上で動かない。そのため GitHub Actions の
 * Ubuntu ランナーで定期実行する。
 *
 * 対象（全て宅建業、parseWithPdf使用）:
 *   富山 / 岐阜 / 静岡 / 奈良 / 徳島 / 香川 / 愛媛
 *
 * 環境変数:
 *   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN … Turso接続情報（GitHub Secrets）
 *
 * 実行:
 *   cd web && node --import ./scripts/prefecture-pdf-register.mjs scripts/fetch-prefecture-pdf.mjs
 *   または npm script: npm run fetch:pdf-prefectures
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

// @/ alias を解決する loader 登録（動的 import 前に必要）
register("./prefecture-pdf-loader.mjs", pathToFileURL(import.meta.filename).href);

// 必須環境変数チェック
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error("[fetch-prefecture-pdf] ERROR: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN が未設定");
  process.exit(1);
}

// PDF型都道府県 7県
const PDF_PREFECTURES = [
  "toyama_takken",
  "gifu_takken",
  "shizuoka_takken",
  "nara_takken",
  "tokushima_takken",
  "kagawa_takken",
  "ehime_takken",
];

const start = Date.now();
console.log(`[fetch-prefecture-pdf] Start: ${PDF_PREFECTURES.length} prefectures`);
console.log(`  targets: ${PDF_PREFECTURES.join(", ")}`);

const { runPrefectureFetch } = await import("../lib/prefecture-scraper.js");

const result = await runPrefectureFetch({
  prefectures: PDF_PREFECTURES,
  maxPrefectures: PDF_PREFECTURES.length,
  dryRun: false,
});

for (const line of result.log) console.log(line);

const totalItems = result.results.reduce((s, r) => s + (r.items || 0), 0);
const totalCreated = result.results.reduce((s, r) => s + (r.created || 0), 0);
const totalUpdated = result.results.reduce((s, r) => s + (r.updated || 0), 0);
const errors = result.results.filter((r) => r.status === "error");

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log("\n========================================");
console.log(`[fetch-prefecture-pdf] Done (${elapsed}s)`);
console.log(`  items parsed:  ${totalItems}`);
console.log(`  items created: ${totalCreated}`);
console.log(`  items updated: ${totalUpdated}`);
console.log(`  errors: ${errors.length}`);
if (errors.length > 0) {
  for (const e of errors) console.log(`    - ${e.prefecture}: ${e.error}`);
}
console.log("========================================");

// GITHUB_STEP_SUMMARY にも書き込む（CI時のみ）
if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = [
    "## PDF型都道府県 行政処分取得結果",
    "",
    "| 項目 | 値 |",
    "|------|----|",
    `| 対象県数 | ${PDF_PREFECTURES.length} |`,
    `| 抽出件数 | ${totalItems} |`,
    `| 新規作成 | ${totalCreated} |`,
    `| 更新 | ${totalUpdated} |`,
    `| エラー | ${errors.length} |`,
    `| 所要時間 | ${elapsed}s |`,
    "",
    "### 県別結果",
    "",
    "| 県 | ステータス | 件数 | 作成 | 更新 |",
    "|----|-----------|------|------|------|",
    ...result.results.map((r) =>
      `| ${r.prefecture} | ${r.status} | ${r.items || 0} | ${r.created || 0} | ${r.updated || 0} |`
    ),
  ].join("\n");
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
}

process.exit(errors.length === PDF_PREFECTURES.length ? 1 : 0);
