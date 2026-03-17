import { getDb } from "@/lib/db";

/**
 * Phase210: 口コミ品質管理サービス
 *
 * 短文・重複・連投の検知、要確認レビュー一覧
 */

const QUALITY_RULES = {
  MIN_BODY_LENGTH: 10,       // 最低文字数
  DUPLICATE_THRESHOLD: 0.85, // 内容重複の閾値
  SPAM_WINDOW_HOURS: 1,      // 連投検知の時間窓
  SPAM_MAX_POSTS: 3,         // 同一時間窓での最大投稿数
};

/**
 * 口コミの品質フラグを検出
 */
export function checkReviewQuality(review) {
  const flags = [];

  // 短文チェック
  const bodyLen = (review.review_body || review.body || "").trim().length;
  if (bodyLen > 0 && bodyLen < QUALITY_RULES.MIN_BODY_LENGTH) {
    flags.push({ type: "short_text", label: "短文", detail: `${bodyLen}文字（${QUALITY_RULES.MIN_BODY_LENGTH}文字未満）` });
  }

  // 本文なしチェック
  if (bodyLen === 0 && !review.review_title) {
    flags.push({ type: "no_content", label: "内容なし", detail: "本文もタイトルもなし" });
  }

  // 評価のみ（本文なし）
  if (bodyLen === 0 && (review.rating_overall || review.rating)) {
    flags.push({ type: "rating_only", label: "評価のみ", detail: "レーティングのみ・本文なし" });
  }

  return flags;
}

/**
 * 重複口コミ候補を検出（同一イベント内でbody類似度が高いもの）
 */
export function detectDuplicateReviews({ limit = 50 } = {}) {
  const db = getDb();
  const reviews = db.prepare(`
    SELECT id, event_id, user_id, review_body, review_title, created_at, status
    FROM event_reviews
    WHERE (status = 'published' OR status IS NULL)
      AND review_body IS NOT NULL AND review_body != ''
    ORDER BY event_id, created_at
  `).all();

  // イベントごとにグループ化
  const byEvent = {};
  for (const r of reviews) {
    if (!byEvent[r.event_id]) byEvent[r.event_id] = [];
    byEvent[r.event_id].push(r);
  }

  const duplicates = [];
  for (const [eventId, group] of Object.entries(byEvent)) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const sim = textSimilarity(group[i].review_body, group[j].review_body);
        if (sim >= QUALITY_RULES.DUPLICATE_THRESHOLD) {
          duplicates.push({
            eventId: parseInt(eventId),
            reviewA: { id: group[i].id, body: truncate(group[i].review_body, 60), user_id: group[i].user_id },
            reviewB: { id: group[j].id, body: truncate(group[j].review_body, 60), user_id: group[j].user_id },
            similarity: Math.round(sim * 100),
          });
        }
      }
    }
  }
  return duplicates.slice(0, limit);
}

/**
 * 連投ユーザーを検出
 */
export function detectSpamPosters({ hours = QUALITY_RULES.SPAM_WINDOW_HOURS, maxPosts = QUALITY_RULES.SPAM_MAX_POSTS } = {}) {
  const db = getDb();
  const spammers = db.prepare(`
    SELECT user_id, COUNT(*) as post_count,
           MIN(created_at) as first_post,
           MAX(created_at) as last_post,
           GROUP_CONCAT(id) as review_ids
    FROM event_reviews
    WHERE created_at >= datetime('now', '-${hours} hours')
      AND user_id IS NOT NULL
    GROUP BY user_id
    HAVING post_count >= ?
    ORDER BY post_count DESC
  `).all(maxPosts);

  return spammers.map((s) => ({
    userId: s.user_id,
    postCount: s.post_count,
    firstPost: s.first_post,
    lastPost: s.last_post,
    reviewIds: s.review_ids ? s.review_ids.split(",").map(Number) : [],
  }));
}

/**
 * 要確認レビュー一覧（品質フラグ付き）
 */
export function getFlaggedReviews({ limit = 50, offset = 0 } = {}) {
  const db = getDb();
  const reviews = db.prepare(`
    SELECT r.id, r.event_id, r.user_id, r.review_title, r.review_body,
           r.rating_overall, r.rating, r.status, r.created_at, r.nickname,
           e.title as event_title
    FROM event_reviews r
    LEFT JOIN events e ON r.event_id = e.id
    WHERE (r.status = 'published' OR r.status IS NULL OR r.status = 'pending')
    ORDER BY r.created_at DESC
  `).all();

  const flagged = [];
  for (const r of reviews) {
    const flags = checkReviewQuality(r);
    if (flags.length > 0) {
      flagged.push({ ...r, flags });
    }
  }

  return {
    total: flagged.length,
    items: flagged.slice(offset, offset + limit),
  };
}

/**
 * 口コミ品質サマリ
 */
export function getReviewQualityStats() {
  const db = getDb();
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM event_reviews WHERE status = 'published' OR status IS NULL`).get()?.cnt || 0;
  const pending = db.prepare(`SELECT COUNT(*) as cnt FROM event_reviews WHERE status = 'pending'`).get()?.cnt || 0;
  const flagged = db.prepare(`SELECT COUNT(*) as cnt FROM event_reviews WHERE status = 'flagged'`).get()?.cnt || 0;
  const hidden = db.prepare(`SELECT COUNT(*) as cnt FROM event_reviews WHERE status = 'hidden'`).get()?.cnt || 0;
  const shortBody = db.prepare(`SELECT COUNT(*) as cnt FROM event_reviews WHERE (status = 'published' OR status IS NULL) AND review_body IS NOT NULL AND LENGTH(review_body) > 0 AND LENGTH(review_body) < ?`).get(QUALITY_RULES.MIN_BODY_LENGTH)?.cnt || 0;
  const noBody = db.prepare(`SELECT COUNT(*) as cnt FROM event_reviews WHERE (status = 'published' OR status IS NULL) AND (review_body IS NULL OR review_body = '')`).get()?.cnt || 0;

  return { total, pending, flagged, hidden, shortBody, noBody };
}

// ユーティリティ
function textSimilarity(a, b) {
  if (!a || !b) return 0;
  const na = a.replace(/\s+/g, "");
  const nb = b.replace(/\s+/g, "");
  if (na === nb) return 1;
  if (na.length < 3 || nb.length < 3) return 0;
  const bigrams = (s) => { const set = new Set(); for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2)); return set; };
  const sa = bigrams(na);
  const sb = bigrams(nb);
  let inter = 0;
  for (const bg of sa) if (sb.has(bg)) inter++;
  return inter / (sa.size + sb.size - inter);
}

function truncate(s, len) {
  if (!s) return "";
  return s.length > len ? s.slice(0, len) + "…" : s;
}
