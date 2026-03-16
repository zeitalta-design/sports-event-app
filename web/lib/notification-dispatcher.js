/**
 * 通知ディスパッチャ
 *
 * pending 状態の event_notifications を取得し、
 * チャンネルに応じて送信処理を実行する。
 *
 * 現時点では in_app チャンネル（既存 notifications テーブルへの挿入）を実装。
 * 将来的に email / push に拡張可能な構造。
 */

import { getDb } from "@/lib/db";

// ─── 単件ディスパッチ ──────────────────────────────

/**
 * 1件の通知を送信する
 *
 * @param {object} notification - event_notifications レコード
 * @returns {{ success: boolean, status: string, error?: string }}
 */
export function dispatchEventNotification(notification) {
  try {
    switch (notification.channel) {
      case "in_app":
        return dispatchInApp(notification);
      case "email":
        return dispatchEmail(notification);
      default:
        return dispatchInApp(notification);
    }
  } catch (err) {
    return {
      success: false,
      status: "failed",
      error: err.message?.slice(0, 300) || "unknown error",
    };
  }
}

/**
 * アプリ内通知として送信（既存 notifications テーブルに挿入）
 */
function dispatchInApp(notification) {
  const db = getDb();

  // ユーザーの有効性チェック
  const user = db
    .prepare("SELECT id, is_active FROM users WHERE id = CAST(? AS INTEGER)")
    .get(notification.user_key);

  if (!user || !user.is_active) {
    return { success: false, status: "skipped", error: "user_inactive" };
  }

  // 既存 notifications テーブルに挿入（重複は INSERT OR IGNORE）
  const payload = notification.payload_json || "{}";
  let payloadObj;
  try {
    payloadObj = JSON.parse(payload);
  } catch {
    payloadObj = {};
  }

  // リンクURL生成（大会詳細ページへ）
  const linkUrl = notification.event_id
    ? `/marathon/${notification.event_id}`
    : null;

  // 既存 notifications テーブルへ挿入
  try {
    db.prepare(
      `INSERT OR IGNORE INTO notifications
       (user_key, type, title, body, payload_json, event_id, link_url, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`
    ).run(
      notification.user_key,
      notification.notification_type,
      notification.title,
      notification.message,
      payload,
      notification.event_id,
      linkUrl
    );
  } catch {
    // 重複等は無視
  }

  return { success: true, status: "sent" };
}

/**
 * メール送信（将来実装用のスタブ）
 * 現時点では in_app にフォールバック
 */
function dispatchEmail(notification) {
  // 将来: email_jobs テーブルに挿入 → メール送信バッチで処理
  // 現時点では in_app と同じ処理
  return dispatchInApp(notification);
}

// ─── バッチディスパッチ ─────────────────────────────

/**
 * pending 状態の通知をバッチ送信する
 *
 * @param {object} [options]
 * @param {number} [options.limit=100] - 最大送信件数
 * @param {string} [options.channel] - チャンネル絞り込み（省略で全チャンネル）
 * @returns {object} 送信結果サマリー
 */
export function dispatchPendingEventNotifications({ limit = 100, channel } = {}) {
  const db = getDb();
  const now = new Date().toISOString();

  // pending 通知を取得
  let query = `SELECT * FROM event_notifications WHERE status = 'pending'`;
  const params = [];
  if (channel) {
    query += " AND channel = ?";
    params.push(channel);
  }
  query += " ORDER BY created_at ASC LIMIT ?";
  params.push(limit);

  const pending = db.prepare(query).all(...params);

  const results = {
    total: pending.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  const updateStmt = db.prepare(
    `UPDATE event_notifications SET status = ?, sent_at = ?, error_message = ? WHERE id = ?`
  );

  for (const notification of pending) {
    try {
      const dispatchResult = dispatchEventNotification(notification);

      updateStmt.run(
        dispatchResult.status,
        dispatchResult.status === "sent" ? now : null,
        dispatchResult.error || null,
        notification.id
      );

      if (dispatchResult.status === "sent") {
        results.sent++;
      } else if (dispatchResult.status === "skipped") {
        results.skipped++;
      } else {
        results.failed++;
        results.errors.push({
          id: notification.id,
          eventId: notification.event_id,
          error: dispatchResult.error,
        });
      }
    } catch (err) {
      results.failed++;
      updateStmt.run("failed", null, err.message?.slice(0, 300), notification.id);
      results.errors.push({
        id: notification.id,
        eventId: notification.event_id,
        error: err.message,
      });
    }
  }

  // バッチ統計を更新
  updateBatchStats(db);

  return results;
}

/**
 * バッチの送信統計を再集計して更新する
 */
function updateBatchStats(db) {
  try {
    db.prepare(
      `UPDATE event_notification_batches SET
        total_sent = (SELECT COUNT(*) FROM event_notifications WHERE batch_id = event_notification_batches.id AND status = 'sent'),
        total_failed = (SELECT COUNT(*) FROM event_notifications WHERE batch_id = event_notification_batches.id AND status = 'failed'),
        total_skipped = (SELECT COUNT(*) FROM event_notifications WHERE batch_id = event_notification_batches.id AND status = 'skipped')
       WHERE id IN (
         SELECT DISTINCT batch_id FROM event_notifications WHERE status IN ('sent', 'failed', 'skipped') AND batch_id IS NOT NULL
       )`
    ).run();
  } catch {
    // 統計更新失敗は無視
  }
}

/**
 * 送信結果サマリーを構築する
 */
export function buildNotificationDispatchSummary(results) {
  return {
    message: `送信完了: ${results.sent}件成功, ${results.failed}件失敗, ${results.skipped}件スキップ (計${results.total}件)`,
    ...results,
  };
}
