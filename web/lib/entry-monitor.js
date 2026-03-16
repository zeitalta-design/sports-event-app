/**
 * 受付状態の定期監視ロジック
 *
 * 既存の runnet-fetcher / moshicom-fetcher を使い、
 * source_url からHTMLを再取得して受付状態・シグナルを再判定する。
 * LLM呼び出しは行わず、パーサー抽出のみで軽量に動作する。
 *
 * 結果は event_entry_history に記録し、
 * events テーブルの last_verified_at / urgency / signals を更新する。
 */

import { getDb } from "@/lib/db";
import * as cheerio from "cheerio";
import {
  isRunnetUrl,
  fetchRunnetHtml,
  extractEventInfo as extractRunnetInfo,
  extractPageText as extractRunnetPageText,
} from "@/lib/runnet-fetcher";
import {
  isMoshicomUrl,
  fetchMoshicomHtml,
  extractEventInfo as extractMoshicomInfo,
  extractPageText as extractMoshicomPageText,
} from "@/lib/moshicom-fetcher";
import { recordEntryStatusSnapshot } from "@/lib/entry-history";
import { getEntryHistorySummary } from "@/lib/entry-history";
import { getEntryUrgencyMeta } from "@/lib/entry-urgency";
import { queueNotificationsForEventChange } from "@/lib/event-notification-service";
import { getMonitorableSourceLinks } from "@/lib/event-sources";
import { verifyEventSources } from "@/lib/event-source-verifier";
import { determineOfficialEntryStatus, saveOfficialEntryStatus } from "@/lib/official-entry-status";
import { getMonitorTargetsWithPriority } from "@/lib/monitor-priority";

// ─── 監視対象抽出 ────────────────────────────────

/**
 * 監視対象の大会を優先度順に取得する
 * Phase80: 優先度エンジンを使用
 *
 * @param {object} [options]
 * @param {number} [options.limit=50] - 最大取得件数
 * @param {boolean} [options.includeEnded=false] - 開催終了も含めるか
 * @param {boolean} [options.usePriority=true] - Phase80 優先度エンジンを使うか
 * @returns {Array} 大会レコード配列
 */
export function getMonitorTargetEvents(options = {}) {
  const usePriority = options.usePriority !== false;

  if (usePriority) {
    try {
      const results = getMonitorTargetsWithPriority(options);
      return results.map(r => r.event);
    } catch {
      // フォールバック: 従来ロジック
    }
  }

  // フォールバック: 従来の優先度ロジック
  const db = getDb();
  const limit = options.limit || 50;

  const events = db
    .prepare(
      `SELECT id, title, source_url, source_site, entry_status,
              event_date, entry_start_date, entry_end_date,
              entry_signals_json, urgency_label, urgency_level,
              last_verified_at, monitor_error_count, description
       FROM events
       WHERE is_active = 1
         AND source_url IS NOT NULL
         AND source_url != ''
         ${options.includeEnded ? "" : "AND (event_date IS NULL OR event_date >= date('now', '-1 day'))"}
       ORDER BY
         CASE
           WHEN entry_status = 'open' THEN 0
           WHEN urgency_level = 'high' THEN 1
           WHEN urgency_level = 'medium' THEN 2
           WHEN entry_status = 'upcoming' THEN 3
           ELSE 4
         END,
         CASE WHEN last_verified_at IS NULL THEN 0 ELSE 1 END,
         last_verified_at ASC,
         event_date ASC
       LIMIT ?`
    )
    .all(limit);

  return events;
}

// ─── 単体監視処理 ────────────────────────────────

/**
 * 1件の大会の受付状態を再確認する
 *
 * @param {object} event - getMonitorTargetEvents() の1レコード
 * @returns {Promise<object>} 監視結果
 */
