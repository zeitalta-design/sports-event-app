/**
 * 自動化共通基盤 — 同期ログ管理
 *
 * sync_runs テーブルへの書き込み・読み取りを提供。
 * 各ドメインの importer から呼び出される。
 */

import { getDb } from "@/lib/db";

/**
 * 同期実行を開始し、run_id を返す
 */
export function startSyncRun({ domainId, sourceId = null, runType = "manual" }) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO sync_runs (domain_id, source_id, run_type, run_status, started_at, created_at)
    VALUES (@domainId, @sourceId, @runType, 'running', datetime('now'), datetime('now'))
  `).run({ domainId, sourceId, runType });
  return result.lastInsertRowid;
}

/**
 * 同期実行を完了状態に更新
 */
export function finishSyncRun(runId, {
  runStatus = "completed",
  fetchedCount = 0,
  createdCount = 0,
  updatedCount = 0,
  unchangedCount = 0,
  reviewCount = 0,
  failedCount = 0,
  errorSummary = null,
} = {}) {
  const db = getDb();
  db.prepare(`
    UPDATE sync_runs SET
      run_status = @runStatus,
      fetched_count = @fetchedCount,
      created_count = @createdCount,
      updated_count = @updatedCount,
      unchanged_count = @unchangedCount,
      review_count = @reviewCount,
      failed_count = @failedCount,
      finished_at = datetime('now'),
      error_summary = @errorSummary
    WHERE id = @runId
  `).run({
    runId, runStatus, fetchedCount, createdCount, updatedCount,
    unchangedCount, reviewCount, failedCount, errorSummary,
  });

  // ソースの last_checked_at / last_success_at を更新
  const run = db.prepare("SELECT source_id FROM sync_runs WHERE id = ?").get(runId);
  if (run?.source_id) {
    db.prepare("UPDATE data_sources SET last_checked_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(run.source_id);
    if (runStatus === "completed") {
      db.prepare("UPDATE data_sources SET last_success_at = datetime('now') WHERE id = ?").run(run.source_id);
    }
  }
}

/**
 * 同期実行履歴を取得
 */
export function listSyncRuns({ domainId = "", limit = 50, page = 1 } = {}) {
  const db = getDb();
  const where = [];
  const params = {};
  if (domainId) { where.push("sr.domain_id = @domainId"); params.domainId = domainId; }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const pageSize = limit;
  const offset = (Math.max(1, page) - 1) * pageSize;

  const total = db.prepare(`SELECT COUNT(*) as c FROM sync_runs sr ${whereClause}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;

  const items = db.prepare(`
    SELECT sr.*, ds.source_name
    FROM sync_runs sr
    LEFT JOIN data_sources ds ON sr.source_id = ds.id
    ${whereClause}
    ORDER BY sr.id DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: pageSize, offset });

  return { items, total, totalPages };
}

export function getSyncRunById(id) {
  const db = getDb();
  return db.prepare(`
    SELECT sr.*, ds.source_name
    FROM sync_runs sr
    LEFT JOIN data_sources ds ON sr.source_id = ds.id
    WHERE sr.id = ?
  `).get(id) || null;
}

// ─── Data Sources ─────────────────────

export function listDataSources({ domainId = "" } = {}) {
  const db = getDb();
  if (domainId) {
    return db.prepare("SELECT * FROM data_sources WHERE domain_id = ? ORDER BY id").all(domainId);
  }
  return db.prepare("SELECT * FROM data_sources ORDER BY domain_id, id").all();
}

export function getDataSourceById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM data_sources WHERE id = ?").get(id) || null;
}

export function createDataSource(source) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO data_sources (domain_id, source_name, source_type, source_url, fetch_method, status, review_policy, publish_policy, run_frequency, notes, created_at, updated_at)
    VALUES (@domain_id, @source_name, @source_type, @source_url, @fetch_method, @status, @review_policy, @publish_policy, @run_frequency, @notes, datetime('now'), datetime('now'))
  `).run(source);
  return { id: result.lastInsertRowid };
}
