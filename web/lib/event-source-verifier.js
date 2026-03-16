/**
 * ソース別取得・検証サービス
 *
 * source_type ごとに既存 fetcher/parser を呼び、
 * 取得結果を正規化して event_source_snapshots に保存する。
 */

import { getDb } from "@/lib/db";
import * as cheerio from "cheerio";
import {
  isRunnetUrl,
  fetchRunnetHtml,
  extractEventInfo as extractRunnetInfo,
} from "@/lib/runnet-fetcher";
import {
  isMoshicomUrl,
  fetchMoshicomHtml,
  extractEventInfo as extractMoshicomInfo,
} from "@/lib/moshicom-fetcher";
import { getMonitorableSourceLinks, ensureEventSourceLinks } from "@/lib/event-sources";
import { detectVerificationConflict, buildConflictSummary } from "@/lib/verification-conflict";

// ─── 単一ソース検証 ─────────────────────────────────

/**
 * 1つのソースリンクを取得・検証する
 *
 * @param {object} sourceLink - event_source_links レコード
 * @param {object} [options]
 * @returns {Promise<object>} snapshot データ
 */
export async function verifySingleSourceLink(sourceLink, options = {}) {
  const now = new Date().toISOString();
  const snapshot = {
    event_id: sourceLink.event_id,
    source_link_id: sourceLink.id || null,
    source_type: sourceLink.source_type,
    checked_at: now,
    entry_status: null,
    entry_start_date: null,
    entry_end_date: null,
    event_date_text: null,
    status_text: null,
    is_success: 0,
    error_message: null,
    raw_summary_json: null,
  };

  try {
    const url = sourceLink.source_url;
    let eventInfo;

    if (sourceLink.source_type === "runnet" || isRunnetUrl(url)) {
      const html = await fetchRunnetHtml(url);
      const $ = cheerio.load(html);
      eventInfo = extractRunnetInfo($, url);
    } else if (sourceLink.source_type === "moshicom" || isMoshicomUrl(url)) {
      const html = await fetchMoshicomHtml(url);
      const $ = cheerio.load(html);
      eventInfo = extractMoshicomInfo($, url);
    } else {
      snapshot.error_message = "unsupported_source_type";
      return snapshot;
    }

    // 正規化
    const normalized = normalizeSourceVerificationResult(eventInfo, sourceLink.source_type);
    Object.assign(snapshot, normalized);
    snapshot.is_success = 1;
    snapshot.raw_summary_json = JSON.stringify({
      title: eventInfo.title,
      entry_status: eventInfo.entry_status,
      entry_start_date: eventInfo.entry_start_date,
      entry_end_date: eventInfo.entry_end_date,
      event_date: eventInfo.event_date,
      venue_name: eventInfo.venue_name,
      prefecture: eventInfo.prefecture,
    });
  } catch (err) {
    snapshot.error_message = (err.message || "unknown error").slice(0, 500);
  }

  return snapshot;
}

/**
 * 取得結果を正規化する
 */
export function normalizeSourceVerificationResult(rawResult, sourceType) {
  return {
    entry_status: rawResult.entry_status || null,
    entry_start_date: rawResult.entry_start_date || null,
    entry_end_date: rawResult.entry_end_date || null,
    event_date_text: rawResult.event_date || null,
    status_text: rawResult.entry_status || null,
  };
}

// ─── snapshot 保存 ───────────────────────────────────

/**
 * snapshot を event_source_snapshots に保存する
 *
 * @param {object} snapshot
 * @returns {number} inserted row id
 */
export function saveSourceSnapshot(snapshot) {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO event_source_snapshots
       (event_id, source_link_id, source_type, checked_at,
        entry_status, entry_start_date, entry_end_date,
        event_date_text, status_text,
        is_success, error_message, raw_summary_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      snapshot.event_id,
      snapshot.source_link_id,
      snapshot.source_type,
      snapshot.checked_at,
      snapshot.entry_status,
      snapshot.entry_start_date,
      snapshot.entry_end_date,
      snapshot.event_date_text,
      snapshot.status_text,
      snapshot.is_success,
      snapshot.error_message,
      snapshot.raw_summary_json
    );
  return result.lastInsertRowid;
}

