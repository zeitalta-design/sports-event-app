/**
 * Phase191: ユーザー実績 (Runner Stats)
 * Phase195: Runnerプロフィール土台
 *
 * ユーザーの参加実績・PB・得意距離を算出。
 */

import { getDb } from "./db";

/**
 * ユーザーのRunner Statsを算出
 * @param {number} userId
 * @returns {Object} stats
 */
export function getRunnerStats(userId) {
  const db = getDb();

  // ユーザーにリンクされた全結果を取得
  const results = db.prepare(`
    SELECT
      ur.result_id,
      er.event_id, er.category, er.finish_time, er.result_year,
      er.distance_km, er.gender,
      e.title as event_title, e.event_date, e.prefecture, e.sport_type
    FROM user_results ur
    JOIN event_results er ON er.id = ur.result_id
    JOIN events e ON e.id = er.event_id
    WHERE ur.user_id = ? AND er.is_public = 1
    ORDER BY e.event_date DESC
  `).all(userId);

  if (results.length === 0) {
    return {
      totalEvents: 0,
      totalFinishes: 0,
      categories: {},
      pbs: [],
      prefectures: [],
      sportTypes: {},
      firstEventDate: null,
      latestEventDate: null,
      yearsActive: 0,
    };
  }

  // 参加大会数（ユニーク）
  const uniqueEvents = new Set(results.map((r) => r.event_id));

  // カテゴリ別集計
  const categories = {};
  for (const r of results) {
    const cat = normalizeCategory(r.category, r.distance_km);
    if (!categories[cat]) categories[cat] = { count: 0, label: cat };
    categories[cat].count++;
  }

  // PB（カテゴリ別最速タイム）
  const pbMap = {};
  for (const r of results) {
    if (!r.finish_time) continue;
    const cat = normalizeCategory(r.category, r.distance_km);
    const seconds = timeToSeconds(r.finish_time);
    if (seconds <= 0) continue;
    if (!pbMap[cat] || seconds < pbMap[cat].seconds) {
      pbMap[cat] = {
        category: cat,
        time: r.finish_time,
        seconds,
        eventTitle: r.event_title,
        eventDate: r.event_date,
        eventId: r.event_id,
      };
    }
  }
  const pbs = Object.values(pbMap).sort((a, b) => a.category.localeCompare(b.category));

  // 都道府県
  const prefCounts = {};
  for (const r of results) {
    if (r.prefecture) {
      prefCounts[r.prefecture] = (prefCounts[r.prefecture] || 0) + 1;
    }
  }
  const prefectures = Object.entries(prefCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  // スポーツタイプ別
  const sportTypes = {};
  for (const r of results) {
    const st = r.sport_type || "marathon";
    sportTypes[st] = (sportTypes[st] || 0) + 1;
  }

  // 期間
  const dates = results.filter((r) => r.event_date).map((r) => r.event_date).sort();
  const firstYear = dates.length > 0 ? new Date(dates[0]).getFullYear() : null;
  const lastYear = dates.length > 0 ? new Date(dates[dates.length - 1]).getFullYear() : null;

  return {
    totalEvents: uniqueEvents.size,
    totalFinishes: results.length,
    categories,
    pbs,
    prefectures,
    sportTypes,
    firstEventDate: dates[0] || null,
    latestEventDate: dates[dates.length - 1] || null,
    yearsActive: firstYear && lastYear ? lastYear - firstYear + 1 : 0,
  };
}

/**
 * Phase195: Runnerプロフィール（内部データ）
 */
export function getRunnerProfile(userId) {
  const stats = getRunnerStats(userId);
  const db = getDb();

  // ユーザー基本情報
  let user = null;
  try {
    user = db.prepare(`SELECT id, name, email, created_at FROM users WHERE id = ?`).get(userId);
  } catch {}

  // 得意距離（最多カテゴリ）
  const topCategories = Object.entries(stats.categories)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([cat, data]) => ({ category: cat, count: data.count }));

  return {
    userId,
    userName: user?.name || null,
    memberSince: user?.created_at || null,
    ...stats,
    topCategories,
    overallPB: stats.pbs.length > 0 ? stats.pbs.reduce((best, pb) =>
      !best || pb.seconds < best.seconds ? pb : best, null
    ) : null,
  };
}

// --- ヘルパー ---

function normalizeCategory(category, distanceKm) {
  if (category) {
    const c = category.toLowerCase();
    if (c.includes("フル") || c.includes("full") || c.includes("42")) return "フルマラソン";
    if (c.includes("ハーフ") || c.includes("half") || c.includes("21")) return "ハーフマラソン";
    if (c.includes("10km") || c.includes("10k")) return "10km";
    if (c.includes("5km") || c.includes("5k")) return "5km";
    return category;
  }
  if (distanceKm) {
    if (distanceKm >= 40 && distanceKm <= 44) return "フルマラソン";
    if (distanceKm >= 20 && distanceKm <= 22) return "ハーフマラソン";
    if (distanceKm >= 9 && distanceKm <= 11) return "10km";
    if (distanceKm >= 4 && distanceKm <= 6) return "5km";
    return `${distanceKm}km`;
  }
  return "その他";
}

function timeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}
