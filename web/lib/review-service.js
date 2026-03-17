/**
 * Phase138: 口コミサービス
 *
 * event_reviews テーブルの CRUD 操作を提供。
 * 新しい拡張カラム（rating_overall, rating_course 等）を活用。
 * 既存の rating / title / body カラムとの後方互換も維持。
 */

import { getDb } from "./db";

// ── 定数定義 ──

export const PARTICIPANT_TYPES = [
  { value: "beginner", label: "初参加・初心者" },
  { value: "intermediate", label: "何度か参加経験あり" },
  { value: "experienced", label: "ベテラン・上級者" },
  { value: "spectator", label: "応援・観戦者" },
];

export const VISIT_TYPES = [
  { value: "first", label: "初めて" },
  { value: "repeat", label: "リピート参加" },
];

export const RATING_CATEGORIES = [
  { key: "rating_overall", label: "総合評価", shortLabel: "総合" },
  { key: "rating_course", label: "コース満足度", shortLabel: "コース" },
  { key: "rating_access", label: "アクセス", shortLabel: "アクセス" },
  { key: "rating_venue", label: "会場・運営", shortLabel: "会場" },
  { key: "rating_beginner", label: "初心者へのおすすめ度", shortLabel: "初心者向け" },
];

export const REVIEW_STATUSES = {
  published: { label: "公開", color: "bg-green-100 text-green-700" },
  pending: { label: "確認中", color: "bg-amber-100 text-amber-700" },
  hidden: { label: "非公開", color: "bg-gray-100 text-gray-500" },
  flagged: { label: "要確認", color: "bg-red-100 text-red-700" },
};

// ── 取得系 ──

/**
 * 大会の口コミ一覧を取得（公開のみ）
 */
export function getEventReviews(eventId, { limit = 50, offset = 0, sort = "newest" } = {}) {
  const db = getDb();
  const orderBy = sort === "rating_high" ? "rating_overall DESC"
    : sort === "rating_low" ? "rating_overall ASC"
    : sort === "beginner" ? "rating_beginner DESC"
    : "created_at DESC";

  const reviews = db.prepare(`
    SELECT * FROM event_reviews
    WHERE event_id = ? AND (status = 'published' OR status IS NULL)
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(eventId, limit, offset);

  const countRow = db.prepare(`
    SELECT COUNT(*) as total FROM event_reviews
    WHERE event_id = ? AND (status = 'published' OR status IS NULL)
  `).get(eventId);

  return { reviews, total: countRow?.total || 0 };
}

/**
 * 大会の口コミサマリー（平均評価・件数・カテゴリ別平均）
 */
export function getEventReviewSummary(eventId) {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COUNT(*) as total,
      AVG(COALESCE(rating_overall, rating)) as avg_overall,
      AVG(rating_course) as avg_course,
      AVG(rating_access) as avg_access,
      AVG(rating_venue) as avg_venue,
      AVG(rating_beginner) as avg_beginner,
      COUNT(CASE WHEN participant_type = 'beginner' THEN 1 END) as beginner_count,
      COUNT(CASE WHEN participant_type = 'experienced' THEN 1 END) as experienced_count,
      COUNT(CASE WHEN visit_type = 'repeat' THEN 1 END) as repeat_count
    FROM event_reviews
    WHERE event_id = ? AND (status = 'published' OR status IS NULL)
  `).get(eventId);

  if (!row || row.total === 0) return null;

  return {
    total: row.total,
    avg_overall: row.avg_overall ? Math.round(row.avg_overall * 10) / 10 : null,
    avg_course: row.avg_course ? Math.round(row.avg_course * 10) / 10 : null,
    avg_access: row.avg_access ? Math.round(row.avg_access * 10) / 10 : null,
    avg_venue: row.avg_venue ? Math.round(row.avg_venue * 10) / 10 : null,
    avg_beginner: row.avg_beginner ? Math.round(row.avg_beginner * 10) / 10 : null,
    beginner_count: row.beginner_count,
    experienced_count: row.experienced_count,
    repeat_count: row.repeat_count,
  };
}

/**
 * 口コミ投稿
 */
