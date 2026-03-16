/**
 * ユーザー向け通知サービス
 *
 * ユーザーの通知一覧取得・既読管理・統計を提供する。
 * 既存の notifications テーブルに対する読み取り/更新操作をまとめる。
 */

import { getDb } from "@/lib/db";

// ─── 通知一覧取得 ──────────────────────────────

/**
 * ユーザーの通知一覧を取得する
 *
 * @param {object} params
 * @param {string} params.userKey
 * @param {object} [params.filters] - { type, category, unreadOnly }
 * @param {number} [params.page=1]
 * @param {number} [params.limit=30]
 * @returns {{ notifications, total, page, totalPages, limit }}
 */
export function getUserNotifications({
  userKey,
  filters = {},
  page = 1,
  limit = 30,
}) {
  const db = getDb();
  const offset = (page - 1) * limit;

  const where = ["(user_key = ? OR user_key = 'system')"];
  const params = [userKey];

  // タイプフィルター（単一タイプ or カテゴリ内複数タイプ）
  if (filters.types && filters.types.length > 0) {
    const placeholders = filters.types.map(() => "?").join(", ");
    where.push(`type IN (${placeholders})`);
    params.push(...filters.types);
  } else if (filters.type) {
    where.push("type = ?");
    params.push(filters.type);
  }

  // 未読のみ
  if (filters.unreadOnly) {
    where.push("is_read = 0");
  }

  const whereClause = `WHERE ${where.join(" AND ")}`;

  const countRow = db
    .prepare(`SELECT COUNT(*) as total FROM notifications ${whereClause}`)
    .get(...params);

  const queryParams = [...params, limit, offset];
  const notifications = db
    .prepare(
      `SELECT * FROM notifications ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...queryParams);

  return {
    notifications,
    total: countRow.total,
    page,
    totalPages: Math.ceil(countRow.total / limit),
    limit,
  };
}

// ─── 未読数取得 ─────────────────────────────────

/**
 * ユーザーの未読通知数を取得する
 */
export function getUnreadCount(userKey) {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT COUNT(*) as count FROM notifications WHERE is_read = 0 AND (user_key = ? OR user_key = 'system')"
    )
    .get(userKey);
  return row.count;
}

// ─── 既読管理 ──────────────────────────────────

/**
 * 通知を既読にする（read_at タイムスタンプ付き）
 */
export function markAsRead(notificationId, userKey) {
  const db = getDb();
  const notification = db
    .prepare("SELECT * FROM notifications WHERE id = ?")
    .get(notificationId);

  if (!notification) return { success: false, error: "not_found" };
  if (notification.user_key !== userKey && notification.user_key !== "system") {
    return { success: false, error: "forbidden" };
  }

  const now = new Date().toISOString();
  db.prepare(
    "UPDATE notifications SET is_read = 1, read_at = ? WHERE id = ?"
  ).run(now, notificationId);

  return { success: true, id: notificationId, is_read: 1, read_at: now };
}

/**
 * 通知を未読に戻す
 */
export function markAsUnread(notificationId, userKey) {
  const db = getDb();
  const notification = db
    .prepare("SELECT * FROM notifications WHERE id = ?")
    .get(notificationId);

  if (!notification) return { success: false, error: "not_found" };
  if (notification.user_key !== userKey && notification.user_key !== "system") {
    return { success: false, error: "forbidden" };
  }

  db.prepare(
    "UPDATE notifications SET is_read = 0, read_at = NULL WHERE id = ?"
  ).run(notificationId);

  return { success: true, id: notificationId, is_read: 0, read_at: null };
}

/**
 * すべての通知を既読にする
 */
export function markAllAsRead(userKey) {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .prepare(
      "UPDATE notifications SET is_read = 1, read_at = ? WHERE is_read = 0 AND (user_key = ? OR user_key = 'system')"
    )
    .run(now, userKey);

  return { success: true, updated: result.changes };
}

// ─── 統計 ───────────────────────────────────

/**
 * ユーザーの通知統計を取得する
 */
export function getNotificationStats(userKey) {
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT
         type,
         COUNT(*) as total,
         SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread
       FROM notifications
       WHERE user_key = ? OR user_key = 'system'
       GROUP BY type`
    )
    .all(userKey);

  const stats = {};
  let totalCount = 0;
  let totalUnread = 0;

  for (const row of rows) {
    stats[row.type] = { total: row.total, unread: row.unread };
    totalCount += row.total;
    totalUnread += row.unread;
  }

  return { byType: stats, total: totalCount, unread: totalUnread };
}

// ─── 最新通知プレビュー（ヘッダーベル用） ─────────

/**
 * ヘッダーのベルドロップダウン用に最新通知を数件取得する
 */
export function getRecentNotifications(userKey, limit = 5) {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM notifications
       WHERE user_key = ? OR user_key = 'system'
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(userKey, limit);
}
