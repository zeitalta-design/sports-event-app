/**
 * Bridge Resolver: organizations ↔ resolved_entities
 *
 * 役割:
 *   organizations と resolved_entities は別系統で育ってきた2つの企業識別
 *   レイヤ。両者を壊さずに繋ぐための明示 link を entity_links へ書き込む。
 *
 * ポリシー（Phase 2 Step B）:
 *   - 初期ルールは corporate_number 完全一致のみ
 *   - confidence = 1.0, link_type = "corporate_number", source = "bridge_resolver"
 *   - fuzzy / LLM 一致は禁止（deterministic のみ）
 *   - UNIQUE(organization_id, resolved_entity_id) で二重登録回避
 *
 * 再実行しても冪等（UPSERT）。
 */

/**
 * @param {import("better-sqlite3").Database|any} db
 * @param {Object} [opts]
 * @param {boolean} [opts.dryRun=false]
 * @param {Function}[opts.logger]
 * @returns {{
 *   ok: boolean, candidates: number, created: number, updated: number,
 *   skipped: number, dryRun: boolean, elapsedMs: number
 * }}
 */
export function buildCorporateNumberBridge(db, { dryRun = false, logger = console.log } = {}) {
  if (!db) throw new TypeError("buildCorporateNumberBridge: db is required");
  const log = (msg) => logger(`[bridge-resolver] ${msg}`);
  const start = Date.now();

  // corporate_number が両側に存在する行をペアリング
  const candidates = db.prepare(`
    SELECT o.id AS organization_id, r.id AS resolved_entity_id,
           o.corporate_number AS corp_number
    FROM organizations o
    INNER JOIN resolved_entities r ON r.corporate_number = o.corporate_number
    WHERE o.corporate_number IS NOT NULL AND o.corporate_number != ''
  `).all();

  log(`候補ペア: ${candidates.length}件（organizations ⋈ resolved_entities on corporate_number）`);

  if (dryRun) {
    return {
      ok: true,
      candidates: candidates.length,
      created: 0, updated: 0, skipped: 0,
      dryRun: true,
      elapsedMs: Date.now() - start,
    };
  }

  const upsert = db.prepare(`
    INSERT INTO entity_links
      (organization_id, resolved_entity_id, link_type, confidence, source, created_at, updated_at)
    VALUES (@organization_id, @resolved_entity_id, 'corporate_number', 1.0, 'bridge_resolver',
            datetime('now'), datetime('now'))
    ON CONFLICT(organization_id, resolved_entity_id) DO UPDATE SET
      link_type = excluded.link_type,
      confidence = excluded.confidence,
      source = excluded.source,
      updated_at = datetime('now')
  `);

  const selectExisting = db.prepare(`
    SELECT id FROM entity_links
    WHERE organization_id = ? AND resolved_entity_id = ?
  `);

  let created = 0, updated = 0, skipped = 0;
  for (const c of candidates) {
    try {
      const existing = selectExisting.get(c.organization_id, c.resolved_entity_id);
      upsert.run({
        organization_id: c.organization_id,
        resolved_entity_id: c.resolved_entity_id,
      });
      existing ? updated++ : created++;
    } catch (e) {
      log(`  ! org=${c.organization_id} resolved=${c.resolved_entity_id}: ${e.message}`);
      skipped++;
    }
  }

  const elapsedMs = Date.now() - start;
  log(`done created=${created} updated=${updated} skipped=${skipped} (${elapsedMs}ms)`);

  return {
    ok: true,
    candidates: candidates.length,
    created, updated, skipped,
    dryRun: false,
    elapsedMs,
  };
}

export default buildCorporateNumberBridge;