// ─── 大会全ソース検証 ───────────────────────────────

/**
 * 大会の全ソースを検証し、矛盾判定まで実行する
 *
 * @param {object} event - events レコード
 * @param {object} [options]
 * @param {number} [options.delayMs=1000] - ソース間の待機時間
 * @returns {Promise<object>} { snapshots, conflict, updated }
 */
export async function verifyEventSources(event, options = {}) {
  const db = getDb();
  const delayMs = options.delayMs ?? 1000;
  const now = new Date().toISOString();

  // 1. source_links を確保
  ensureEventSourceLinks(event);

  // 2. 監視可能なソースを取得
  const sourceLinks = getMonitorableSourceLinks(event);

  if (sourceLinks.length < 2) {
    // 単一ソースの場合は矛盾なし → verification_status を更新
    db.prepare(
      `UPDATE events SET
        verification_status = 'single_source',
        verification_conflict = 0,
        verification_conflict_level = 0,
        verification_conflict_updated_at = ?
       WHERE id = ?`
    ).run(now, event.id);

    return {
      snapshots: [],
      conflict: null,
      updated: true,
      reason: "single_source",
    };
  }

  // 3. 各ソースを検証
  const snapshots = [];
  for (let i = 0; i < sourceLinks.length; i++) {
    const link = sourceLinks[i];
    try {
      const snapshot = await verifySingleSourceLink(link);
      saveSourceSnapshot(snapshot);
      snapshots.push(snapshot);
    } catch (err) {
      const errorSnapshot = {
        event_id: event.id,
        source_link_id: link.id || null,
        source_type: link.source_type,
        checked_at: now,
        is_success: 0,
        error_message: err.message?.slice(0, 500),
      };
      saveSourceSnapshot(errorSnapshot);
      snapshots.push(errorSnapshot);
    }

    // ソース間待機
    if (i < sourceLinks.length - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  // 4. 矛盾判定
  const successSnapshots = snapshots.filter((s) => s.is_success);
  let conflict = null;

  if (successSnapshots.length >= 2) {
    conflict = detectVerificationConflict(successSnapshots);
    const summary = buildConflictSummary(conflict);

    // events テーブルに反映
    db.prepare(
      `UPDATE events SET
        verification_conflict = ?,
        verification_conflict_level = ?,
        verification_conflict_summary = ?,
        verification_conflict_updated_at = ?,
        verification_status = ?
       WHERE id = ?`
    ).run(
      conflict.conflict ? 1 : 0,
      conflict.level,
      summary,
      now,
      conflict.conflict ? "conflict" : "verified",
      event.id
    );
  } else {
    // 取得成功が1件以下 → 判定不能
    db.prepare(
      `UPDATE events SET
        verification_status = 'unverified',
        verification_conflict_updated_at = ?
       WHERE id = ?`
    ).run(now, event.id);
  }

  return { snapshots, conflict, updated: true };
}

// ─── 最新 snapshot 取得 ──────────────────────────────

/**
 * 大会の最新 snapshot をソース別に取得する
 *
 * @param {number} eventId
 * @returns {Array}
 */
export function getLatestSnapshots(eventId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT ess.*
       FROM event_source_snapshots ess
       INNER JOIN (
         SELECT source_type, MAX(checked_at) as max_checked
         FROM event_source_snapshots
         WHERE event_id = ?
         GROUP BY source_type
       ) latest ON ess.source_type = latest.source_type
                AND ess.checked_at = latest.max_checked
       WHERE ess.event_id = ?
       ORDER BY ess.source_type`
    )
    .all(eventId, eventId);
}
