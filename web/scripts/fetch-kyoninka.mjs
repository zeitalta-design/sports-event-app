#!/usr/bin/env node
/**
 * 許認可（kyoninka）を gBizINFO API で取得する CLI。
 *
 * 行政処分を受けた企業を起点として、gBizINFO の certification エンドポイント
 * から許認可情報を取得し kyoninka_entities / kyoninka_registrations に upsert。
 *
 * 環境変数:
 *   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN … Turso接続
 *   GBIZINFO_API_TOKEN … gBizINFO APIトークン（必須、https://info.gbiz.go.jp/hojin/APIManual で申請）
 *
 * オプション:
 *   --limit=N      1回に処理する企業数（デフォルト50）
 *   --all          corporate_number 解決済みも含めて再取得
 *   --dry-run      DB書き込みをスキップ
 *   --preview      対象候補のみリスト表示（APIトークン不要）
 *
 * 実行:
 *   npm run fetch:kyoninka -- --limit=20
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

// 開発時のため .env.local を読み込む
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

// 引数パース
const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 50;
const sourceArg = args.find((a) => a.startsWith("--source="));
const source = sourceArg ? sourceArg.split("=")[1] : "actions"; // actions | sanpai | all
const onlyMissing = !args.includes("--all");
const dryRun = args.includes("--dry-run");
const preview = args.includes("--preview");

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error("[fetch-kyoninka] ERROR: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN が未設定");
  process.exit(1);
}

// --preview モードはトークン不要
if (!preview && !process.env.GBIZINFO_API_TOKEN) {
  console.error("[fetch-kyoninka] ERROR: GBIZINFO_API_TOKEN が未設定");
  console.error("  → https://info.gbiz.go.jp/hojin/APIManual から申請してください");
  console.error("  → トークン未取得時は --preview で対象候補のみ確認できます");
  process.exit(1);
}

const start = Date.now();

if (preview) {
  console.log(`[fetch-kyoninka] Preview mode: 対象候補の列挙のみ（source=${source}）`);
  const { previewTargets } = await import("../lib/kyoninka-fetcher.js");
  const rows = previewTargets({ limit, onlyMissing, source });
  console.log(`\n=== 対象候補 ${rows.length} 件 ===`);
  for (const r of rows) {
    const status = r.corporate_number ? `✓ ${r.corporate_number}` : "? 未解決";
    const tag = r.source_tag ? `[${r.source_tag}]` : "";
    console.log(`  ${status} ${tag} | ${r.name_raw} | ${r.prefecture || "-"} | ${r.industry || "-"}`);
  }
  process.exit(0);
}

console.log(`[fetch-kyoninka] Start: limit=${limit} source=${source} onlyMissing=${onlyMissing} dryRun=${dryRun}`);

const { fetchAndUpsertKyoninka } = await import("../lib/kyoninka-fetcher.js");

const result = await fetchAndUpsertKyoninka({
  limit,
  onlyMissing,
  dryRun,
  source,
});

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log("\n========================================");
console.log(`[fetch-kyoninka] Done (${elapsed}s)`);
console.log(`  processed:    ${result.processed}`);
console.log(`  resolved:     ${result.resolved} (gBizINFO名前検索)`);
console.log(`  certFetched:  ${result.certFetched}`);
console.log(`  entity 新規:  ${result.entityCreated || 0} (法人マスター)`);
console.log(`  entity 更新:  ${result.entityUpdated || 0}`);
console.log(`  reg 新規:     ${result.created} (許認可1件1件)`);
console.log(`  reg 更新:     ${result.updated}`);
if (result.errors.length > 0) {
  console.log(`  errors (${result.errors.length}):`);
  for (const e of result.errors.slice(0, 5)) console.log(`    - ${e}`);
  if (result.errors.length > 5) console.log(`    ... and ${result.errors.length - 5} more`);
}
console.log("========================================");

if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = [
    "## 許認可（gBizINFO）取得結果",
    "",
    "| 項目 | 値 |",
    "|------|----|",
    `| 処理件数 | ${result.processed} |`,
    `| 法人番号解決 | ${result.resolved} |`,
    `| certification 取得 | ${result.certFetched} |`,
    `| 法人マスター 新規 | ${result.entityCreated || 0} |`,
    `| 法人マスター 更新 | ${result.entityUpdated || 0} |`,
    `| 許認可レコード 新規 | ${result.created} |`,
    `| 許認可レコード 更新 | ${result.updated} |`,
    `| エラー | ${result.errors.length} |`,
    `| 所要時間 | ${elapsed}s |`,
  ].join("\n");
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
}

process.exit(0);
