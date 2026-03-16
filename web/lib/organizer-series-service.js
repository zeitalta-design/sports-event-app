/**
 * 主催者ページ / シリーズページ用サービス
 *
 * 既存の marathon_details テーブルから主催者・シリーズ情報を集約する。
 * 将来 organizers / series テーブルに発展可能な設計。
 */

import { getDb } from "@/lib/db";
import { toSlug } from "@/lib/slug";

// ─── 距離カテゴリ ────────────────────────────

function getDistanceLabel(km) {
  if (!km || km <= 0) return null;
  if (km >= 42 && km <= 43) return "フル";
  if (km >= 20 && km <= 22) return "ハーフ";
  if (km > 5 && km <= 10) return "10km";
  if (km > 0 && km <= 5) return "5km";
  if (km > 43) return "ウルトラ";
  return null;
}

function getDistanceLabelsForEvent(db, eventId) {
  const races = db
    .prepare(
      "SELECT distance_km FROM event_races WHERE event_id = ? AND distance_km IS NOT NULL"
    )
    .all(eventId);
  const labels = new Set();
  for (const r of races) {
    const label = getDistanceLabel(r.distance_km);
    if (label) labels.add(label);
  }
  return [...labels];
}

function batchDistanceLabels(db, eventIds) {
  if (eventIds.length === 0) return new Map();
  const ph = eventIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT event_id, distance_km FROM event_races
       WHERE event_id IN (${ph}) AND distance_km IS NOT NULL`
    )
    .all(...eventIds);

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.event_id)) map.set(row.event_id, new Set());
    const label = getDistanceLabel(row.distance_km);
    if (label) map.get(row.event_id).add(label);
  }

  const result = new Map();
  for (const [id, labels] of map) {
    result.set(id, [...labels]);
  }
  return result;
}

// ─── 主催者 ──────────────────────────────────

/**
 * 全主催者の一覧を返す
 * @returns {Array<{name, slug, description, review_score, review_count, event_count}>}
 */
export function getAllOrganizers() {
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT md.organizer_name,
              md.organizer_description,
              md.organizer_review_score,
              md.organizer_review_count,
              COUNT(e.id) as event_count
       FROM marathon_details md
       JOIN events e ON e.id = md.marathon_id AND e.is_active = 1
       WHERE md.organizer_name IS NOT NULL AND md.organizer_name != ''
       GROUP BY md.organizer_name
       ORDER BY event_count DESC, md.organizer_name`
    )
    .all();

  return rows.map((row) => ({
    name: row.organizer_name,
    slug: toSlug(row.organizer_name),
    description: row.organizer_description || null,
    review_score: row.organizer_review_score || null,
    review_count: row.organizer_review_count || 0,
    event_count: row.event_count,
  }));
}

/**
 * slugから主催者情報を取得
 * @param {string} slug
 * @returns {object|null} - { name, slug, description, review_score, review_count, event_count }
 */
export function getOrganizerBySlug(slug) {
  const organizers = getAllOrganizers();
  const decoded = decodeURIComponent(slug);
  return organizers.find((o) => o.slug === decoded) || null;
}

/**
 * 主催者の大会一覧を取得
 * @param {string} organizerName - 主催者名（exact match）
 * @param {object} [options={}]
 * @param {number} [options.limit=50] - 取得件数
 * @returns {Array<object>}
 */
export function getOrganizerMarathons(organizerName, options = {}) {
  const { limit = 50 } = options;
  const db = getDb();

  const events = db
    .prepare(
      `SELECT e.id, e.title, e.event_date, e.event_month, e.prefecture, e.city,
              e.venue_name, e.entry_status, e.source_url
       FROM events e
       JOIN marathon_details md ON md.marathon_id = e.id
       WHERE md.organizer_name = ? AND e.is_active = 1
       ORDER BY e.event_date DESC
       LIMIT ?`
    )
    .all(organizerName, limit);

  // バッチで距離ラベル取得
  const ids = events.map((e) => e.id);
  const distMap = batchDistanceLabels(db, ids);

  return events.map((ev) => ({
    ...ev,
    distance_labels: distMap.get(ev.id) || [],
  }));
}

// ─── シリーズ ────────────────────────────────

/**
 * シリーズ名からシリーズキーワードを抽出
 * 年号・回数・地名修飾を除去した共通部分
 */
function extractSeriesKeyword(title) {
  if (!title) return null;
  let cleaned = title
    .replace(/\d{4}年?/g, "")
    .replace(/第\d+回\s*/g, "")
    .replace(/in\s+\d{4}/gi, "")
    .replace(/\d+\s*$/, "")
    .replace(/【[^】]*】/g, "")
    .replace(/\([^)]*\)/g, "")
    .trim();
  if (cleaned.length < 3) return null;
  return cleaned;
}

/**
 * 全シリーズの一覧を返す
 * 同じシリーズキーワードを持つ大会群を集約
 * @returns {Array<{name, slug, keyword, event_count, organizer_name}>}
 */
