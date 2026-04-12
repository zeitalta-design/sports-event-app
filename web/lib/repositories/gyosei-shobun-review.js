/**
 * 行政処分DB — 審査ワークフロー DB関数
 */

import { getDb } from "@/lib/db";

/**
 * 個別の審査ステータスを更新
 */
export function updateReviewStatus(id, status, reviewedBy = "admin") {
  const db = getDb();
  const item = db.prepare("SELECT id, review_status FROM administrative_actions WHERE id = ?").get(id);
  if (!item) return { ok: false, error: "not_found" };

  const validStatuses = ["pending", "approved", "rejected"];
  if (!validStatuses.includes(status)) return { ok: false, error: "invalid_status" };

  // 承認時は自動公開、却下時は非公開
  const isPublished = status === "approved" ? 1 : 0;

  db.prepare(`
    UPDATE administrative_actions
    SET review_status = ?, is_published = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(status, isPublished, id);

  return { ok: true, previousStatus: item.review_status, newStatus: status };
}

/**
 * 一括審査ステータス更新
 */
export function bulkUpdateReviewStatus(ids, status, reviewedBy = "admin") {
  if (!ids || ids.length === 0) return { ok: false, error: "no_ids" };

  const validStatuses = ["pending", "approved", "rejected"];
  if (!validStatuses.includes(status)) return { ok: false, error: "invalid_status" };

  const db = getDb();
  const isPublished = status === "approved" ? 1 : 0;
  const placeholders = ids.map(() => "?").join(",");

  const result = db.prepare(`
    UPDATE administrative_actions
    SET review_status = ?, is_published = ?, updated_at = datetime('now')
    WHERE id IN (${placeholders})
  `).run(status, isPublished, ...ids);

  return { ok: true, updated: result.changes, status };
}

/**
 * 審査ステータス別の件数を取得
 */
export function getReviewStatusCounts() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT review_status, COUNT(*) as count
    FROM administrative_actions
    GROUP BY review_status
  `).all();

  const counts = { pending: 0, approved: 0, rejected: 0, total: 0 };
  for (const row of rows) {
    counts[row.review_status] = row.count;
    counts.total += row.count;
  }
  return counts;
}
