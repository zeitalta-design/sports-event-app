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
};

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
