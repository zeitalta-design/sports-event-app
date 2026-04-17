#!/usr/bin/env node
/**
 * パイプライン デモ CLI（入札ドメイン・KKJ のみ）
 *
 * 目的: Collector→Formatter→DB 保存を「段階を分けて」走らせ、
 *       Step 2 の配線が機能することを実証する。
 *
 * 処理:
 *   1) KKJ API に GET（LG_Code × 単一日付）
 *   2) parseKkjXml で生レコード配列を得る
 *   3) processKkjRecords (pipeline) が format → DB upsert
 *
 * 使い方:
 *   node scripts/demo-pipeline-nyusatsu.mjs [--date YYYY-MM-DD] [--lg 13] [--local] [--dry-run]
 *
 *   --date   処分日（CFT_Issue_Date）。省略時は今日（JST）
 *   --lg     都道府県コード（JIS X0401, 01-47）。省略時は 13 (東京都)
 *   --local  ローカル sqlite へ書く
 *   --dry-run DB 書込みスキップ
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const argVal = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : null;
};
const hasFlag = (name) => argv.includes(`--${name}`);

const date = argVal("date") || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const lg = argVal("lg") || "13";
const useLocal = hasFlag("local");
const dryRun = hasFlag("dry-run");

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (useLocal) {
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
}
if (!useLocal && (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN)) {
  console.error("[demo-pipeline] TURSO 環境変数が未設定。--local 指定するか env を設定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);

const { parseKkjXml } = await import("../lib/nyusatsu-kkj-fetcher.js");
const { processKkjRecords } = await import("../lib/agents/pipeline/nyusatsu.js");

console.log(`[demo-pipeline] Start: date=${date} lg=${lg} local=${useLocal} dryRun=${dryRun}`);

// (1) Collector 相当: KKJ API を叩く
const url = `https://www.kkj.go.jp/api/?LG_Code=${lg}&CFT_Issue_Date=${encodeURIComponent(date)}&Count=1000`;
console.log(`[demo-pipeline] GET ${url}`);
const t0 = Date.now();
const res = await fetch(url, {
  headers: { "User-Agent": "Mozilla/5.0 (RiskMonitor demo-pipeline)" },
  signal: AbortSignal.timeout(30000),
});
if (!res.ok) { console.error(`[demo-pipeline] HTTP ${res.status}`); process.exit(1); }
const xml = await res.text();
console.log(`[demo-pipeline] fetched ${((Date.now() - t0) / 1000).toFixed(1)}s / ${(xml.length / 1024).toFixed(1)}KB`);

// (2) parse
const raw = parseKkjXml(xml);
console.log(`[demo-pipeline] parsed ${raw.length} records`);

// (3) pipeline: format → DB
const stats = processKkjRecords(raw, { dryRun });

console.log("\n========================================");
console.log(`[demo-pipeline] Done`);
console.log(`  date:      ${date}`);
console.log(`  lg:        ${lg}`);
console.log(`  fetched:   ${raw.length}`);
console.log(`  formatted: ${stats.formatted}`);
console.log(`  inserted:  ${stats.inserted}`);
console.log(`  updated:   ${stats.updated}`);
console.log(`  skipped:   ${stats.skipped}`);
console.log("========================================");
process.exit(0);
