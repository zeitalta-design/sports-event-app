/**
 * 自動化共通基盤 — 公開判定
 *
 * ソースの信頼度、必須項目の充足、変化の種類に基づいて
 * auto_publish / review_required を判定する。
 */

import { getDb } from "@/lib/db";

/**
 * ドメインごとの必須項目定義
 */
const REQUIRED_FIELDS = {
  "food-recall": ["product_name", "slug"],
  "sanpai": ["company_name", "slug"],
  "kyoninka": ["entity_name", "slug"],
  "shitei": ["title", "slug"],
};

/**
 * 危険な変化（review 必須にする変化パターン）
 */
const RISKY_CHANGES = {
  "food-recall": ["risk_level", "status"],
  "sanpai": ["risk_level", "status"],
  "kyoninka": ["entity_status"],
  "shitei": ["recruitment_status"],
};

/**
 * 公開判定を実行
 * @param {Object} params
 * @param {string} params.domainId - ドメインID
 * @param {Object} params.item - 判定対象アイテム
 * @param {string} params.changeType - "created" | "updated"
 * @param {Array} params.fieldChanges - 変化したフィールドの配列
 * @param {Object|null} params.source - データソース情報
 * @returns {{ decision: string, reason: string, requiresReview: boolean }}
 */
export function makePublishDecision({ domainId, item, changeType, fieldChanges = [], source = null }) {
  // 1. 新規作成は常に review_required（保守的）
  if (changeType === "created") {
    return {
      decision: "review_required",
      reason: "新規作成のため確認が必要",
      requiresReview: true,
    };
  }

  // 2. ソースの publish_policy を確認
  if (source?.publish_policy === "auto_publish") {
    // 高信頼ソースでも危険な変化がある場合は review
    const riskyFields = RISKY_CHANGES[domainId] || [];
    const hasRiskyChange = fieldChanges.some((c) => riskyFields.includes(c.field || c));
    if (hasRiskyChange) {
      return {
        decision: "review_required",
        reason: "高影響フィールドの変化を検出",
        requiresReview: true,
      };
    }

    // 必須項目の充足チェック
    const requiredFields = REQUIRED_FIELDS[domainId] || [];
    const missingFields = requiredFields.filter((f) => !item[f]);
    if (missingFields.length > 0) {
      return {
        decision: "review_required",
        reason: `必須項目が不足: ${missingFields.join(", ")}`,
        requiresReview: true,
      };
    }

    return {
      decision: "auto_publish",
      reason: "高信頼ソース + 必須項目充足 + 安全な変化",
      requiresReview: false,
    };
  }

  // 3. それ以外は review_required
  return {
    decision: "review_required",
    reason: "ソースの公開ポリシーが manual または review_required",
    requiresReview: true,
  };
}

// ─── 通知 ─────────────────────

/**
 * 管理画面通知を作成
 */
export function createAdminNotification({
  domainId = null,
  notificationType = "info",
  title,
  message = null,
  relatedEntityType = null,
  relatedEntityId = null,
}) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO admin_notifications
      (domain_id, notification_type, title, message, related_entity_type, related_entity_id, created_at)
    VALUES
      (@domainId, @notificationType, @title, @message, @relatedEntityType, @relatedEntityId, datetime('now'))
  `).run({ domainId, notificationType, title, message, relatedEntityType, relatedEntityId });
  return { id: result.lastInsertRowid };
}

/**
 * 管理画面通知を一覧取得
 */
export function listAdminNotifications({ domainId = "", unreadOnly = false, limit = 50, page = 1 } = {}) {
  const db = getDb();
  const where = [];
  const params = {};
  if (domainId) { where.push("domain_id = @domainId"); params.domainId = domainId; }
  if (unreadOnly) { where.push("read_at IS NULL"); }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const pageSize = limit;
  const offset = (Math.max(1, page) - 1) * pageSize;

  const total = db.prepare(`SELECT COUNT(*) as c FROM admin_notifications ${whereClause}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;

  const items = db.prepare(`
    SELECT * FROM admin_notifications ${whereClause}
    ORDER BY id DESC LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: pageSize, offset });

  return { items, total, totalPages };
}

export function markNotificationRead(id) {
  const db = getDb();
  db.prepare("UPDATE admin_notifications SET read_at = datetime('now') WHERE id = ?").run(id);
}

export function getUnreadNotificationCount(domainId = "") {
  const db = getDb();
  if (domainId) {
    return db.prepare("SELECT COUNT(*) as c FROM admin_notifications WHERE read_at IS NULL AND domain_id = ?").get(domainId).c;
  }
  return db.prepare("SELECT COUNT(*) as c FROM admin_notifications WHERE read_at IS NULL").get().c;
}
