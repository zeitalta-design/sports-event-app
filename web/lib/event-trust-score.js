/**
 * Phase188: 大会信頼スコア (EventTrustScore)
 *
 * 大会ごとに信頼性を0-100で算出。
 * 材料: 口コミ数・評価、写真数、結果掲載、運営確認、開催年数。
 */

import { getDb } from "./db";

/**
 * 信頼スコアの重み定義
 */
const WEIGHTS = {
  reviewCount: 20,    // 口コミ件数（最大20pt）
  reviewRating: 15,   // 口コミ平均評価（最大15pt）
  photoCount: 10,     // 写真枚数（最大10pt）
  hasResults: 15,     // 結果掲載あり（0 or 15pt）
  organizerVerified: 25, // 運営確認ステータス（最大25pt）
  eventHistory: 15,   // 開催年数（最大15pt）
};

/**
 * 信頼スコアラベル定義
 */
const TRUST_LABELS = [
  { min: 80, label: "信頼度が高い", key: "high", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { min: 60, label: "信頼できる", key: "good", color: "text-blue-700 bg-blue-50 border-blue-200" },
  { min: 40, label: "情報蓄積中", key: "growing", color: "text-amber-700 bg-amber-50 border-amber-200" },
  { min: 0, label: "情報収集中", key: "new", color: "text-gray-500 bg-gray-50 border-gray-200" },
];

/**
 * 信頼スコアを算出
 * @param {number} eventId
 * @returns {{ score: number, label: string, key: string, color: string, breakdown: Object }}
 */
export function calculateTrustScore(eventId) {
  const db = getDb();
  let breakdown = {};

  // 1. 口コミ件数・平均
  const reviewStats = db.prepare(`
    SELECT COUNT(*) as cnt, AVG(COALESCE(rating_overall, rating)) as avg_rating
    FROM event_reviews
    WHERE event_id = ? AND (status = 'published' OR status IS NULL)
  `).get(eventId);

  const reviewCount = reviewStats?.cnt || 0;
  const avgRating = reviewStats?.avg_rating || 0;
  breakdown.reviewCount = Math.min(WEIGHTS.reviewCount, Math.round((Math.min(reviewCount, 10) / 10) * WEIGHTS.reviewCount));
  breakdown.reviewRating = reviewCount > 0
    ? Math.round(((avgRating - 1) / 4) * WEIGHTS.reviewRating)
    : 0;

  // 2. 写真数
  let photoCount = 0;
  try {
    const photoRow = db.prepare(`
      SELECT COUNT(*) as cnt FROM event_photos
      WHERE event_id = ? AND status = 'published'
    `).get(eventId);
    photoCount = photoRow?.cnt || 0;
  } catch {}
  breakdown.photoCount = Math.min(WEIGHTS.photoCount, Math.round((Math.min(photoCount, 8) / 8) * WEIGHTS.photoCount));

  // 3. 結果掲載
  let hasResults = false;
  try {
    const resultsRow = db.prepare(`
      SELECT COUNT(*) as cnt FROM event_results
      WHERE event_id = ? AND is_public = 1
    `).get(eventId);
    hasResults = (resultsRow?.cnt || 0) > 0;
  } catch {}
  breakdown.hasResults = hasResults ? WEIGHTS.hasResults : 0;

  // 4. 運営確認ステータス
  const event = db.prepare(`
    SELECT organizer_verified, event_date FROM events WHERE id = ?
  `).get(eventId);
  const verifiedStatus = event?.organizer_verified || "unconfirmed";
  const verificationPoints = {
    organizer_confirmed: WEIGHTS.organizerVerified,
    official_site_verified: Math.round(WEIGHTS.organizerVerified * 0.7),
    taikainavi_verified: Math.round(WEIGHTS.organizerVerified * 0.5),
    needs_review: Math.round(WEIGHTS.organizerVerified * 0.1),
    unconfirmed: 0,
  };
  breakdown.organizerVerified = verificationPoints[verifiedStatus] || 0;

  // 5. 開催年数（同名大会の過去開催回数で推定）
  let historyYears = 0;
  try {
    const titleBase = db.prepare(`SELECT normalized_title FROM events WHERE id = ?`).get(eventId);
    if (titleBase?.normalized_title) {
      const countRow = db.prepare(`
        SELECT COUNT(DISTINCT strftime('%Y', event_date)) as years
        FROM events
        WHERE normalized_title = ? AND event_date IS NOT NULL
      `).get(titleBase.normalized_title);
      historyYears = countRow?.years || 1;
    }
  } catch {}
  breakdown.eventHistory = Math.min(WEIGHTS.eventHistory, Math.round((Math.min(historyYears, 5) / 5) * WEIGHTS.eventHistory));

  // 合計
  const score = Object.values(breakdown).reduce((sum, v) => sum + v, 0);

  // ラベル
  const trustLabel = TRUST_LABELS.find((t) => score >= t.min) || TRUST_LABELS[TRUST_LABELS.length - 1];

  return {
    score,
    label: trustLabel.label,
    key: trustLabel.key,
    color: trustLabel.color,
    breakdown: {
      ...breakdown,
      reviewCount: { points: breakdown.reviewCount, max: WEIGHTS.reviewCount, raw: reviewCount },
      reviewRating: { points: breakdown.reviewRating, max: WEIGHTS.reviewRating, raw: Math.round(avgRating * 10) / 10 },
      photoCount: { points: breakdown.photoCount, max: WEIGHTS.photoCount, raw: photoCount },
      hasResults: { points: breakdown.hasResults, max: WEIGHTS.hasResults, raw: hasResults },
      organizerVerified: { points: breakdown.organizerVerified, max: WEIGHTS.organizerVerified, raw: verifiedStatus },
      eventHistory: { points: breakdown.eventHistory, max: WEIGHTS.eventHistory, raw: historyYears },
    },
  };
}

/**
 * 信頼スコアラベル定義の取得
 */
export function getTrustLabels() {
  return TRUST_LABELS;
}

/**
 * 複数大会の信頼スコアをバッチ取得
 */
export function getBatchTrustScores(eventIds) {
  const results = {};
  for (const id of eventIds) {
    try {
      results[id] = calculateTrustScore(id);
    } catch {
      results[id] = { score: 0, label: "情報収集中", key: "new", color: TRUST_LABELS[3].color, breakdown: {} };
    }
  }
  return results;
}
