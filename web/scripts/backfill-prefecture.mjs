#!/usr/bin/env node
/**
 * administrative_actions.prefecture を推定してバックフィル
 *
 * ソース別に推定ロジック:
 * - 消費者庁: authority_name に「東京都（都道府県）」等の形式が入るケースあり
 * - 公正取引委員会: summary/organization_name_raw に「熊本県」「佐賀県」等
 * - 個人情報保護委員会: organization_name_raw や summary に都道府県名
 * - MLIT 運送: summary に住所（「法人番号XXX / 大阪府大阪市...」）
 * - 金融庁: 基本的に本社所在地情報なし → null のまま（全国系機関が多い）
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

const dryRun = !process.argv.includes("--confirm");
const { getDb } = await import("../lib/db.js");
const db = getDb();

console.log(`[backfill-prefecture] mode: ${dryRun ? "DRY-RUN" : "UPDATE"}`);

const rows = db.prepare(`
  SELECT id, organization_name_raw, source_name, summary, authority_name, city
  FROM administrative_actions
  WHERE prefecture IS NULL OR prefecture = ''
`).all();
console.log(`都道府県不明レコード: ${rows.length}件`);

const PREFS = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県",
  "沖縄県",
];

function inferPrefecture(row) {
  // 1. authority_name から（例: 「東京都（都道府県）」「消費者庁」）
  if (row.authority_name) {
    const a = row.authority_name;
    for (const p of PREFS) {
      if (a.startsWith(p)) return p;
    }
  }
  // 2. organization_name_raw + summary の中から都道府県名を検出
  const text = `${row.organization_name_raw || ""} ${row.summary || ""} ${row.city || ""}`;
  for (const p of PREFS) {
    if (text.includes(p)) return p;
  }
  return null;
}

const updateStmt = db.prepare(
  "UPDATE administrative_actions SET prefecture = ?, updated_at = datetime('now') WHERE id = ?"
);

let updated = 0;
let skipped = 0;
const bySource = {};
const byPref = {};

for (const row of rows) {
  const pref = inferPrefecture(row);
  if (!pref) { skipped++; continue; }
  bySource[row.source_name] = (bySource[row.source_name] || 0) + 1;
  byPref[pref] = (byPref[pref] || 0) + 1;
  if (!dryRun) {
    try {
      updateStmt.run(pref, row.id);
      updated++;
    } catch { /* ignore */ }
  } else {
    updated++;
  }
}

console.log(`\n推定成功: ${updated}件 / スキップ: ${skipped}件`);
console.log("\n--- ソース別 推定成功数 ---");
for (const [k, v] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`);
}
console.log("\n--- 推定された都道府県（上位20）---");
for (const [k, v] of Object.entries(byPref).sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  console.log(`  ${k}: ${v}`);
}

if (dryRun) console.log("\n※ --confirm で実適用");
