#!/usr/bin/env node
/**
 * nyusatsu_results.winner_corporate_number を起点に resolved_entities を育てる（Phase 2 P2）
 *
 * 目的:
 *   Resolver（nyusatsu ランキング等）が resolved_entities に依存しているが、
 *   現状 resolved_entities は Layer 1/2 解決済の一部しか登録されていない。
 *   落札実績に現れた法人番号を全部 resolved_entities に登録し、以後のどの
 *   nyusatsu_result からもランキング等で entity 単位の集計ができる状態にする。
 *
 * ポリシー（deterministic only）:
 *   - 新規のみ insert（既存 resolved_entity は触らない）
 *   - corporate_number 完全一致のみで衝突判定
 *   - canonical_name = winner_name（最新 award_date の1件）
 *   - normalized_key = normalizeCompanyKey(winner_name)
 *   - source = "nyusatsu_backfill"
 *   - resolution_aliases も最小作成（entity_id + raw_name + normalized）
 *
 * 使い方:
 *   node scripts/backfill-resolved-entities-from-nyusatsu.mjs [--local] [--dry-run] [--limit N]
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

const useLocal = hasFlag("local");
const dryRun = hasFlag("dry-run") || hasFlag("dryrun");
const limit = argVal("limit") ? parseInt(argVal("limit"), 10) : null;
const BATCH_SIZE = parseInt(argVal("batch") || "100", 10);

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
  console.error("[backfill-resolved] TURSO env 未設定。--local を指定してください。");
  process.exit(1);
}

register("./_alias-loader.mjs", pathToFileURL(import.meta.filename).href);
const { getDb } = await import("../lib/db.js");
const { normalizeCompanyKey } = await import("../lib/agents/resolver/normalize.js");

const db = getDb();
const start = Date.now();
const SOURCE = "nyusatsu_backfill";

console.log(`[backfill-resolved] Start: local=${useLocal} dryRun=${dryRun} limit=${limit ?? "—"} batch=${BATCH_SIZE}`);

// 1) nyusatsu_results から winner_corporate_number 単位に畳む
const candidates = db.prepare(`
  SELECT winner_corporate_number AS corp,
         MIN(winner_name)         AS name
  FROM nyusatsu_results
  WHERE winner_corporate_number IS NOT NULL
    AND winner_corporate_number != ''
    AND winner_name IS NOT NULL
    AND winner_name != ''
    AND is_published = 1
  GROUP BY winner_corporate_number
`).all();
console.log(`[backfill-resolved] 候補法人番号: ${candidates.length}件`);

// 2) resolved_entities 側の既存 corp を取得
const existing = new Set(
  db.prepare("SELECT corporate_number FROM resolved_entities WHERE corporate_number IS NOT NULL AND corporate_number != ''")
    .all()
    .map((r) => r.corporate_number),
);
console.log(`[backfill-resolved] resolved_entities 既存 corp: ${existing.size}件`);

const toInsert = candidates.filter((c) => !existing.has(c.corp));
console.log(`[backfill-resolved] 未登録 corp: ${toInsert.length}件`);
const targets = limit ? toInsert.slice(0, limit) : toInsert;

if (dryRun) {
  console.log("[backfill-resolved] dry-run: 書込みスキップ");
  for (const c of targets.slice(0, 5)) {
    console.log(`   - ${c.corp}: ${c.name} → key=${normalizeCompanyKey(c.name)}`);
  }
  process.exit(0);
}

// 3) resolved_entities へ batch insert
function runResolvedBatch(rows) {
  if (rows.length === 0) return { inserted: 0, skipped: 0 };
  const placeholders = rows.map(() => "(?, ?, ?, ?, datetime('now'), datetime('now'))").join(", ");
  const sql = `
    INSERT INTO resolved_entities (corporate_number, canonical_name, normalized_key, source, created_at, updated_at)
    VALUES ${placeholders}
  `;
  const params = [];
  for (const r of rows) {
    const key = normalizeCompanyKey(r.name) || r.name;
    params.push(r.corp, r.name, key, SOURCE);
  }
  try {
    db.prepare(sql).run(...params);
    return { inserted: rows.length, skipped: 0 };
  } catch {
    // 失敗時は1行ずつリトライ
    let inserted = 0, skipped = 0;
    const one = db.prepare(`
      INSERT INTO resolved_entities (corporate_number, canonical_name, normalized_key, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    for (const r of rows) {
      try {
        const key = normalizeCompanyKey(r.name) || r.name;
        one.run(r.corp, r.name, key, SOURCE);
        inserted++;
      } catch {
        skipped++;
      }
    }
    return { inserted, skipped };
  }
}

let inserted = 0, skipped = 0;
for (let i = 0; i < targets.length; i += BATCH_SIZE) {
  const batch = targets.slice(i, i + BATCH_SIZE);
  const r = runResolvedBatch(batch);
  inserted += r.inserted;
  skipped += r.skipped;
  if ((i + BATCH_SIZE) % (BATCH_SIZE * 10) === 0 || i + BATCH_SIZE >= targets.length) {
    const pct = ((i + batch.length) / targets.length * 100).toFixed(1);
    console.log(`  [${i + batch.length}/${targets.length}] inserted=${inserted} skipped=${skipped} (${pct}%)`);
  }
}

// 4) resolution_aliases を最小作成（1 corp → 1 raw_name）
console.log("\n[backfill-resolved] aliases 作成...");
const newlyInserted = db.prepare(`
  SELECT id, corporate_number, canonical_name, normalized_key
  FROM resolved_entities
  WHERE source = ?
`).all(SOURCE);
console.log(`  対象 entity: ${newlyInserted.length}件`);

// 既存 alias をまとめて取得し、重複を避ける
const existingAliases = new Set(
  db.prepare("SELECT raw_name FROM resolution_aliases").all().map((r) => r.raw_name),
);

const aliasTargets = newlyInserted.filter(
  (e) => e.canonical_name && !existingAliases.has(e.canonical_name),
);
console.log(`  追加 alias: ${aliasTargets.length}件`);

function runAliasBatch(rows) {
  if (rows.length === 0) return { inserted: 0, skipped: 0 };
  const placeholders = rows
    .map(() => "(?, ?, ?, datetime('now'), datetime('now'), 1)")
    .join(", ");
  const sql = `
    INSERT INTO resolution_aliases (entity_id, raw_name, normalized, first_seen, last_seen, seen_count)
    VALUES ${placeholders}
  `;
  const params = [];
  for (const r of rows) {
    params.push(r.id, r.canonical_name, r.normalized_key || r.canonical_name);
  }
  try {
    db.prepare(sql).run(...params);
    return { inserted: rows.length, skipped: 0 };
  } catch {
    let inserted = 0, skipped = 0;
    const one = db.prepare(`
      INSERT INTO resolution_aliases (entity_id, raw_name, normalized, first_seen, last_seen, seen_count)
      VALUES (?, ?, ?, datetime('now'), datetime('now'), 1)
    `);
    for (const r of rows) {
      try {
        one.run(r.id, r.canonical_name, r.normalized_key || r.canonical_name);
        inserted++;
      } catch {
        skipped++;
      }
    }
    return { inserted, skipped };
  }
}

let aliasInserted = 0, aliasSkipped = 0;
for (let i = 0; i < aliasTargets.length; i += BATCH_SIZE) {
  const batch = aliasTargets.slice(i, i + BATCH_SIZE);
  const r = runAliasBatch(batch);
  aliasInserted += r.inserted;
  aliasSkipped += r.skipped;
  if ((i + BATCH_SIZE) % (BATCH_SIZE * 10) === 0 || i + BATCH_SIZE >= aliasTargets.length) {
    const pct = ((i + batch.length) / aliasTargets.length * 100).toFixed(1);
    console.log(`  [alias ${i + batch.length}/${aliasTargets.length}] inserted=${aliasInserted} skipped=${aliasSkipped} (${pct}%)`);
  }
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log("\n========================================");
console.log(`[backfill-resolved] Done (${elapsed}s)`);
console.log(`  entities inserted: ${inserted}`);
console.log(`  entities skipped:  ${skipped}`);
console.log(`  aliases  inserted: ${aliasInserted}`);
console.log(`  aliases  skipped:  ${aliasSkipped}`);
console.log(`  source:            ${SOURCE}`);
console.log("========================================");

process.exit(0);
