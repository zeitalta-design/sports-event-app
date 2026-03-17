/**
 * Phase189: 大会履歴サービス
 * Phase190: 参加人数推定
 *
 * 同名大会の過去開催実績をタイムライン化。
 * 結果データから参加人数を推定。
 */

import { getDb } from "./db";

/**
 * 大会の開催履歴タイムラインを取得
 * @param {number} eventId
 * @returns {{ years: Array<{year, status, eventId, finisherCount?}>, totalEditions: number }}
 */
export function getEventHistoryTimeline(eventId) {
  const db = getDb();

  // 現在の大会のnormalized_titleを取得
  const current = db.prepare(`
    SELECT id, normalized_title, event_date, title FROM events WHERE id = ?
  `).get(eventId);
  if (!current?.normalized_title) return { years: [], totalEditions: 0 };

  // 同名大会を年度別に取得
  const editions = db.prepare(`
    SELECT e.id, e.event_date, e.title,
      strftime('%Y', e.event_date) as event_year
    FROM events e
    WHERE e.normalized_title = ? AND e.event_date IS NOT NULL
    ORDER BY e.event_date ASC
  `).all(current.normalized_title);

  const now = new Date();
  const currentYear = now.getFullYear();

  const years = editions.map((ed) => {
    const year = parseInt(ed.event_year);
    const eventDate = new Date(ed.event_date);
    const isFuture = eventDate > now;
    const isCurrent = ed.id === eventId;

    // 結果データから完走者数を取得
    let finisherCount = null;
    try {
      const resultRow = db.prepare(`
        SELECT COUNT(*) as cnt FROM event_results
        WHERE event_id = ? AND is_public = 1
      `).get(ed.id);
      if (resultRow?.cnt > 0) finisherCount = resultRow.cnt;
    } catch {}

    return {
      year,
      eventId: ed.id,
      status: isFuture ? "upcoming" : "held",
      isCurrent,
      finisherCount,
    };
  });

  return {
    years,
    totalEditions: editions.length,
  };
}

/**
 * Phase190: 大会規模の推定
 * 結果データ・大会概要から参加人数を推定
 */
export function estimateParticipantCount(eventId) {
  const db = getDb();

  // 1. 結果データの件数（最も信頼性が高い）
  let resultCount = 0;
  try {
    const row = db.prepare(`
      SELECT COUNT(*) as cnt FROM event_results
      WHERE event_id = ? AND is_public = 1
    `).get(eventId);
    resultCount = row?.cnt || 0;
  } catch {}

  // 2. marathon_detailsのevent_scale_labelから推定
  let scaleLabel = null;
  try {
    const detail = db.prepare(`
      SELECT event_scale_label FROM marathon_details WHERE event_id = ?
    `).get(eventId);
    scaleLabel = detail?.event_scale_label || null;
  } catch {}

  // 3. event_racesの定員合計
  let totalCapacity = 0;
  try {
    const races = db.prepare(`
      SELECT capacity FROM event_races WHERE event_id = ?
    `).all(eventId);
    totalCapacity = races.reduce((sum, r) => sum + (r.capacity || 0), 0);
  } catch {}

  // 優先順位: 結果データ > 定員 > scaleLabel
  let estimate = null;
  let source = null;
  let confidence = "low";

  if (resultCount > 0) {
    estimate = resultCount;
    source = "results";
    confidence = "high";
  } else if (totalCapacity > 0) {
    estimate = totalCapacity;
    source = "capacity";
    confidence = "medium";
  } else if (scaleLabel) {
    // event_scale_label は "大規模", "中規模", "小規模" 等
    const scaleMap = {
      "大規模": 5000,
      "中規模": 1500,
      "小規模": 300,
    };
    for (const [key, val] of Object.entries(scaleMap)) {
      if (scaleLabel.includes(key)) {
        estimate = val;
        source = "scale_label";
        confidence = "low";
        break;
      }
    }
  }

  return {
    estimate,
    source,
    confidence,
    scaleLabel,
    resultCount,
    totalCapacity,
  };
}
