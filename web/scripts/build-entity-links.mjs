#!/usr/bin/env node
/**
 * entity_links 作成 CLI
 *
 * organizations と resolved_entities を corporate_number 一致で繋ぐ。
 *
 * 使い方:
 *   node scripts/build-entity-links.mjs [--local] [--dry-run]
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
  console.error("[build-entity-links] TURSO env 未設定。--local を指定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");
const { buildCorporateNumberBridge } = await import("../lib/agents/resolver/bridge.js");

const db = getDb();
console.log(`[build-entity-links] Start: local=${useLocal} dryRun=${dryRun}`);

const r = buildCorporateNumberBridge(db, { dryRun });

console.log("\n========================================");
console.log(`[build-entity-links] Done (${r.elapsedMs}ms)`);
console.log(`  candidates:  ${r.candidates}`);
console.log(`  created:     ${r.created}`);
console.log(`  updated:     ${r.updated}`);
console.log(`  skipped:     ${r.skipped}`);
console.log(`  dryRun:      ${r.dryRun}`);
console.log("========================================");

process.exit(0);
