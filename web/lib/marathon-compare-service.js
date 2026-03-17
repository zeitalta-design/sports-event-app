/**
 * 比較ページ用データ取得サービス
 *
 * 複数大会の情報を一括取得し、比較表示に必要な形式で返す。
 */

import { getDb } from "@/lib/db";
import { getDisplayEntryStatus } from "@/lib/entry-status";
import { calculateTrustScore } from "@/lib/event-trust-score";
import { getEventHistoryTimeline } from "@/lib/event-history-service";
import { getEventReviewSummary } from "@/lib/review-service";

// ─── JSON安全パース ──────────────────────────────

function safeParseJson(str, fallback = null) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// ─── メインAPI ───────────────────────────────────

/**
 * 比較ページ用に複数大会のデータを取得する
 *
 * @param {number[]} ids - 大会IDの配列（最大3件）
 * @returns {Array<object>} - 比較用データの配列（入力順を維持）
 */
export function getCompareMarathons(ids) {
  if (!ids || ids.length === 0) return [];

  const db = getDb();

  // 大会基本情報を取得
  const placeholders = ids.map(() => "?").join(",");
  const events = db
    .prepare(
      `SELECT * FROM events WHERE id IN (${placeholders}) AND is_active = 1`
    )
    .all(...ids);

  if (events.length === 0) return [];

  const eventMap = new Map(events.map((e) => [e.id, e]));

  // レース情報を一括取得
  const eventIds = events.map((e) => e.id);
  const racePh = eventIds.map(() => "?").join(",");
  const races = db
    .prepare(
      `SELECT * FROM event_races WHERE event_id IN (${racePh})
       ORDER BY event_id, sort_order, distance_km DESC`
    )
    .all(...eventIds);

  const raceMap = new Map();
  for (const race of races) {
    if (!raceMap.has(race.event_id)) raceMap.set(race.event_id, []);
    raceMap.get(race.event_id).push(race);
  }

  // 詳細情報を一括取得
  const details = db
    .prepare(
      `SELECT * FROM marathon_details WHERE marathon_id IN (${racePh})`
    )
    .all(...eventIds);

  const detailMap = new Map(details.map((d) => [d.marathon_id, d]));

  // 追加データ（口コミ・信頼スコア・写真数・開催年数）を一括取得
  const extraMap = new Map();
  for (const id of eventIds) {
    const extra = {};
    // 口コミサマリー
    try { extra.reviewSummary = getEventReviewSummary(id); } catch { extra.reviewSummary = null; }
    // 信頼スコア
    try { extra.trustScore = calculateTrustScore(id); } catch { extra.trustScore = null; }
    // 写真数
    try {
      const photoCount = db.prepare(
        `SELECT COUNT(*) as cnt FROM event_photos WHERE event_id = ?`
      ).get(id);
      extra.photoCount = photoCount?.cnt || 0;
    } catch { extra.photoCount = 0; }
    // 開催年数（ヒストリー）
    try { extra.eventHistory = getEventHistoryTimeline(id); } catch { extra.eventHistory = null; }
    extraMap.set(id, extra);
  }

  // 入力順を維持して結果を構築
  return ids
    .map((id) => {
      const event = eventMap.get(id);
      if (!event) return null;

      const eventRaces = raceMap.get(id) || [];
      const detail = detailMap.get(id) || {};
      const extra = extraMap.get(id) || {};

      return buildCompareData(event, eventRaces, detail, extra);
    })
    .filter(Boolean);
}

// ─── データ構築 ──────────────────────────────────

function buildCompareData(event, races, d, extra = {}) {
  // 距離ラベル生成
  const distanceLabels = [
    ...new Set(
      races
        .map((r) => getDistanceLabel(r.distance_km))
        .filter(Boolean)
    ),
  ];

  // 参加費範囲
  const fees = races
    .map((r) => r.fee_min)
    .filter((f) => f && f > 0);
  const feeRange = fees.length > 0
    ? {
        min: Math.min(...fees),
        max: Math.max(...races.map((r) => r.fee_max || r.fee_min).filter((f) => f > 0)),
      }
    : null;

  // 制限時間
  const timeLimitsFromRaces = races
    .filter((r) => r.time_limit)
    .map((r) => ({
      race: r.race_name,
      limit: r.time_limit,
      distance_km: r.distance_km,
    }));

  return {
    id: event.id,
    title: event.title,
    event_date: event.event_date,
    event_month: event.event_month,
    prefecture: event.prefecture,
    city: event.city,
    venue_name: d.venue_name || event.venue_name,
    entry_status: getDisplayEntryStatus({
      entry_status: event.entry_status,
      event_date: event.event_date,
      entry_end_date: d.application_end_at || event.entry_end_date,
      entry_start_date: d.application_start_at || event.entry_start_date,
    }).status,
    entry_start_date: d.application_start_at || event.entry_start_date,
    entry_end_date: d.application_end_at || event.entry_end_date,
    source_url: event.source_url,
    official_url: d.official_url || event.official_url,
    entry_url: d.entry_url || null,

    // 種目
    races,
    distanceLabels,

    // 参加費
    feeRange,
    pricing: safeParseJson(d.pricing_json, []),

    // 制限時間
    timeLimitsFromRaces,
    time_limits: safeParseJson(d.time_limits_json, []),

    // 特徴
    features: safeParseJson(d.features_json, []),
    level_labels: safeParseJson(d.level_labels_json, []),
    event_scale_label: d.event_scale_label || null,

    // アクセス
    venue_address: d.venue_address || null,
    access_info: d.access_info || null,

    // 主催者
    organizer_name: d.organizer_name || null,

    // コース
    measurement_method: d.measurement_method || null,
    course_info: d.course_info || null,

    // キャッチ
    tagline: d.tagline || null,
    summary: d.summary || null,

    // Phase192: 比較強化フィールド
    reviewSummary: extra.reviewSummary || null,
    trustScore: extra.trustScore || null,
    photoCount: extra.photoCount || 0,
    eventHistory: extra.eventHistory || null,
  };
}

function getDistanceLabel(km) {
  if (!km || km <= 0) return null;
  if (km >= 42 && km <= 43) return "フル";
  if (km >= 20 && km <= 22) return "ハーフ";
  if (km > 5 && km <= 10) return "10km";
  if (km > 0 && km <= 5) return "5km";
  if (km > 43) return "ウルトラ";
  return `${Math.round(km * 10) / 10}km`;
}
