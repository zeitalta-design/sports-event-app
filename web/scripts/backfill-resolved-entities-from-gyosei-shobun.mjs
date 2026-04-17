#!/usr/bin/env node
/**
 * gyosei-shobun 由来企業を起点に resolved_entities を育てる（P2）
 *
 * 候補:
 *   administrative_actions は corporate_number を直接持たないが、
 *   organization_id 経由で organizations に紐付く。既に corp が埋まっている
 *   org のみ対象（gBizINFO 解決済）。
 *
 * 使い方:
 *   node scripts/backfill-resolved-entities-from-gyosei-shobun.mjs [--local] [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(`--${name}`);

const useLocal = hasFlag("local");
const dryRun = hasFlag("dry-run") || hasFlag("dryrun");

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
  console.error("[gyosei-shobun-resolved-backfill] TURSO env 未設定。--local を指定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");
const { backfillResolvedEntitiesFromCandidates } =
  await import("../lib/agents/resolver/backfill.js");

const db = getDb();

// 行政処分を受けた企業のうち、organizations 側に corp が登録されているもの
// （administrative_actions.organization_id → organizations.corporate_number）
const candidates = db.prepare(`
  SELECT DISTINCT o.corporate_number AS corp,
         COALESCE(o.display_name, o.normalized_name, a.organization_name_raw) AS name
  FROM administrative_actions a
  INNER JOIN organizations o ON o.id = a.organization_id
  WHERE o.corporate_number IS NOT NULL AND o.corporate_number != ''
    AND a.is_published = 1
`).all();

const r = backfillResolvedEntitiesFromCandidates(db, {
  candidates,
  source: "gyosei_shobun_backfill",
  dryRun,
});

console.log("\n========================================");
console.log(`[gyosei-shobun-resolved-backfill] Done (${r.elapsedMs}ms)`);
console.log(`  candidates:     ${r.candidates}`);
console.log(`  already:        ${r.alreadyExisted}`);
console.log(`  inserted:       ${r.inserted}`);
console.log(`  skipped:        ${r.skipped}`);
console.log(`  alias inserted: ${r.aliasInserted}`);
console.log(`  alias skipped:  ${r.aliasSkipped}`);
console.log("========================================");

process.exit(0);
