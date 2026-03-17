import { getDb } from "./db.js";
import { getEventResultsSummary } from "./results-service.js";
import { getEventReviewSummary, generateReviewInsights } from "./review-service.js";
import { getEventPhotoCount, getEventHeroPhoto, getEventPhotosByType } from "./photo-service.js";
import { getUserMemoCountsForEvents } from "./memo-service.js";

/**
 * Phase168: 大会振り返りサービス
 *
 * 結果 + 口コミ + 写真 + 大会情報を統合し、
 * 参加後の振り返り体験を生成する。
 */

/**
 * イベント振り返りデータを生成
 * @param {number} eventId
 * @param {object} opts - { year, userId }
 * @returns {{ event, resultsSummary, reviewSummary, reviewInsights, photoCount, heroPhoto, contextPhotos, userResult }}
 */
export function getEventRecap(eventId, { year, userId } = {}) {
  const db = getDb();

  // 大会基本情報
  const event = db.prepare(`
    SELECT id, title, event_date, prefecture, city, venue_name, sport_type, hero_image_url
    FROM events WHERE id = ?
  `).get(eventId);
  if (!event) return null;

  // 結果サマリー
  let resultsSummary = null;
  try { resultsSummary = getEventResultsSummary(eventId, year); } catch {}

  // 口コミサマリー
  let reviewSummary = null;
  let reviewInsights = [];
  try {
    reviewSummary = getEventReviewSummary(eventId);
    reviewInsights = generateReviewInsights(eventId);
  } catch {}

  // 写真
  let photoCount = 0;
  let heroPhoto = null;
  let contextPhotos = [];
  try {
    photoCount = getEventPhotoCount(eventId);
    heroPhoto = getEventHeroPhoto(eventId);
    contextPhotos = getEventPhotosByType(eventId, ["scenery", "course", "finish", "crowd"]);
  } catch {}

  // ユーザー自身の結果（ログイン時）
  let userResult = null;
  if (userId) {
    try {
      userResult = db.prepare(`
        SELECT er.*, ur.verified, ur.created_at as linked_at
        FROM user_results ur
        JOIN event_results er ON ur.result_id = er.id
        WHERE ur.user_id = ? AND ur.event_id = ?
        ORDER BY er.result_year DESC
        LIMIT 1
      `).get(userId, eventId) || null;
    } catch {}
  }

  // 口コミ投稿状況（ログイン時）
  let userReview = null;
  if (userId) {
    try {
      userReview = db.prepare(`
        SELECT id, rating_overall, review_title, created_at
        FROM event_reviews
        WHERE event_id = ? AND uploaded_by = ?
        ORDER BY created_at DESC LIMIT 1
      `).get(eventId, userId) || null;
    } catch {}
  }

  // 次のアクション候補
  const nextActions = buildNextActions({
    eventId,
    eventTitle: event.title,
    sportType: event.sport_type,
    userResult,
    userReview,
    photoCount,
  });

  return {
    event,
    resultsSummary,
    reviewSummary,
    reviewInsights,
    photoCount,
    heroPhoto,
    contextPhotos,
    userResult,
    userReview,
    nextActions,
  };
}

/**
 * ユーザーの全参加大会の振り返りリストを取得
 */
export function getUserRecapList(userId) {
  const db = getDb();
  const events = db.prepare(`
    SELECT DISTINCT ur.event_id, e.title, e.event_date, e.prefecture, e.sport_type,
      e.hero_image_url, er.result_year, er.finish_time, er.overall_rank,
      er.category_name, er.finish_status
    FROM user_results ur
    JOIN event_results er ON ur.result_id = er.id
    JOIN events e ON ur.event_id = e.id
    WHERE ur.user_id = ?
    ORDER BY er.result_year DESC, e.event_date DESC
  `).all(userId);

  // Phase171: メモカウントをまとめて取得
  const eventIds = events.map((ev) => ev.event_id);
  let memoCounts = {};
  try { memoCounts = getUserMemoCountsForEvents(userId, eventIds); } catch {}

  return events.map((ev) => {
    let photoCount = 0;
    let heroPhoto = null;
    try {
      photoCount = getEventPhotoCount(ev.event_id);
      heroPhoto = getEventHeroPhoto(ev.event_id);
    } catch {}

    let hasReview = false;
    try {
      const r = db.prepare(
        "SELECT 1 FROM event_reviews WHERE event_id = ? AND uploaded_by = ? LIMIT 1"
      ).get(ev.event_id, userId);
      hasReview = !!r;
    } catch {}

    return {
      ...ev,
      photoCount,
      heroPhotoUrl: heroPhoto?.image_url || ev.hero_image_url,
      hasReview,
      memoCount: memoCounts[ev.event_id] || 0,
    };
  });
}

function buildNextActions({ eventId, eventTitle, sportType, userResult, userReview, photoCount }) {
  const actions = [];

  if (!userReview) {
    actions.push({
      key: "write_review",
      label: "口コミを書く",
      icon: "✍️",
      href: `/reviews/new?event_id=${eventId}&event_title=${encodeURIComponent(eventTitle)}&sport_type=${sportType || "marathon"}`,
      priority: 1,
    });
  }

  if (photoCount > 0) {
    actions.push({
      key: "view_photos",
      label: "写真を見る",
      icon: "📸",
      href: `/marathon/${eventId}/photos`,
      priority: 2,
    });
  }

  actions.push({
    key: "add_memo",
    label: "メモを残す",
    icon: "📝",
    href: `/my-results?memo=${eventId}`,
    priority: 3,
  });

  actions.push({
    key: "find_similar",
    label: "似た大会を探す",
    icon: "🔍",
    href: `/marathon/${eventId}#related`,
    priority: 4,
  });

  if (!userResult) {
    actions.push({
      key: "link_result",
      label: "結果を紐付ける",
      icon: "🔗",
      href: `/my-results/link?event_id=${eventId}&event_title=${encodeURIComponent(eventTitle)}`,
      priority: 0,
    });
  }

  return actions.sort((a, b) => a.priority - b.priority);
}
