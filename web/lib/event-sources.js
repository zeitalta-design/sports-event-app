/**
 * 大会ソースリンク管理ユーティリティ
 *
 * 1大会に複数ソース（RUNNET / Moshicom / 公式）を紐づけて管理する。
 * 既存の events.source_url との後方互換を保ちつつ、
 * event_source_links テーブルで複数ソースを扱えるようにする。
 */

import { getDb } from "@/lib/db";
import { isRunnetUrl } from "@/lib/runnet-fetcher";
import { isMoshicomUrl } from "@/lib/moshicom-fetcher";
import { isSportsentryUrl } from "@/lib/sportsentry-fetcher";

// ─── URL → source_type 判定 ─────────────────────────

/**
 * URLからソース種別を判定する
 *
 * @param {string} url
 * @returns {string} "runnet" | "moshicom" | "sportsentry" | "official" | "unknown"
 */
export function detectSourceTypeFromUrl(url) {
  if (!url) return "unknown";
  if (isRunnetUrl(url)) return "runnet";
  if (isMoshicomUrl(url)) return "moshicom";
  if (isSportsentryUrl(url)) return "sportsentry";
  return "official";
}

// ─── ソースリンク取得 ────────────────────────────────

/**
 * 大会に紐づくソースリンク一覧を取得する
 *
 * @param {number} eventId
 * @returns {Array} source_links レコード配列
 */
export function getEventSourceLinks(eventId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM event_source_links
       WHERE event_id = ? AND is_active = 1
       ORDER BY is_primary DESC, created_at ASC`
    )
    .all(eventId);
}

/**
 * プライマリソースリンクを取得する
 *
 * @param {number} eventId
 * @returns {object|null}
 */
export function getPrimarySourceLink(eventId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM event_source_links
       WHERE event_id = ? AND is_active = 1
       ORDER BY is_primary DESC
       LIMIT 1`
    )
    .get(eventId);
}

// ─── ソースリンク同期 ────────────────────────────────

/**
 * 既存の events.source_url / official_url から source_links を確保する
 * 既にリンクがあればスキップ（冪等）
 *
 * @param {object} event - events レコード（id, source_url, official_url, source_site）
 * @returns {{ created: number, existing: number }}
 */
export function ensureEventSourceLinks(event) {
  const db = getDb();
  let created = 0;
  let existing = 0;

  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO event_source_links
     (event_id, source_type, source_url, source_event_id, is_primary, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`
  );

  // 1. events.source_url → primary source
  if (event.source_url) {
    const sourceType = detectSourceTypeFromUrl(event.source_url);
    const result = insertStmt.run(
      event.id,
      sourceType,
      event.source_url,
      event.source_event_id || null,
      1 // is_primary
    );
    if (result.changes > 0) created++;
    else existing++;
  }

  // 2. events.official_url → secondary (if different from source_url)
  if (event.official_url && event.official_url !== event.source_url) {
    const sourceType = detectSourceTypeFromUrl(event.official_url);
    // official_url が runnet/moshicom の場合はそのタイプ、それ以外は official
    const result = insertStmt.run(
      event.id,
      sourceType,
      event.official_url,
      null,
      0 // not primary
    );
    if (result.changes > 0) created++;
    else existing++;
  }

  return { created, existing };
}

/**
 * 大会に新しいソースリンクを追加する
 *
 * @param {object} params
 * @param {number} params.eventId
 * @param {string} params.sourceUrl
 * @param {string} [params.sourceType] - 自動判定も可
 * @param {string} [params.sourceEventId]
 * @param {boolean} [params.isPrimary=false]
 * @param {string} [params.note]
 * @returns {object} { id, created }
 */
export function addEventSourceLink({
  eventId,
  sourceUrl,
  sourceType,
  sourceEventId,
  isPrimary = false,
  note,
}) {
  const db = getDb();
  const type = sourceType || detectSourceTypeFromUrl(sourceUrl);

  try {
    const result = db
      .prepare(
        `INSERT OR IGNORE INTO event_source_links
         (event_id, source_type, source_url, source_event_id, is_primary, note)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(eventId, type, sourceUrl, sourceEventId || null, isPrimary ? 1 : 0, note || null);

    if (result.changes > 0) {
      return { id: result.lastInsertRowid, created: true };
    }

    // 既存レコードを返す
    const existing = db
      .prepare("SELECT id FROM event_source_links WHERE event_id = ? AND source_url = ?")
      .get(eventId, sourceUrl);
    return { id: existing?.id, created: false };
  } catch (err) {
    return { id: null, created: false, error: err.message };
  }
}

// ─── 監視対象ソース選定 ──────────────────────────────

/**
 * 監視可能なソースリンクを取得する
 * runnet / moshicom のみ対象（official はパーサーなし）
 *
 * @param {object} event - events レコード
 * @returns {Array} monitorable source_links
 */
export function getMonitorableSourceLinks(event) {
  const links = getEventSourceLinks(event.id);

  // source_links があればそこから
  const monitorable = links.filter(
    (l) => l.source_type === "runnet" || l.source_type === "moshicom"
  );

  // source_links が無い場合、events.source_url から生成
  if (monitorable.length === 0 && event.source_url) {
    const type = detectSourceTypeFromUrl(event.source_url);
    if (type === "runnet" || type === "moshicom") {
      return [
        {
          id: null,
          event_id: event.id,
          source_type: type,
          source_url: event.source_url,
          is_primary: 1,
        },
      ];
    }
  }

  return monitorable;
}

// ─── 統計・照会 ────────────────────────────────────

/**
 * ソースリンクの統計を取得する
 */
export function getSourceLinkStats() {
  const db = getDb();
  return db
    .prepare(
      `SELECT
        COUNT(DISTINCT esl.event_id) as events_with_links,
        COUNT(*) as total_links,
        SUM(CASE WHEN esl.source_type = 'runnet' THEN 1 ELSE 0 END) as runnet_links,
        SUM(CASE WHEN esl.source_type = 'moshicom' THEN 1 ELSE 0 END) as moshicom_links,
        SUM(CASE WHEN esl.source_type = 'official' THEN 1 ELSE 0 END) as official_links
       FROM event_source_links esl
       WHERE esl.is_active = 1`
    )
    .get();
}

/**
 * 複数ソースを持つ大会を取得する
 *
 * @param {object} [options]
 * @param {number} [options.limit=50]
 * @returns {Array}
 */
export function getEventsWithMultipleSources({ limit = 50 } = {}) {
  const db = getDb();
  return db
    .prepare(
      `SELECT e.id, e.title, e.event_date, e.entry_status,
              e.verification_status, e.verification_conflict_level,
              e.verification_conflict_summary,
              COUNT(esl.id) as source_count,
              GROUP_CONCAT(esl.source_type, ', ') as source_types
       FROM events e
       JOIN event_source_links esl ON esl.event_id = e.id AND esl.is_active = 1
       WHERE e.is_active = 1
       GROUP BY e.id
       HAVING source_count > 1
       ORDER BY e.verification_conflict_level DESC, e.event_date ASC
       LIMIT ?`
    )
    .all(limit);
}
