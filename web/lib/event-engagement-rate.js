/**
 * Phase194: 大会参加率・エンゲージメント指標
 *
 * お気に入り数・保存数・口コミ数・結果閲覧数を元に
 * 「注目度」を可視化するための指標を計算する。
 *
 * 人気指数(event-popularity.js)は行動ログベースの内部スコアだが、
 * こちらはユーザーに見せる「大会への関心度」表示用。
 */

import { getDb } from "@/lib/db";

/**
 * 大会のエンゲージメント指標を取得
 * @param {number} eventId
 * @returns {object|null}
 */
export function getEventEngagement(eventId) {
  const db = getDb();

  // お気に入り数
  let favoriteCount = 0;
  try {
    const row = db.prepare(
      `SELECT COUNT(*) as cnt FROM favorites WHERE event_id = ?`
    ).get(eventId);
    favoriteCount = row?.cnt || 0;
  } catch {}

  // 口コミ数
  let reviewCount = 0;
  try {
    const row = db.prepare(
      `SELECT COUNT(*) as cnt FROM event_reviews WHERE event_id = ? AND (status = 'published' OR status IS NULL)`
    ).get(eventId);
    reviewCount = row?.cnt || 0;
  } catch {}

  // 結果登録数
  let resultCount = 0;
  try {
    const row = db.prepare(
      `SELECT COUNT(*) as cnt FROM event_results WHERE event_id = ?`
    ).get(eventId);
    resultCount = row?.cnt || 0;
  } catch {}

  // 写真数
  let photoCount = 0;
  try {
    const row = db.prepare(
      `SELECT COUNT(*) as cnt FROM event_photos WHERE event_id = ?`
    ).get(eventId);
    photoCount = row?.cnt || 0;
  } catch {}

  // 直近30日の閲覧数（event_activity_logs）
  let recentViews = 0;
  try {
    const row = db.prepare(
      `SELECT COUNT(*) as cnt FROM event_activity_logs
       WHERE event_id = ? AND action = 'detail_view'
       AND created_at >= datetime('now', '-30 days')`
    ).get(eventId);
    recentViews = row?.cnt || 0;
  } catch {}

  const total = favoriteCount + reviewCount + resultCount + photoCount;
  if (total === 0 && recentViews === 0) return null;

  // エンゲージメントレベル判定
  const level = getEngagementLevel(favoriteCount, reviewCount, resultCount, recentViews);

  return {
    favoriteCount,
    reviewCount,
    resultCount,
    photoCount,
    recentViews,
    level,
  };
}

/**
 * エンゲージメントレベルを判定
 */
function getEngagementLevel(favs, reviews, results, views) {
  // 重み付きスコア
  const score = favs * 3 + reviews * 5 + results * 2 + Math.min(views, 100) * 0.1;

  if (score >= 50) return { key: "very_high", label: "注目度 高", color: "emerald", icon: "🔥" };
  if (score >= 25) return { key: "high", label: "注目されています", color: "blue", icon: "👀" };
  if (score >= 10) return { key: "moderate", label: "関心が集まっています", color: "indigo", icon: "📈" };
  if (score >= 3) return { key: "growing", label: "チェックされています", color: "gray", icon: "👁️" };
  return null;
}
