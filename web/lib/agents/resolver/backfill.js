/**
 * resolved_entities + resolution_aliases を任意ドメインの (corp, name) 候補から
 * batch 投入するヘルパー（Phase 2 P3 共通化）。
 *
 * ドメイン別スクリプトが:
 *   1. SELECT で { corp, name } 候補を集める
 *   2. source 識別子を決める（例: "kyoninka_backfill"）
 *   3. このヘルパーに渡す
 * だけで済むように、冪等で deterministic な投入ロジックをここに閉じ込める。
 *
 * ポリシー:
 *   - corporate_number 完全一致でのみ重複判定。fuzzy / LLM は触らない。
 *   - 既存 resolved_entity がある corp は skip（updateはしない — 既存データを壊さない）
 *   - alias は canonical_name と同じ raw_name を1件登録（最小）
 *   - Turso 対応: multi-row VALUES の batch insert
 */
import { normalizeCompanyKey } from "./normalize.js";

/**
 * @typedef {Object} BackfillCandidate
 * @property {string} corp - 13 桁法人番号
 * @property {string} name - canonical_name に採用する事業者名
 */

/**
 * @param {object} db
 * @param {object} opts
 * @param {BackfillCandidate[]} opts.candidates
 * @param {string}              opts.source       - resolved_entities.source 値
 * @param {Function}            [opts.logger]
 * @param {number}              [opts.batchSize=100]
 * @param {boolean}             [opts.dryRun=false]
 * @returns {{
 *   candidates:       number,
 *   alreadyExisted:   number,
 *   inserted:         number,
 *   skipped:          number,
 *   aliasInserted:    number,
 *   aliasSkipped:     number,
 *   elapsedMs:        number,
 * }}
 */
export function backfillResolvedEntitiesFromCandidates(db, {
  candidates,
  source,
  logger = console.log,
  batchSize = 100,
  dryRun = false,
} = {}) {
  if (!db) throw new TypeError("backfillResolvedEntitiesFromCandidates: db is required");
  if (!Array.isArray(candidates)) throw new TypeError("candidates must be an array");
  if (!source || typeof source !== "string") throw new TypeError("source is required");
  const log = (msg) => logger(`[resolver-backfill:${source}] ${msg}`);
  const start = Date.now();

  // 1) 既存 corp を一括取得して差分のみを insert 対象に
  const existing = new Set(
    db.prepare(
      "SELECT corporate_number FROM resolved_entities WHERE corporate_number IS NOT NULL AND corporate_number != ''"
    ).all().map((r) => r.corporate_number),
  );
  const toInsert = candidates.filter((c) => c?.corp && c?.name && !existing.has(c.corp));
  log(`candidates=${candidates.length} already=${existing.size} toInsert=${toInsert.length}`);

  if (dryRun || toInsert.length === 0) {
    return {
      candidates: candidates.length,
      alreadyExisted: existing.size,
      inserted: 0, skipped: 0,
      aliasInserted: 0, aliasSkipped: 0,
      elapsedMs: Date.now() - start,
    };
  }

  // 2) resolved_entities へ batch insert
  const oneEntity = db.prepare(`
    INSERT INTO resolved_entities (corporate_number, canonical_name, normalized_key, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  function insertEntityBatch(batch) {
    const placeholders = batch.map(() => "(?, ?, ?, ?, datetime('now'), datetime('now'))").join(", ");
    const sql = `
      INSERT INTO resolved_entities (corporate_number, canonical_name, normalized_key, source, created_at, updated_at)
      VALUES ${placeholders}
    `;
    const params = [];
    for (const r of batch) {
      params.push(r.corp, r.name, normalizeCompanyKey(r.name) || r.name, source);
    }
    try {
      db.prepare(sql).run(...params);
      return { inserted: batch.length, skipped: 0 };
    } catch {
      let inserted = 0, skipped = 0;
      for (const r of batch) {
        try {
          oneEntity.run(r.corp, r.name, normalizeCompanyKey(r.name) || r.name, source);
          inserted++;
        } catch { skipped++; }
      }
      return { inserted, skipped };
    }
  }

  let inserted = 0, skipped = 0;
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    const r = insertEntityBatch(batch);
    inserted += r.inserted;
    skipped += r.skipped;
    if ((i + batchSize) % (batchSize * 10) === 0 || i + batchSize >= toInsert.length) {
      log(`  [${i + batch.length}/${toInsert.length}] inserted=${inserted} skipped=${skipped}`);
    }
  }

  // 3) alias を最小作成（entity_id が取れた新規分のみ）
  const newlyInserted = db.prepare(
    `SELECT id, corporate_number, canonical_name, normalized_key
     FROM resolved_entities WHERE source = ?`
  ).all(source);

  const existingAliases = new Set(
    db.prepare("SELECT raw_name FROM resolution_aliases").all().map((r) => r.raw_name),
  );
  const aliasTargets = newlyInserted.filter(
    (e) => e.canonical_name && !existingAliases.has(e.canonical_name),
  );

  const oneAlias = db.prepare(`
    INSERT INTO resolution_aliases (entity_id, raw_name, normalized, first_seen, last_seen, seen_count)
    VALUES (?, ?, ?, datetime('now'), datetime('now'), 1)
  `);
  function insertAliasBatch(batch) {
    const placeholders = batch.map(() => "(?, ?, ?, datetime('now'), datetime('now'), 1)").join(", ");
    const sql = `
      INSERT INTO resolution_aliases (entity_id, raw_name, normalized, first_seen, last_seen, seen_count)
      VALUES ${placeholders}
    `;
    const params = [];
    for (const r of batch) params.push(r.id, r.canonical_name, r.normalized_key || r.canonical_name);
    try {
      db.prepare(sql).run(...params);
      return { inserted: batch.length, skipped: 0 };
    } catch {
      let ins = 0, sk = 0;
      for (const r of batch) {
        try {
          oneAlias.run(r.id, r.canonical_name, r.normalized_key || r.canonical_name);
          ins++;
        } catch { sk++; }
      }
      return { inserted: ins, skipped: sk };
    }
  }

  let aliasInserted = 0, aliasSkipped = 0;
  for (let i = 0; i < aliasTargets.length; i += batchSize) {
    const batch = aliasTargets.slice(i, i + batchSize);
    const r = insertAliasBatch(batch);
    aliasInserted += r.inserted;
    aliasSkipped += r.skipped;
  }

  log(`done entities: inserted=${inserted} skipped=${skipped} / aliases: inserted=${aliasInserted} skipped=${aliasSkipped} (${Date.now() - start}ms)`);
  return {
    candidates: candidates.length,
    alreadyExisted: existing.size,
    inserted, skipped,
    aliasInserted, aliasSkipped,
    elapsedMs: Date.now() - start,
  };
}
