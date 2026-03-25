/**
 * 監査ログモジュール
 * admin_audit_logs テーブルへの構造化ログ記録
 * 認証イベント・管理操作を追跡
 */

import { getDb } from "./db";

/**
 * 監査ログを記録
 * @param {object} params
 * @param {number|null} params.userId - ユーザーID（未ログイン時null）
 * @param {string} params.action - アクション種別
 * @param {string} [params.targetType] - 対象種別（user, session, etc.）
 * @param {string} [params.targetId] - 対象ID
 * @param {object} [params.details] - 詳細情報
 * @param {string} [params.ipAddress] - IPアドレス
 * @param {string} [params.userAgent] - User-Agent
 */
export function writeAuditLog({
  userId = null,
  action,
  targetType = null,
  targetId = null,
  details = null,
  ipAddress = null,
  userAgent = null,
}) {
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO admin_audit_logs (user_id, action, target_type, target_id, details_json, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      action,
      targetType,
      targetId,
      details
        ? JSON.stringify({
            ...details,
            ...(userAgent ? { user_agent: userAgent } : {}),
          })
        : userAgent
          ? JSON.stringify({ user_agent: userAgent })
          : null,
      ipAddress
    );
  } catch (err) {
    // 監査ログの失敗でメイン処理を止めない
    console.error("[audit-log] write failed:", err.message);
  }
}

// --- アクション定数 ---
export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: "login_success",
  LOGIN_FAILED: "login_failed",
  LOGOUT: "logout",
  PASSWORD_CHANGED: "password_changed",
  ADMIN_CREATED: "admin_created",
  SESSION_EXPIRED: "session_expired",
  SESSION_CLEANUP: "session_cleanup",
  ACCOUNT_LOCKED: "account_locked",
  ACCOUNT_UNLOCKED: "account_unlocked",
  PASSWORD_RESET_REQUESTED: "password_reset_requested",
  PASSWORD_RESET_COMPLETED: "password_reset_completed",
  // admin CRUD
  ADMIN_ITEM_CREATED: "admin_item_created",
  ADMIN_ITEM_UPDATED: "admin_item_updated",
};

/**
 * 監査ログ一覧取得（admin 閲覧用）
 * @param {object} opts
 * @param {string} [opts.action] - action フィルタ
 * @param {string} [opts.q] - keyword 検索（target_id, details_json）
 * @param {number} [opts.page=1]
 * @param {number} [opts.pageSize=50]
 * @returns {{ logs: object[], total: number, totalPages: number }}
 */
export function listAuditLogs({ action = "", q = "", page = 1, pageSize = 50 } = {}) {
  const db = getDb();
  const where = [];
  const params = {};

  if (action) {
    where.push("action = @action");
    params.action = action;
  }
  if (q) {
    where.push("(target_id LIKE @q OR target_type LIKE @q OR details_json LIKE @q)");
    params.q = `%${q}%`;
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) as c FROM admin_audit_logs ${whereClause}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (Math.max(1, page) - 1) * pageSize;

  const rows = db.prepare(`
    SELECT * FROM admin_audit_logs ${whereClause}
    ORDER BY created_at DESC, id DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: pageSize, offset });

  const logs = rows.map((row) => {
    let details = null;
    try { details = row.details_json ? JSON.parse(row.details_json) : null; } catch {}
    return { ...row, details };
  });

  return { logs, total, totalPages };
}

/**
 * リクエストからIPとUser-Agentを抽出
 * @param {Request} request - Next.js Requestオブジェクト
 * @returns {{ ipAddress: string|null, userAgent: string|null }}
 */
export function extractRequestInfo(request) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent") || null;
  return { ipAddress, userAgent };
}
