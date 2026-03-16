/**
 * 受付状態変化の通知生成サービス
 *
 * 状態変化の検知から通知候補の生成までを担当する。
 * - batch レコード作成（変化イベント単位）
 * - 対象ユーザー抽出
 * - 個別通知レコード生成
 * - 重複防止（trigger_key ベース）
 */

import { getDb } from "@/lib/db";
import {
  detectNotificationChangeType,
  buildEventNotificationContent,
  buildNotificationTriggerKey,
  NOTIFICATION_TYPES,
} from "@/lib/event-notification-types";
import { getNotificationTargetsForEventChange } from "@/lib/event-notification-targets";

// ─── メイン: 状態変化から通知を生成 ─────────────────

/**
 * 大会の状態変化に基づいて通知候補を生成する
 *
 * @param {object} params
 * @param {object} params.event - events レコード { id, title, sport_type, prefecture, ... }
 * @param {object} params.beforeSnapshot - { status, urgencyLabel, urgencyLevel, signals }
 * @param {object} params.afterSnapshot  - { status, urgencyLabel, urgencyLevel, signals }
 * @param {string} [params.sourceType='monitor'] - 'monitor' | 'import' | 'manual'
 * @returns {object} { changeType, batchId, totalTargets, created, skipped, summary }
 */
export function queueNotificationsForEventChange({
  event,
  beforeSnapshot,
  afterSnapshot,
  sourceType = "monitor",
}) {
  const result = {
    changeType: null,
    batchId: null,
    totalTargets: 0,
    created: 0,
    skipped: 0,
    summary: null,
  };

  // 1. 変化種別を検出
  const changeType = detectNotificationChangeType(beforeSnapshot, afterSnapshot);
  if (!changeType) return result;
  result.changeType = changeType;

  const db = getDb();
  const now = new Date().toISOString();

  // 2. trigger_key 生成（batch 単位）
  const batchTriggerKey = buildNotificationTriggerKey({
    eventId: event.id,
    changeType,
    beforeStatus: beforeSnapshot.status,
    afterStatus: afterSnapshot.status,
    verifiedAt: now,
  });

  // 3. batch レコード作成（重複チェック）
  const batch = createNotificationBatch({
    db,
    sourceType,
    eventId: event.id,
    changeType,
    beforeStatus: beforeSnapshot.status,
    afterStatus: afterSnapshot.status,
    beforeUrgency: beforeSnapshot.urgencyLabel,
    afterUrgency: afterSnapshot.urgencyLabel,
    triggerKey: batchTriggerKey,
  });

  if (!batch) {
    // 同一 trigger_key が既存 → 重複スキップ
    result.skipped = 1;
    result.summary = "duplicate_batch";
    return result;
  }
  result.batchId = batch.id;

  // 4. 通知対象ユーザーを抽出
  const targets = getNotificationTargetsForEventChange(event, { changeType });
  result.totalTargets = targets.length;

  if (targets.length === 0) {
    // 対象なし → batch のみ記録
    result.summary = "no_targets";
    return result;
  }

  // 5. 個別通知レコードを生成
  const { created, skipped } = createNotificationsForTargets({
    db,
    batch,
    event,
    changeType,
    beforeStatus: beforeSnapshot.status,
    afterStatus: afterSnapshot.status,
    urgencyLabel: afterSnapshot.urgencyLabel,
    targets,
    triggerKey: batchTriggerKey,
  });

  result.created = created;
  result.skipped = skipped;

  // 6. batch の統計を更新
  db.prepare(
    "UPDATE event_notification_batches SET total_targets = ? WHERE id = ?"
  ).run(targets.length, batch.id);

  result.summary = "ok";
  return result;
}

// ─── batch レコード作成 ──────────────────────────────

/**
 * 通知バッチレコードを作成する
 * trigger_key の UNIQUE 制約で重複は自動防止
 *
 * @returns {object|null} 作成されたレコード、または null（重複時）
 */
