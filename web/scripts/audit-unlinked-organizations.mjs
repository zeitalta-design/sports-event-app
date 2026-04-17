#!/usr/bin/env node
/**
 * 未接続 organizations の棚卸し（Phase 2 P3）
 *
 * 目的:
 *   corporate_number を持ちながら entity_links で resolved_entities と
 *   繋がっていない organizations の残数とその理由を切り分ける。
 *
 * 切り分け軸:
 *   - source 別件数（どの backfill / fetcher 経由で入ったのか）
 *   - corporate_number の有無
 *   - resolved_entities 側に同一 corp が無い  → resolver 側未登録
 *   - organization_name_variants 経由の参照ドメイン（nyusatsu/kyoninka/hojokin...）
 *
 * 使い方:
 *   node scripts/audit-unlinked-organizations.mjs [--local]
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(`--${name}`);
const useLocal = hasFlag("local");

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
  console.error("[audit-unlinked] TURSO env 未設定。--local を指定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");

const db = getDb();
const q = (sql, ...args) => db.prepare(sql).get(...args);
const qAll = (sql, ...args) => db.prepare(sql).all(...args);

// 未接続: corp あり & entity_links 無し
const unlinked = qAll(`
  SELECT o.id, o.corporate_number, o.display_name, o.normalized_name, o.source,
         o.prefecture, o.city
  FROM organizations o
  WHERE o.corporate_number IS NOT NULL
    AND o.corporate_number != ''
    AND NOT EXISTS (SELECT 1 FROM entity_links l WHERE l.organization_id = o.id)
  ORDER BY o.id
`);

console.log("========================================");
console.log("未接続 organizations 棚卸し (Phase 2 P3)");
console.log("========================================");
console.log(`DB: ${useLocal ? "local SQLite" : "Turso"}`);
console.log(`未接続件数: ${unlinked.length}`);
console.log("");

if (unlinked.length === 0) {
  console.log("未接続 org はありません。");
  process.exit(0);
}

// ── 1. source 別集計 ──────────────────────
const bySource = {};
for (const o of unlinked) {
  const key = o.source || "(null)";
  bySource[key] = (bySource[key] || 0) + 1;
}
console.log("【source 別】");
for (const [src, n] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${src}: ${n}件`);
}
console.log("");

// ── 2. resolved_entities 側にも corp が無いか確認 ──────────────────────
// これが大きければ「resolver 側の backfill 漏れ」が原因
const corpList = unlinked.map((o) => o.corporate_number);
const resolvedCorps = new Set(
  qAll(
    `SELECT corporate_number FROM resolved_entities WHERE corporate_number IN (${corpList.map(() => "?").join(",")})`,
    ...corpList,
  ).map((r) => r.corporate_number),
);
const inResolver = unlinked.filter((o) => resolvedCorps.has(o.corporate_number));
const notInResolver = unlinked.filter((o) => !resolvedCorps.has(o.corporate_number));
console.log("【resolved_entities 側の存在】");
console.log(`  resolved に corp あり（bridge 実行すれば繋がる）: ${inResolver.length}件`);
console.log(`  resolved にも corp 無し（resolver 側未登録）   : ${notInResolver.length}件`);
console.log("");

// ── 3. organization_name_variants 経由のドメイン分布 ──────────────────
const variantDomains = {};
for (const o of unlinked) {
  const rows = qAll(
    "SELECT source_domain FROM organization_name_variants WHERE organization_id = ?",
    o.id,
  );
  if (rows.length === 0) {
    variantDomains["(no variant)"] = (variantDomains["(no variant)"] || 0) + 1;
  } else {
    for (const r of rows) {
      const d = r.source_domain || "(null)";
      variantDomains[d] = (variantDomains[d] || 0) + 1;
    }
  }
}
console.log("【参照ドメイン（organization_name_variants 経由）】");
for (const [d, n] of Object.entries(variantDomains).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${d}: ${n}件`);
}
console.log("");

// ── 4. 件数多い順で 10件サンプル ──────────────────────
console.log("【サンプル 10件】");
for (const o of unlinked.slice(0, 10)) {
  const where = resolvedCorps.has(o.corporate_number) ? "bridge 未実行" : "resolver 未登録";
  console.log(`  id=${o.id} corp=${o.corporate_number} source=${o.source || "-"} (${where})`);
  console.log(`    name=${o.display_name || o.normalized_name}`);
}
console.log("");

// ── 5. 次アクション候補 ──────────────────────
console.log("【推奨アクション】");
if (inResolver.length > 0) {
  console.log(`  1. build-entity-links.mjs を実行 → ${inResolver.length}件が即解消`);
}
if (notInResolver.length > 0) {
  console.log(`  2. ${notInResolver.length}件は resolved_entities に未登録。`);
  console.log(`     source を見て、kyoninka/hojokin 由来なら該当 fetcher で`);
  console.log(`     resolved_entities にも upsert するよう対応が必要。`);
}
console.log("========================================");

process.exit(0);
