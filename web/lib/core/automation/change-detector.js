/**
 * 自動化共通基盤 — 差分検知
 *
 * 既存データと新規データを比較し、変化をchange_logsに記録する。
 * ドメイン固有の比較ロジックは呼び出し元が trackedFields で指定する。
 */

import { getDb } from "@/lib/db";

/**
 * 2つのオブジェクトの指定フィールドを比較し、差分を返す
 * @param {Object} before - 既存データ
 * @param {Object} after - 新規データ
 * @param {string[]} trackedFields - 追跡するフィールド名の配列
 * @returns {Array<{field: string, before: any, after: any}>}
 */
export function detectFieldChanges(before, after, trackedFields) {
  const changes = [];
  for (const field of trackedFields) {
    const bVal = before[field] ?? null;
    const aVal = after[field] ?? null;
    const bStr = bVal === null ? "" : String(bVal);
    const aStr = aVal === null ? "" : String(aVal);
    if (bStr !== aStr) {
      changes.push({ field, before: bStr || null, after: aStr || null });
    }
  }
  return changes;
}

/**
 * 差分をchange_logsテーブルに記録する
 */
export function recordChanges({
  domainId,
  syncRunId = null,
  sourceId = null,
  entityType,
  entityId,
  entitySlug = null,
  changeType,
  changes = [],
  confidenceScore = 1.0,
  requiresReview = false,
}) {
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO change_logs
      (domain_id, sync_run_id, source_id, entity_type, entity_id, entity_slug,
       change_type, field_name, before_value, after_value,
       confidence_score, requires_review, created_at)
    VALUES
      (@domainId, @syncRunId, @sourceId, @entityType, @entityId, @entitySlug,
       @changeType, @fieldName, @beforeValue, @afterValue,
       @confidenceScore, @requiresReview, datetime('now'))
  `);

  if (changes.length === 0) {
    // 新規作成や削除など、フィールド差分がない場合は1件だけ記録
    insert.run({
      domainId, syncRunId, sourceId, entityType, entityId, entitySlug,
      changeType, fieldName: null, beforeValue: null, afterValue: null,
      confidenceScore, requiresReview: requiresReview ? 1 : 0,
    });
    return 1;
  }

  let count = 0;
  for (const change of changes) {
    insert.run({
      domainId, syncRunId, sourceId, entityType, entityId, entitySlug,
      changeType, fieldName: change.field,
      beforeValue: change.before, afterValue: change.after,
      confidenceScore, requiresReview: requiresReview ? 1 : 0,
    });
    count++;
  }
  return count;
}

/**
 * change_logs の一覧を取得
 */
export function listChangeLogs({
  domainId = "",
  syncRunId = null,
  changeType = "",
  requiresReview = null,
  limit = 50,
  page = 1,
} = {}) {
  const db = getDb();
  const where = [];
  const params = {};
  if (domainId) { where.push("domain_id = @domainId"); params.domainId = domainId; }
  if (syncRunId) { where.push("sync_run_id = @syncRunId"); params.syncRunId = syncRunId; }
  if (changeType) { where.push("change_type = @changeType"); params.changeType = changeType; }
  if (requiresReview !== null) { where.push("requires_review = @requiresReview"); params.requiresReview = requiresReview ? 1 : 0; }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const pageSize = limit;
  const offset = (Math.max(1, page) - 1) * pageSize;

  const total = db.prepare(`SELECT COUNT(*) as c FROM change_logs ${whereClause}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;

  const items = db.prepare(`
    SELECT * FROM change_logs ${whereClause}
    ORDER BY id DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: pageSize, offset });

  return { items, total, totalPages };
}

/**
 * review済みにマーク
 */
export function markAsReviewed(changeLogId, reviewedBy = "admin") {
  const db = getDb();
  db.prepare(`
    UPDATE change_logs SET reviewed_at = datetime('now'), reviewed_by = @reviewedBy
    WHERE id = @id
  `).run({ id: changeLogId, reviewedBy });
}

/**
 * review待ち件数を取得
 */
export function getReviewPendingCount(domainId = "") {
  const db = getDb();
  if (domainId) {
    return db.prepare(
      "SELECT COUNT(*) as c FROM change_logs WHERE requires_review = 1 AND reviewed_at IS NULL AND domain_id = ?"
    ).get(domainId).c;
  }
  return db.prepare(
    "SELECT COUNT(*) as c FROM change_logs WHERE requires_review = 1 AND reviewed_at IS NULL"
  ).get().c;
}