function createNotificationBatch({
  db,
  sourceType,
  eventId,
  changeType,
  beforeStatus,
  afterStatus,
  beforeUrgency,
  afterUrgency,
  triggerKey,
}) {
  const typeDef = NOTIFICATION_TYPES[changeType];
  const summaryText = typeDef
    ? `${typeDef.label}: ${beforeStatus || "?"} → ${afterStatus || "?"}`
    : `${changeType}: ${beforeStatus || "?"} → ${afterStatus || "?"}`;

  try {
    const result = db
      .prepare(
        `INSERT INTO event_notification_batches
         (source_type, event_id, change_type, before_status, after_status,
          before_urgency, after_urgency, trigger_key, summary_text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        sourceType,
        eventId,
        changeType,
        beforeStatus || null,
        afterStatus || null,
        beforeUrgency || null,
        afterUrgency || null,
        triggerKey,
        summaryText
      );

    return { id: result.lastInsertRowid, triggerKey };
  } catch (err) {
    // UNIQUE constraint failed → 重複
    if (err.message?.includes("UNIQUE")) return null;
    throw err;
  }
}

// ─── 個別通知レコード生成 ───────────────────────────

/**
 * 対象ユーザーごとの通知レコードを生成する
 */
function createNotificationsForTargets({
  db,
  batch,
  event,
  changeType,
  beforeStatus,
  afterStatus,
  urgencyLabel,
  targets,
  triggerKey,
}) {
  let created = 0;
  let skipped = 0;

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO event_notifications
     (batch_id, event_id, user_key, notification_type, trigger_key,
      title, message, payload_json, status, channel)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  );

  const insertAll = db.transaction(() => {
    for (const target of targets) {
      const content = buildEventNotificationContent({
        event,
        changeType,
        beforeStatus,
        afterStatus,
        urgencyLabel,
        source: target.source,
      });

      const payload = JSON.stringify({
        event_id: event.id,
        event_title: event.title,
        change_type: changeType,
        before_status: beforeStatus,
        after_status: afterStatus,
        source: target.source,
        search_id: target.searchId || null,
        batch_id: batch.id,
      });

      // ユーザー単位の trigger_key（同一ユーザーへの重複防止）
      const userTriggerKey = `${triggerKey}:u:${target.userKey}`;

      const result = stmt.run(
        batch.id,
        event.id,
        target.userKey,
        changeType,
        userTriggerKey,
        content.title,
        content.message,
        payload,
        target.channel
      );

      if (result.changes > 0) {
        created++;
      } else {
        skipped++;
      }
    }
  });

  insertAll();
  return { created, skipped };
}

// ─── 照会用関数 ────────────────────────────────────

/**
 * pending 状態の通知を取得する
 */
export function getPendingEventNotifications({ limit = 100 } = {}) {
  const db = getDb();
  return db
    .prepare(
      `SELECT en.*, e.title as event_title
       FROM event_notifications en
       JOIN events e ON e.id = en.event_id
       WHERE en.status = 'pending'
       ORDER BY en.created_at ASC
       LIMIT ?`
    )
    .all(limit);
}

/**
 * 通知統計を取得する（管理画面用）
 */
export function getEventNotificationStats() {
  const db = getDb();

  const stats = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
        SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) as today_created,
        SUM(CASE WHEN status = 'sent' AND date(sent_at) = date('now') THEN 1 ELSE 0 END) as today_sent
       FROM event_notifications`
    )
    .get();

  const byType = db
    .prepare(
      `SELECT notification_type, status, COUNT(*) as cnt
       FROM event_notifications
       GROUP BY notification_type, status`
    )
    .all();

  return { ...stats, byType };
}

/**
 * 最近の通知一覧を取得する
 */
export function getRecentEventNotifications({ limit = 50, offset = 0 } = {}) {
  const db = getDb();
  return db
    .prepare(
      `SELECT en.*, e.title as event_title
       FROM event_notifications en
       JOIN events e ON e.id = en.event_id
       ORDER BY en.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset);
}

/**
 * 最近のバッチ一覧を取得する
 */
export function getRecentBatches({ limit = 30, offset = 0 } = {}) {
  const db = getDb();
  return db
    .prepare(
      `SELECT enb.*, e.title as event_title,
        (SELECT COUNT(*) FROM event_notifications en WHERE en.batch_id = enb.id) as notification_count,
        (SELECT COUNT(*) FROM event_notifications en WHERE en.batch_id = enb.id AND en.status = 'sent') as sent_count,
        (SELECT COUNT(*) FROM event_notifications en WHERE en.batch_id = enb.id AND en.status = 'failed') as failed_count
       FROM event_notification_batches enb
       JOIN events e ON e.id = enb.event_id
       ORDER BY enb.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset);
}

/**
 * 指定大会の通知を手動生成する（管理用）
 *
 * @param {object} params
 * @param {number} params.eventId
 * @param {string} params.changeType - 強制的に指定する変化種別
 * @param {boolean} [params.force=false] - true なら重複チェックをスキップ
 * @param {boolean} [params.dryRun=false] - true なら生成せずプレビューのみ
 * @returns {object}
 */
export function generateEventNotificationManual({
  eventId,
  changeType,
  force = false,
  dryRun = false,
}) {
  const db = getDb();

  const event = db
    .prepare("SELECT * FROM events WHERE id = ?")
    .get(eventId);
  if (!event) return { error: "event_not_found" };

  // 対象ユーザー抽出（プレビュー用）
  const targets = getNotificationTargetsForEventChange(event, { changeType });

  if (dryRun) {
    return {
      dryRun: true,
      eventId,
      eventTitle: event.title,
      changeType,
      totalTargets: targets.length,
      targets: targets.map((t) => ({
        userKey: t.userKey,
        source: t.source,
        channel: t.channel,
      })),
    };
  }

  // 強制再生成の場合、日付ベースのkeyにタイムスタンプを追加
  const verifiedAt = force
    ? new Date().toISOString()
    : event.last_verified_at || new Date().toISOString();

  const result = queueNotificationsForEventChange({
    event,
    beforeSnapshot: {
      status: changeType === "entry_opened" ? "upcoming" : "open",
      urgencyLabel: event.urgency_label,
    },
    afterSnapshot: {
      status: event.entry_status,
      urgencyLabel: event.urgency_label,
    },
    sourceType: "manual",
  });

  return {
    ...result,
    eventTitle: event.title,
  };
}
