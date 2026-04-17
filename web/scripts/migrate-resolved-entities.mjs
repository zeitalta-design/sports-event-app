#!/usr/bin/env node
/**
 * Resolver 層用のテーブル作成
 *   - resolved_entities    正規化された企業 entity（1社1行）
 *   - resolution_aliases   表記ゆれ（生の会社名）の集約
 *   - resolution_scores    名寄せ判定のログ（監査用）
 *
 * 使い方:
 *   node scripts/migrate-resolved-entities.mjs [--local] [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const dryRun = process.argv.includes("--dry-run");
const useLocal = process.argv.includes("--local");

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS resolved_entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    corporate_number TEXT,
    canonical_name TEXT NOT NULL,
    normalized_key TEXT NOT NULL,
    prefecture TEXT,
    source TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_entities_corp_number
     ON resolved_entities(corporate_number)
     WHERE corporate_number IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_entities_normalized_key
     ON resolved_entities(normalized_key)`,
  `CREATE INDEX IF NOT EXISTS idx_entities_pref
     ON resolved_entities(prefecture)`,

  `CREATE TABLE IF NOT EXISTS resolution_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER NOT NULL,
    raw_name TEXT NOT NULL,
    normalized TEXT NOT NULL,
    first_seen TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen TEXT NOT NULL DEFAULT (datetime('now')),
    seen_count INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (entity_id) REFERENCES resolved_entities(id)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_aliases_raw
     ON resolution_aliases(raw_name)`,
  `CREATE INDEX IF NOT EXISTS idx_aliases_entity
     ON resolution_aliases(entity_id)`,
  `CREATE INDEX IF NOT EXISTS idx_aliases_normalized
     ON resolution_aliases(normalized)`,

  `CREATE TABLE IF NOT EXISTS resolution_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_name TEXT NOT NULL,
    query_corp_number TEXT,
    entity_id INTEGER,
    layer TEXT NOT NULL,
    score REAL,
    detail TEXT,
    resolved_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_scores_query ON resolution_scores(query_name)`,
  `CREATE INDEX IF NOT EXISTS idx_scores_entity ON resolution_scores(entity_id)`,
  `CREATE INDEX IF NOT EXISTS idx_scores_layer ON resolution_scores(layer)`,
];

async function runLocal() {
  const Database = (await import("better-sqlite3")).default;
  const dbPath = path.resolve(process.cwd(), "data/risk-monitor.db");
  const db = new Database(dbPath);
  console.log("[migrate-resolver] ローカル sqlite モード");
  for (const sql of MIGRATIONS) {
    if (dryRun) { console.log("[dry-run]", sql.slice(0, 60), "..."); continue; }
    db.exec(sql);
    console.log("[ok]", sql.slice(0, 60), "...");
  }
  const counts = {
    entities: db.prepare("SELECT COUNT(*) c FROM resolved_entities").get().c,
    aliases:  db.prepare("SELECT COUNT(*) c FROM resolution_aliases").get().c,
    scores:   db.prepare("SELECT COUNT(*) c FROM resolution_scores").get().c,
  };
  console.log(`[done] entities=${counts.entities} aliases=${counts.aliases} scores=${counts.scores}`);
  db.close();
}

async function runTurso() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error("[migrate-resolver] ERROR: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN が未設定。--local で実行してください。");
    process.exit(1);
  }
  register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
  const { getDb } = await import("../lib/db.js");
  const db = getDb();
  console.log("[migrate-resolver] Turso モード");
  for (const sql of MIGRATIONS) {
    if (dryRun) { console.log("[dry-run]", sql.slice(0, 60), "..."); continue; }
    db.exec(sql);
    console.log("[ok]", sql.slice(0, 60), "...");
  }
  console.log("[done]");
}

if (useLocal) await runLocal();
else await runTurso();
