/**
 * 汎用審査ワークフロー DB関数
 * 全カテゴリ共通で使用
 */

import { getDb } from "@/lib/db";

const VALID_STATUSES = ["pending", "approved", "rejected"];

/**
 * 個別の審査ステータスを更新
 */
export function updateReviewStatus(tableName, id, status) {
  const db = getDb();
  const item = db.prepare(`SELECT id, review_status FROM ${tableName} WHERE id = ?`).get(id);
  if (!item) return { ok: false, error: "not_found" };
  if (!VALID_STATUSES.includes(status)) return { ok: false, error: "invalid_status" };

  const isPublished = status === "approved" ? 1 : 0;
  db.prepare(
    `UPDATE ${tableName} SET review_status = ?, is_published = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(status, isPublished, id);

  return { ok: true, previousStatus: item.review_status, newStatus: status };
}

/**
 * 一括審査ステータス更新
 */
export function bulkUpdateReviewStatus(tableName, ids, status) {
  if (!ids || ids.length === 0) return { ok: false, error: "no_ids" };
  if (!VALID_STATUSES.includes(status)) return { ok: false, error: "invalid_status" };

  const db = getDb();
  const isPublished = status === "approved" ? 1 : 0;
  const placeholders = ids.map(() => "?").join(",");

  const result = db.prepare(
    `UPDATE ${tableName} SET review_status = ?, is_published = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`
  ).run(status, isPublished, ...ids);

  return { ok: true, updated: result.changes, status };
}

/**
 * 審査ステータス別の件数を取得
 */
export function getReviewStatusCounts(tableName) {
  const db = getDb();
  const rows = db.prepare(
    `SELECT review_status, COUNT(*) as count FROM ${tableName} GROUP BY review_status`
  ).all();

  const counts = { pending: 0, approved: 0, rejected: 0, total: 0 };
  for (const row of rows) {
    const key = row.review_status || "approved";
    if (counts[key] !== undefined) counts[key] = row.count;
    counts.total += row.count;
  }
  return counts;
}
