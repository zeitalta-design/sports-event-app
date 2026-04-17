#!/usr/bin/env node
/**
 * kyoninka_entities.corporate_number を起点に resolved_entities を育てる（P1）
 *
 * 候補:
 *   kyoninka_entities WHERE corporate_number IS NOT NULL
 *   representative name = entity_name
 *
 * 使い方:
 *   node scripts/backfill-resolved-entities-from-kyoninka.mjs [--local] [--dry-run]
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
  console.error("[kyoninka-resolved-backfill] TURSO env 未設定。--local を指定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");
const { backfillResolvedEntitiesFromCandidates } =
  await import("../lib/agents/resolver/backfill.js");

const db = getDb();

const candidates = db.prepare(`
  SELECT corporate_number AS corp,
         MIN(entity_name)  AS name
  FROM kyoninka_entities
  WHERE corporate_number IS NOT NULL AND corporate_number != ''
    AND entity_name IS NOT NULL AND entity_name != ''
    AND is_published = 1
  GROUP BY corporate_number
`).all();

const r = backfillResolvedEntitiesFromCandidates(db, {
  candidates,
  source: "kyoninka_backfill",
  dryRun,
});

console.log("\n========================================");
console.log(`[kyoninka-resolved-backfill] Done (${r.elapsedMs}ms)`);
console.log(`  candidates:     ${r.candidates}`);
console.log(`  already:        ${r.alreadyExisted}`);
console.log(`  inserted:       ${r.inserted}`);
console.log(`  skipped:        ${r.skipped}`);
console.log(`  alias inserted: ${r.aliasInserted}`);
console.log(`  alias skipped:  ${r.aliasSkipped}`);
console.log("========================================");

process.exit(0);