export async function checkSingleEventEntryStatus(event) {
  const db = getDb();
  const now = new Date().toISOString();
  const result = {
    eventId: event.id,
    title: event.title,
    success: false,
    previousStatus: event.entry_status,
    newStatus: null,
    statusChanged: false,
    signalsDetected: [],
    error: null,
  };

  try {
    const url = event.source_url;
    let html, $, eventInfo, pageText;

    // source別にHTML取得 + パース
    if (isRunnetUrl(url)) {
      html = await fetchRunnetHtml(url);
      $ = cheerio.load(html);
      eventInfo = extractRunnetInfo($, url);
      pageText = extractRunnetPageText($);
    } else if (isMoshicomUrl(url)) {
      html = await fetchMoshicomHtml(url);
      $ = cheerio.load(html);
      eventInfo = extractMoshicomInfo($, url);
      pageText = extractMoshicomPageText($);
    } else {
      // 未対応ソース → スキップ
      result.error = "unsupported_source";
      return result;
    }

    const newStatus = eventInfo.entry_status || "unknown";
    result.newStatus = newStatus;
    result.statusChanged = newStatus !== event.entry_status;

    // スナップショット記録
    const historyResult = recordEntryStatusSnapshot(event.id, {
      status: newStatus,
      sourceType: "monitor",
      sourceUrl: url,
      entryOpenAt: eventInfo.entry_start_date || event.entry_start_date || null,
      entryCloseAt: eventInfo.entry_end_date || event.entry_end_date || null,
      eventDate: eventInfo.event_date || event.event_date || null,
      pageText,
      note: "auto-monitor",
    });
    result.signalsDetected = historyResult.signals.map((s) => s.label);

    // events テーブル更新: last_verified_at + 状態変化時にステータス更新
    const updateFields = ["last_verified_at = ?", "monitor_error_count = 0", "monitor_last_error = NULL"];
    const updateValues = [now];

    if (result.statusChanged && newStatus !== "unknown") {
      updateFields.push("entry_status = ?");
      updateValues.push(newStatus);
    }

    // 申込期間の更新（パーサーが新しい値を持っている場合）
    if (eventInfo.entry_start_date && !event.entry_start_date) {
      updateFields.push("entry_start_date = ?");
      updateValues.push(eventInfo.entry_start_date);
    }
    if (eventInfo.entry_end_date && !event.entry_end_date) {
      updateFields.push("entry_end_date = ?");
      updateValues.push(eventInfo.entry_end_date);
    }

    updateValues.push(event.id);
    db.prepare(
      `UPDATE events SET ${updateFields.join(", ")} WHERE id = ?`
    ).run(...updateValues);

    // urgency 再計算
    let newUrgencyLabel = event.urgency_label;
    let newUrgencyLevel = event.urgency_level;
    try {
      const summary = getEntryHistorySummary(event.id);
      const updatedEvent = { ...event, entry_status: newStatus };
      const urgencyMeta = getEntryUrgencyMeta(updatedEvent, summary);
      if (urgencyMeta.urgencyLabel) {
        newUrgencyLabel = urgencyMeta.urgencyLabel;
        newUrgencyLevel = urgencyMeta.urgencyLevel;
        db.prepare(
          "UPDATE events SET urgency_label = ?, urgency_level = ? WHERE id = ?"
        ).run(urgencyMeta.urgencyLabel, urgencyMeta.urgencyLevel, event.id);
      }
    } catch {}

    // Phase38: 状態変化時に通知候補を生成
    try {
      const beforeSignals = event.entry_signals_json
        ? JSON.parse(event.entry_signals_json)
        : [];
      queueNotificationsForEventChange({
        event,
        beforeSnapshot: {
          status: event.entry_status,
          urgencyLabel: event.urgency_label,
          urgencyLevel: event.urgency_level,
          signals: beforeSignals,
        },
        afterSnapshot: {
          status: newStatus,
          urgencyLabel: newUrgencyLabel,
          urgencyLevel: newUrgencyLevel,
          signals: historyResult.signals || [],
        },
        sourceType: "monitor",
      });
      result.notificationQueued = true;
    } catch (notifyErr) {
      // 通知生成失敗は監視処理全体に影響させない
      result.notificationError = notifyErr.message;
    }

    // Phase39: 複数ソースがある場合は相互検証
    try {
      const sourceLinks = getMonitorableSourceLinks(event);
      if (sourceLinks.length >= 2) {
        const verifyResult = await verifyEventSources(event, { delayMs: 1000 });
        result.crossVerified = true;
        result.conflictLevel = verifyResult.conflict?.level || 0;
      }
    } catch (verifyErr) {
      // 相互検証失敗は監視全体に影響させない
      result.crossVerifyError = verifyErr.message;
    }

    // Phase73: official_entry_status をリアルタイム更新
    // Phase79: sourceType を渡して confidence ボーナスを適用
    try {
      const updatedEvent = {
        ...event,
        entry_status: newStatus,
        last_verified_at: now,
      };
      const officialResult = determineOfficialEntryStatus(updatedEvent, {
        pageText,
        signals: historyResult.signals?.map((s) => s.label) || [],
        sourceUrl: url,
      });
      saveOfficialEntryStatus(event.id, officialResult, event.source_url);
      result.officialStatus = officialResult.status;
      result.officialConfidence = officialResult.confidence;
    } catch (officialErr) {
      // official status 更新失敗は監視全体に影響させない
      result.officialStatusError = officialErr.message;
    }

    result.success = true;
  } catch (err) {
    result.error = err.message;

    // エラーカウント更新
    db.prepare(
      `UPDATE events SET
        monitor_error_count = COALESCE(monitor_error_count, 0) + 1,
        monitor_last_error = ?,
        last_verified_at = ?
       WHERE id = ?`
    ).run(err.message.slice(0, 500), now, event.id);
  }

  return result;
}

