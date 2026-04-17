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
 * @param {number}  [opts.batchSize=100]
 * @returns {{
 *   ok: boolean, candidates: number, created: number, updated: number,
 *   skipped: number, dryRun: boolean, elapsedMs: number
 * }}
 */
export function buildCorporateNumberBridge(db, { dryRun = false, logger = console.log, batchSize = 100 } = {}) {
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

  // 既存 link を一括取得し client-side diff（Turso で 22k 個別 SELECT を避ける）
  const existingLinks = new Set(
    db.prepare("SELECT organization_id, resolved_entity_id FROM entity_links").all()
      .map((r) => `${r.organization_id}:${r.resolved_entity_id}`),
  );
  const toInsert = candidates.filter((c) => !existingLinks.has(`${c.organization_id}:${c.resolved_entity_id}`));
  log(`既存 link: ${existingLinks.size}件  /  新規 insert 対象: ${toInsert.length}件`);

  // multi-row VALUES で batch insert。衝突したバッチは1行ずつ UPSERT にフォールバック。
  const oneUpsert = db.prepare(`
    INSERT INTO entity_links
      (organization_id, resolved_entity_id, link_type, confidence, source, created_at, updated_at)
    VALUES (?, ?, 'corporate_number', 1.0, 'bridge_resolver', datetime('now'), datetime('now'))
    ON CONFLICT(organization_id, resolved_entity_id) DO UPDATE SET
      updated_at = datetime('now')
  `);

  function insertBatch(batch) {
    if (batch.length === 0) return { inserted: 0, skipped: 0 };
    const placeholders = batch
      .map(() => "(?, ?, 'corporate_number', 1.0, 'bridge_resolver', datetime('now'), datetime('now'))")
      .join(", ");
    const sql = `
      INSERT INTO entity_links
        (organization_id, resolved_entity_id, link_type, confidence, source, created_at, updated_at)
      VALUES ${placeholders}
    `;
    const params = [];
    for (const c of batch) params.push(c.organization_id, c.resolved_entity_id);
    try {
      db.prepare(sql).run(...params);
      return { inserted: batch.length, skipped: 0 };
    } catch {
      let inserted = 0, skipped = 0;
      for (const c of batch) {
        try { oneUpsert.run(c.organization_id, c.resolved_entity_id); inserted++; }
        catch { skipped++; }
      }
      return { inserted, skipped };
    }
  }

  let created = 0, skipped = 0;
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    const r = insertBatch(batch);
    created += r.inserted;
    skipped += r.skipped;
    if ((i + batchSize) % (batchSize * 10) === 0 || i + batchSize >= toInsert.length) {
      const pct = ((i + batch.length) / Math.max(1, toInsert.length) * 100).toFixed(1);
      log(`  [${i + batch.length}/${toInsert.length}] created=${created} skipped=${skipped} (${pct}%)`);
    }
  }

  const elapsedMs = Date.now() - start;
  const updated = 0; // このパスでは UPSERT 分岐が失敗バッチ時のみのため 0 に丸める
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
