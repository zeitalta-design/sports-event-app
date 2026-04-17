#!/usr/bin/env node
/**
 * entity_links 接続状況レポート CLI
 *
 * 出力項目:
 *   - 接続済み件数（entity_links 行数）
 *   - 両側の母数（organizations / resolved_entities 総数と corp 保有数）
 *   - 未接続件数（corp あり未 link）
 *   - 多重接続候補（1 org に複数 resolved、または 1 resolved に複数 org）
 *
 * 使い方:
 *   node scripts/report-entity-links.mjs [--local]
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
  console.error("[report-entity-links] TURSO env 未設定。--local を指定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");

const db = getDb();
const q = (sql, ...args) => db.prepare(sql).get(...args);
const qAll = (sql, ...args) => db.prepare(sql).all(...args);

// ── 1. 母数 ──────────────────────
const orgs = q(`
  SELECT COUNT(*) total,
         SUM(CASE WHEN corporate_number IS NOT NULL AND corporate_number != '' THEN 1 ELSE 0 END) with_corp
  FROM organizations
`);
const resolved = q(`
  SELECT COUNT(*) total,
         SUM(CASE WHEN corporate_number IS NOT NULL AND corporate_number != '' THEN 1 ELSE 0 END) with_corp
  FROM resolved_entities
`);
const linksTotal = q(`SELECT COUNT(*) n FROM entity_links`).n;

// ── 2. 接続率 ──────────────────────
const linkedOrgs = q(`
  SELECT COUNT(DISTINCT organization_id) n FROM entity_links
`).n;
const linkedResolved = q(`
  SELECT COUNT(DISTINCT resolved_entity_id) n FROM entity_links
`).n;

const unlinkedOrgsWithCorp = q(`
  SELECT COUNT(*) n FROM organizations o
  WHERE o.corporate_number IS NOT NULL AND o.corporate_number != ''
    AND NOT EXISTS (SELECT 1 FROM entity_links l WHERE l.organization_id = o.id)
`).n;
const unlinkedResolvedWithCorp = q(`
  SELECT COUNT(*) n FROM resolved_entities r
  WHERE r.corporate_number IS NOT NULL AND r.corporate_number != ''
    AND NOT EXISTS (SELECT 1 FROM entity_links l WHERE l.resolved_entity_id = r.id)
`).n;

// ── 3. 多重接続（1:N または N:1） ──────────────────────
const multiFromOrg = qAll(`
  SELECT organization_id, COUNT(*) n
  FROM entity_links
  GROUP BY organization_id
  HAVING COUNT(*) > 1
  ORDER BY n DESC
  LIMIT 20
`);
const multiFromResolved = qAll(`
  SELECT resolved_entity_id, COUNT(*) n
  FROM entity_links
  GROUP BY resolved_entity_id
  HAVING COUNT(*) > 1
  ORDER BY n DESC
  LIMIT 20
`);

// ── 4. 出力 ──────────────────────
const pct = (num, den) => (den > 0 ? ((num / den) * 100).toFixed(1) + "%" : "—");

console.log("========================================");
console.log("entity_links 接続状況レポート");
console.log("========================================");
console.log(`DB: ${useLocal ? "local SQLite" : "Turso"}`);
console.log("");
console.log("【母数】");
console.log(`  organizations     : ${orgs.total} (うち corp あり ${orgs.with_corp})`);
console.log(`  resolved_entities : ${resolved.total} (うち corp あり ${resolved.with_corp})`);
console.log(`  entity_links      : ${linksTotal}`);
console.log("");
console.log("【接続率（corp 保有行に対する）】");
console.log(`  organizations 側  : ${linkedOrgs} / ${orgs.with_corp} = ${pct(linkedOrgs, orgs.with_corp)}`);
console.log(`  resolved 側       : ${linkedResolved} / ${resolved.with_corp} = ${pct(linkedResolved, resolved.with_corp)}`);
console.log("");
console.log("【未接続（corp あり & link なし）】");
console.log(`  organizations     : ${unlinkedOrgsWithCorp}件`);
console.log(`  resolved_entities : ${unlinkedResolvedWithCorp}件`);
console.log("");
console.log("【多重接続候補】");
console.log(`  1 org → 複数 resolved : ${multiFromOrg.length}件`);
if (multiFromOrg.length > 0) {
  for (const r of multiFromOrg.slice(0, 5)) {
    console.log(`    - organization_id=${r.organization_id}: ${r.n} resolved`);
  }
}
console.log(`  1 resolved → 複数 org : ${multiFromResolved.length}件`);
if (multiFromResolved.length > 0) {
  for (const r of multiFromResolved.slice(0, 5)) {
    console.log(`    - resolved_entity_id=${r.resolved_entity_id}: ${r.n} org`);
  }
}
console.log("========================================");

process.exit(0);
