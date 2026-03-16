/**
 * 受付状態の履歴保存・取得
 *
 * import-url 実行時や将来の定期監視時に、
 * 受付状態のスナップショットを event_entry_history に記録する。
 *
 * 同じ日・同じステータス・同じソースの重複は抑制する。
 */

import { getDb } from "@/lib/db";
import { detectEntrySignals, inferCloseReason } from "@/lib/entry-status";

// ─── スナップショット記録 ─────────────────────────

/**
 * 受付状態のスナップショットを記録する
 *
 * @param {number} eventId - 大会ID
 * @param {object} snapshot
 * @param {string} snapshot.status - 観測された受付状態 (open/closed/upcoming/unknown等)
 * @param {string} [snapshot.sourceType] - ソース種別 (import/scrape/manual)
 * @param {string} [snapshot.sourceUrl] - 取得元URL
 * @param {string} [snapshot.entryOpenAt] - 申込開始日
 * @param {string} [snapshot.entryCloseAt] - 申込終了日
 * @param {string} [snapshot.eventDate] - 開催日
 * @param {string} [snapshot.pageText] - シグナル検出用テキスト
 * @param {string} [snapshot.note] - 備考
 * @returns {{ inserted: boolean, historyId: number|null, signals: Array, closeReason: string|null }}
 */
export function recordEntryStatusSnapshot(eventId, snapshot) {
  const db = getDb();
  const now = new Date().toISOString();
  const today = now.slice(0, 10); // YYYY-MM-DD

  const status = snapshot.status || "unknown";
  const sourceType = snapshot.sourceType || "import";

  // シグナル検出
  const { signals, isCapacityBased } = detectEntrySignals(snapshot.pageText || "");
  const signalsJson = signals.length > 0 ? JSON.stringify(signals.map((s) => s.label)) : null;

  // close_reason 推定
  let closeReason = null;
  if (status === "closed") {
    closeReason = inferCloseReason(signals);
    if (closeReason === "unknown" && isCapacityBased) {
      closeReason = "capacity_reached";
    }
  }

  // 重複チェック: 同じ event_id + 同日 + 同ステータス のレコードがあればスキップ
  const existing = db
    .prepare(
      `SELECT id FROM event_entry_history
       WHERE event_id = ? AND observed_status = ? AND date(observed_at) = ?`
    )
    .get(eventId, status, today);

  if (existing) {
    return { inserted: false, historyId: existing.id, signals, closeReason };
  }

  // 挿入
  const result = db
    .prepare(
      `INSERT INTO event_entry_history (
        event_id, source_type, source_url, observed_status,
        entry_open_at, entry_close_at, event_date,
        close_reason, is_capacity_based, detected_signals_json,
        first_detected_at, observed_at, note, created_at
      ) VALUES (
        @event_id, @source_type, @source_url, @observed_status,
        @entry_open_at, @entry_close_at, @event_date,
        @close_reason, @is_capacity_based, @detected_signals_json,
        @first_detected_at, @observed_at, @note, @created_at
      )`
    )
    .run({
      event_id: eventId,
      source_type: sourceType,
      source_url: snapshot.sourceUrl || null,
      observed_status: status,
      entry_open_at: snapshot.entryOpenAt || null,
      entry_close_at: snapshot.entryCloseAt || null,
      event_date: snapshot.eventDate || null,
      close_reason: closeReason,
      is_capacity_based: isCapacityBased ? 1 : 0,
      detected_signals_json: signalsJson,
      first_detected_at: now,
      observed_at: now,
      note: snapshot.note || null,
      created_at: now,
    });

  // events テーブルのシグナルキャッシュも更新
  if (signals.length > 0) {
    db.prepare(
      "UPDATE events SET entry_signals_json = ? WHERE id = ?"
    ).run(signalsJson, eventId);
  }

  return {
    inserted: true,
    historyId: Number(result.lastInsertRowid),
    signals,
    closeReason,
  };
}

// ─── 履歴サマリー取得 ────────────────────────────

/**
 * 大会の受付状態履歴サマリーを取得する
 *
 * @param {number} eventId
 * @returns {object} サマリー情報
 */
export function getEntryHistorySummary(eventId) {
  const db = getDb();

  // 全履歴を時系列で取得
  const history = db
    .prepare(
      `SELECT * FROM event_entry_history
       WHERE event_id = ?
       ORDER BY observed_at ASC`
    )
    .all(eventId);

  if (history.length === 0) {
    return {
      hasHistory: false,
      records: [],
      totalRecords: 0,
      firstObserved: null,
      lastObserved: null,
      closedRecord: null,
      daysOpenToClose: null,
      daysBeforeEventClosed: null,
      closeReason: null,
      isCapacityBased: false,
      allSignals: [],
      capacityCloseCount: 0,
    };
  }

  // 全シグナルを統合
  const allSignalsSet = new Set();
  for (const rec of history) {
    if (rec.detected_signals_json) {
      try {
        const signals = JSON.parse(rec.detected_signals_json);
        signals.forEach((s) => allSignalsSet.add(s));
      } catch {}
    }
  }

  // 締切レコードを探す
  const closedRecord = history.find((r) => r.observed_status === "closed") || null;
  const openRecord = history.find((r) => r.observed_status === "open") || null;

  // 募集開始から締切までの日数
  let daysOpenToClose = null;
  if (closedRecord) {
    const openDate = openRecord?.observed_at || closedRecord.entry_open_at;
    if (openDate) {
      const open = new Date(openDate);
      const close = new Date(closedRecord.observed_at);
      daysOpenToClose = Math.round((close - open) / (1000 * 60 * 60 * 24));
      if (daysOpenToClose < 0) daysOpenToClose = null;
    }
  }

  // 開催日何日前に締切になったか
  let daysBeforeEventClosed = null;
  if (closedRecord && closedRecord.event_date) {
    const eventDate = new Date(closedRecord.event_date);
    const closeDate = new Date(closedRecord.observed_at);
    daysBeforeEventClosed = Math.round((eventDate - closeDate) / (1000 * 60 * 60 * 24));
    if (daysBeforeEventClosed < 0) daysBeforeEventClosed = null;
  }

  // capacity_reached回数
  const capacityCloseCount = history.filter(
    (r) => r.close_reason === "capacity_reached"
  ).length;

  const isCapacityBased = history.some((r) => r.is_capacity_based === 1);

  return {
    hasHistory: true,
    records: history,
    totalRecords: history.length,
    firstObserved: history[0].observed_at,
    lastObserved: history[history.length - 1].observed_at,
    closedRecord,
    daysOpenToClose,
    daysBeforeEventClosed,
    closeReason: closedRecord?.close_reason || null,
    isCapacityBased,
    allSignals: [...allSignalsSet],
    capacityCloseCount,
  };
}

// ─── 管理用: 生履歴取得 ──────────────────────────

/**
 * 大会の生の履歴レコードを取得する（管理画面用）
 *
 * @param {number} eventId
 * @returns {Array} 履歴レコード配列
 */
export function getEntryHistoryRecords(eventId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM event_entry_history
       WHERE event_id = ?
       ORDER BY observed_at DESC`
    )
    .all(eventId);
}