export function getAllSeries() {
  const db = getDb();

  // series_events_json を持つ大会から明示的シリーズを取得
  const explicitRows = db
    .prepare(
      `SELECT md.marathon_id, e.title, md.organizer_name, md.series_events_json
       FROM marathon_details md
       JOIN events e ON e.id = md.marathon_id AND e.is_active = 1
       WHERE md.series_events_json IS NOT NULL AND md.series_events_json != '[]' AND md.series_events_json != ''`
    )
    .all();

  const seriesMap = new Map(); // keyword → { name, slug, organizer_name, eventIds }

  for (const row of explicitRows) {
    const keyword = extractSeriesKeyword(row.title);
    if (!keyword || keyword.length < 3) continue;

    const slug = toSlug(keyword);
    if (!seriesMap.has(slug)) {
      seriesMap.set(slug, {
        name: keyword,
        slug,
        organizer_name: row.organizer_name,
        eventIds: new Set(),
      });
    }
    seriesMap.get(slug).eventIds.add(row.marathon_id);

    // series_events_json の中の大会IDも追加
    try {
      const seriesEvents = JSON.parse(row.series_events_json);
      if (Array.isArray(seriesEvents)) {
        for (const se of seriesEvents) {
          const id = se.event_id || se.id;
          if (id) seriesMap.get(slug).eventIds.add(id);
        }
      }
    } catch {
      // ignore
    }
  }

  // 大会名のシリーズ共通語から追加検出
  const allEvents = db
    .prepare(
      `SELECT e.id, e.title, md.organizer_name
       FROM events e
       LEFT JOIN marathon_details md ON md.marathon_id = e.id
       WHERE e.is_active = 1`
    )
    .all();

  // 既存のシリーズキーワードに一致する大会を追加
  for (const ev of allEvents) {
    for (const [slug, series] of seriesMap) {
      if (ev.title.includes(series.name) && !series.eventIds.has(ev.id)) {
        series.eventIds.add(ev.id);
      }
    }
  }

  // 2件以上の大会を持つシリーズのみ返す（1件だけでは「シリーズ」としての価値が低い）
  return [...seriesMap.values()]
    .filter((s) => s.eventIds.size >= 1) // 1件でもシリーズとして表示（将来大会追加時に備えて）
    .map((s) => ({
      name: s.name,
      slug: s.slug,
      organizer_name: s.organizer_name,
      event_count: s.eventIds.size,
    }))
    .sort((a, b) => b.event_count - a.event_count);
}

/**
 * slugからシリーズ情報を取得
 * @param {string} slug
 * @returns {object|null}
 */
export function getSeriesBySlug(slug) {
  const allSeries = getAllSeries();
  const decoded = decodeURIComponent(slug);
  return allSeries.find((s) => s.slug === decoded) || null;
}

/**
 * シリーズの大会一覧を取得
 * @param {string} seriesName - シリーズ名（keyword）
 * @param {object} [options={}]
 * @param {number} [options.limit=50] - 取得件数
 * @returns {Array<object>}
 */
export function getSeriesMarathonsList(seriesName, options = {}) {
  const { limit = 50 } = options;
  const db = getDb();

  // シリーズ名を含む大会を検索
  const events = db
    .prepare(
      `SELECT e.id, e.title, e.event_date, e.event_month, e.prefecture, e.city,
              e.venue_name, e.entry_status, e.source_url
       FROM events e
       WHERE e.title LIKE ? AND e.is_active = 1
       ORDER BY e.event_date DESC
       LIMIT ?`
    )
    .all(`%${seriesName}%`, limit);

  // series_events_json から追加候補も取得
  const seriesJsonRows = db
    .prepare(
      `SELECT md.series_events_json
       FROM marathon_details md
       JOIN events e ON e.id = md.marathon_id AND e.is_active = 1
       WHERE e.title LIKE ?`
    )
    .all(`%${seriesName}%`);

  const additionalIds = new Set();
  const existingIds = new Set(events.map((e) => e.id));

  for (const row of seriesJsonRows) {
    try {
      const parsed = JSON.parse(row.series_events_json);
      if (Array.isArray(parsed)) {
        for (const se of parsed) {
          const id = se.event_id || se.id;
          if (id && !existingIds.has(id)) additionalIds.add(id);
        }
      }
    } catch {
      // ignore
    }
  }

  // 追加IDの大会を取得
  if (additionalIds.size > 0) {
    const ph = [...additionalIds].map(() => "?").join(",");
    const addRows = db
      .prepare(
        `SELECT id, title, event_date, event_month, prefecture, city,
                venue_name, entry_status, source_url
         FROM events WHERE id IN (${ph}) AND is_active = 1`
      )
      .all(...additionalIds);
    events.push(...addRows);
  }

  // 日付順でソート
  events.sort((a, b) => {
    if (!a.event_date) return 1;
    if (!b.event_date) return -1;
    return b.event_date.localeCompare(a.event_date);
  });

  // バッチで距離ラベル取得
  const ids = events.map((e) => e.id);
  const distMap = batchDistanceLabels(db, ids);

  return events.slice(0, limit).map((ev) => ({
    ...ev,
    distance_labels: distMap.get(ev.id) || [],
  }));
}