export function createReview(data) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO event_reviews (
      event_id, sport_type, user_id,
      rating, rating_overall, rating_course, rating_access, rating_venue, rating_beginner,
      title, review_title, body, review_body,
      participant_type, visit_type, year_joined,
      author_name, nickname, recommended_for,
      status
    ) VALUES (
      ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?
    )
  `).run(
    data.event_id, data.sport_type || null, data.user_id || null,
    data.rating_overall, data.rating_overall, data.rating_course || null, data.rating_access || null, data.rating_venue || null, data.rating_beginner || null,
    data.review_title || null, data.review_title || null, data.review_body || null, data.review_body || null,
    data.participant_type || null, data.visit_type || null, data.year_joined || null,
    data.nickname || null, data.nickname || null, data.recommended_for || null,
    "published"
  );
  return result.lastInsertRowid;
}

/**
 * 管理用: 全口コミ取得（ステータス問わず）
 */
export function getAdminReviews({ status, eventId, sportType, limit = 50, offset = 0 } = {}) {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (status) { conditions.push("r.status = ?"); params.push(status); }
  if (eventId) { conditions.push("r.event_id = ?"); params.push(eventId); }
  if (sportType) { conditions.push("r.sport_type = ?"); params.push(sportType); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const reviews = db.prepare(`
    SELECT r.*, e.title as event_title, e.sport_type as event_sport_type
    FROM event_reviews r
    LEFT JOIN events e ON e.id = r.event_id
    ${where}
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const countRow = db.prepare(`
    SELECT COUNT(*) as total FROM event_reviews r ${where}
  `).get(...params);

  // ステータス別集計
  const statsRows = db.prepare(`
    SELECT status, COUNT(*) as cnt FROM event_reviews GROUP BY status
  `).all();
  const stats = {};
  for (const row of statsRows) {
    stats[row.status || "published"] = row.cnt;
  }

  return { reviews, total: countRow?.total || 0, stats };
}

/**
 * 管理用: ステータス変更
 */
export function updateReviewStatus(reviewId, newStatus) {
  const db = getDb();
  db.prepare(`
    UPDATE event_reviews SET status = ?, updated_at = datetime('now') WHERE id = ?
  `).run(newStatus, reviewId);
}

/**
 * 口コミ要約生成（ルールベース）
 */
export function generateReviewInsights(eventId) {
  const summary = getEventReviewSummary(eventId);
  if (!summary || summary.total < 1) return [];

  const insights = [];

  // 初心者評価が高い
  if (summary.avg_beginner && summary.avg_beginner >= 4.0) {
    insights.push({
      type: "positive",
      icon: "👍",
      text: "初心者からの評価が高い大会です",
      detail: `初心者おすすめ度 ${summary.avg_beginner}`,
    });
  } else if (summary.avg_beginner && summary.avg_beginner < 3.0 && summary.total >= 3) {
    insights.push({
      type: "caution",
      icon: "⚠️",
      text: "経験者向けの大会という声があります",
      detail: `初心者おすすめ度 ${summary.avg_beginner}`,
    });
  }

  // コース評価が高い
  if (summary.avg_course && summary.avg_course >= 4.0) {
    insights.push({
      type: "positive",
      icon: "🏔️",
      text: "コースの満足度が高い大会です",
      detail: `コース評価 ${summary.avg_course}`,
    });
  }

  // アクセス評価
  if (summary.avg_access && summary.avg_access < 3.0 && summary.total >= 3) {
    insights.push({
      type: "info",
      icon: "🚗",
      text: "アクセスには余裕を持った移動がおすすめです",
      detail: `アクセス評価 ${summary.avg_access}`,
    });
  } else if (summary.avg_access && summary.avg_access >= 4.0) {
    insights.push({
      type: "positive",
      icon: "🚃",
      text: "アクセスが良好な大会です",
      detail: `アクセス評価 ${summary.avg_access}`,
    });
  }

  // 会場運営評価
  if (summary.avg_venue && summary.avg_venue >= 4.0) {
    insights.push({
      type: "positive",
      icon: "🏟️",
      text: "会場運営がしっかりしている大会です",
      detail: `会場評価 ${summary.avg_venue}`,
    });
  } else if (summary.avg_venue && summary.avg_venue < 3.0 && summary.total >= 3) {
    insights.push({
      type: "caution",
      icon: "📋",
      text: "会場の導線に注意が必要との声があります",
      detail: `会場評価 ${summary.avg_venue}`,
    });
  }

  // リピーター率が高い
  if (summary.repeat_count && summary.total >= 3 && summary.repeat_count / summary.total > 0.5) {
    insights.push({
      type: "positive",
      icon: "🔄",
      text: "リピーターが多い人気の大会です",
      detail: `${Math.round(summary.repeat_count / summary.total * 100)}%がリピート参加`,
    });
  }

  // 総合評価が高い
  if (summary.avg_overall && summary.avg_overall >= 4.5 && summary.total >= 3) {
    insights.push({
      type: "positive",
      icon: "⭐",
      text: "参加者の満足度がとても高い大会です",
      detail: `総合評価 ${summary.avg_overall}`,
    });
  }

  return insights;
}