// ─── バッチ監視実行 ──────────────────────────────

/**
 * 監視ジョブを実行する
 *
 * @param {object} [options]
 * @param {number} [options.limit=50] - 最大監視件数
 * @param {number} [options.delayMs=1000] - リクエスト間隔(ms)
 * @returns {Promise<object>} 実行結果サマリー
 */
export async function runEntryStatusMonitor(options = {}) {
  const limit = options.limit || 50;
  const delayMs = options.delayMs || 1000;

  const startTime = Date.now();
  const targets = getMonitorTargetEvents({ limit });

  const results = {
    totalTargets: targets.length,
    checked: 0,
    succeeded: 0,
    failed: 0,
    statusChanged: 0,
    signalsFound: 0,
    notificationsQueued: 0,
    crossVerified: 0,
    conflictsFound: 0,
    errors: [],
    changes: [],
    durationMs: 0,
  };

  for (const event of targets) {
    try {
      const checkResult = await checkSingleEventEntryStatus(event);
      results.checked++;

      if (checkResult.success) {
        results.succeeded++;
        if (checkResult.statusChanged) {
          results.statusChanged++;
          results.changes.push({
            eventId: event.id,
            title: event.title,
            from: checkResult.previousStatus,
            to: checkResult.newStatus,
          });
        }
        if (checkResult.signalsDetected.length > 0) {
          results.signalsFound++;
        }
        if (checkResult.notificationQueued) {
          results.notificationsQueued++;
        }
        if (checkResult.crossVerified) {
          results.crossVerified++;
          if (checkResult.conflictLevel >= 2) {
            results.conflictsFound++;
          }
        }
      } else {
        results.failed++;
        results.errors.push({
          eventId: event.id,
          title: event.title,
          error: checkResult.error,
        });
      }
    } catch (err) {
      results.failed++;
      results.errors.push({
        eventId: event.id,
        title: event.title,
        error: err.message,
      });
    }

    // レート制限: リクエスト間に待機
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  results.durationMs = Date.now() - startTime;
  return results;
}

// ─── 管理用: 鮮度統計 ────────────────────────────

/**
 * 鮮度統計を取得する（管理画面用）
 *
 * @returns {object} 鮮度カテゴリ別の件数
 */
export function getFreshnessStats() {
  const db = getDb();

  const stats = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN last_verified_at IS NULL THEN 1 ELSE 0 END) as never_checked,
        SUM(CASE WHEN last_verified_at >= datetime('now', '-3 days') THEN 1 ELSE 0 END) as fresh,
        SUM(CASE WHEN last_verified_at >= datetime('now', '-7 days') AND last_verified_at < datetime('now', '-3 days') THEN 1 ELSE 0 END) as normal,
        SUM(CASE WHEN last_verified_at >= datetime('now', '-14 days') AND last_verified_at < datetime('now', '-7 days') THEN 1 ELSE 0 END) as stale,
        SUM(CASE WHEN last_verified_at < datetime('now', '-14 days') THEN 1 ELSE 0 END) as very_stale,
        SUM(CASE WHEN monitor_error_count > 0 THEN 1 ELSE 0 END) as has_errors
       FROM events
       WHERE is_active = 1
         AND (event_date IS NULL OR event_date >= date('now', '-1 day'))`
    )
    .get();

  return stats;
}
