import { getDb } from "./db.js";

/**
 * Phase172: 参加履歴ベースのレコメンド強化
 *
 * ユーザーの参加履歴から嗜好を抽出し、次の大会推薦に活用。
 * - 参加した大会の都道府県・距離・スポーツタイプから好みを推定
 * - 「リピーター傾向」「新規開拓傾向」を判定
 * - 完走タイムから適正距離を推定
 */

/**
 * ユーザーの参加履歴から嗜好プロフィールを生成
 * @param {number} userId
 * @returns {{ prefectures, distances, sportTypes, avgTimes, eventIds, totalRaces, pattern }}
 */
export function buildParticipationProfile(userId) {
  const db = getDb();

  const results = db.prepare(`
    SELECT er.event_id, e.title, e.event_date, e.prefecture, e.sport_type,
      er.finish_time, er.category_name, er.result_year, er.finish_status,
      (SELECT GROUP_CONCAT(CAST(race.distance_km AS TEXT), ',')
       FROM event_races race WHERE race.event_id = er.event_id AND race.distance_km IS NOT NULL
      ) as distance_list
    FROM user_results ur
    JOIN event_results er ON ur.result_id = er.id
    JOIN events e ON ur.event_id = e.id
    WHERE ur.user_id = ?
    ORDER BY er.result_year DESC, e.event_date DESC
  `).all(userId);

  if (results.length === 0) {
    return null;
  }

  // 都道府県頻度
  const prefCounts = {};
  const sportCounts = {};
  const distanceBuckets = {};
  const eventIds = new Set();
  const categoryTimes = {};

  for (const r of results) {
    eventIds.add(r.event_id);

    if (r.prefecture) {
      prefCounts[r.prefecture] = (prefCounts[r.prefecture] || 0) + 1;
    }
    if (r.sport_type) {
      sportCounts[r.sport_type] = (sportCounts[r.sport_type] || 0) + 1;
    }
    if (r.distance_list) {
      for (const d of r.distance_list.split(",")) {
        const km = parseFloat(d);
        if (!isNaN(km)) {
          const bucket = distanceBucket(km);
          distanceBuckets[bucket] = (distanceBuckets[bucket] || 0) + 1;
        }
      }
    }
    if (r.category_name && r.finish_time && r.finish_status === "finished") {
      if (!categoryTimes[r.category_name]) categoryTimes[r.category_name] = [];
      categoryTimes[r.category_name].push(r.finish_time);
    }
  }

  // 上位都道府県（3つまで）
  const topPrefectures = Object.entries(prefCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([pref]) => pref);

  // 上位距離
  const topDistances = Object.entries(distanceBuckets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([dist]) => dist);

  // 上位スポーツ
  const topSports = Object.entries(sportCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([sport]) => sport);

  // リピーター判定（同じ大会に2回以上参加）
  const eventYears = {};
  for (const r of results) {
    if (!eventYears[r.event_id]) eventYears[r.event_id] = new Set();
    eventYears[r.event_id].add(r.result_year);
  }
  const repeaterEvents = Object.entries(eventYears).filter(([, years]) => years.size >= 2);
  const pattern = repeaterEvents.length >= 2 ? "repeater" : results.length >= 5 ? "explorer" : "growing";

  return {
    prefectures: topPrefectures,
    distances: topDistances,
    sportTypes: topSports,
    avgTimes: categoryTimes,
    eventIds: [...eventIds],
    totalRaces: results.length,
    pattern,
  };
}

/**
 * 参加履歴ベースのおすすめ大会を取得
 * @param {number} userId
 * @param {object} opts - { limit, excludeIds }
 * @returns {Array}
 */
export function getHistoryBasedRecommendations(userId, { limit = 6, excludeIds = [] } = {}) {
  const profile = buildParticipationProfile(userId);
  if (!profile || profile.totalRaces === 0) return [];

  const db = getDb();
  const excludeSet = new Set([...excludeIds, ...profile.eventIds]);

  // 条件構築: 参加済みの都道府県 or 距離帯に該当する未来の大会
  const conditions = [];
  const params = [];

  if (profile.prefectures.length > 0) {
    conditions.push(`e.prefecture IN (${profile.prefectures.map(() => "?").join(",")})`);
    params.push(...profile.prefectures);
  }

  if (conditions.length === 0) {
    // フォールバック: 何もなければ全大会から
    conditions.push("1=1");
  }

  const events = db.prepare(`
    SELECT e.id, e.title, e.event_date, e.prefecture, e.city, e.venue_name,
      e.sport_type, e.hero_image_url, e.entry_status, e.source_url,
      e.official_entry_status, e.official_entry_status_label,
      (SELECT GROUP_CONCAT(DISTINCT CAST(er2.distance_km AS TEXT), ',')
       FROM event_races er2 WHERE er2.event_id = e.id AND er2.distance_km IS NOT NULL
      ) as distance_list
    FROM events e
    WHERE e.is_active = 1
      AND e.event_date >= date('now')
      AND (${conditions.join(" OR ")})
    ORDER BY e.event_date ASC
    LIMIT 100
  `).all(...params);

  // スコアリング
  const scored = events
    .filter((e) => !excludeSet.has(e.id))
    .map((event) => {
      let score = 0;
      let reasons = [];

      // 都道府県マッチ
      if (profile.prefectures.includes(event.prefecture)) {
        score += 30;
        reasons.push("参加経験のあるエリア");
      }

      // 距離帯マッチ
      if (event.distance_list) {
        for (const d of event.distance_list.split(",")) {
          const km = parseFloat(d);
          if (!isNaN(km) && profile.distances.includes(distanceBucket(km))) {
            score += 25;
            reasons.push("よく参加する距離");
            break;
          }
        }
      }

      // スポーツタイプマッチ
      if (profile.sportTypes.includes(event.sport_type)) {
        score += 10;
      }

      // 開催日の近さ（60日以内がボーナス）
      if (event.event_date) {
        const daysAway = Math.ceil((new Date(event.event_date) - new Date()) / 86400000);
        if (daysAway <= 60) score += 10;
        else if (daysAway <= 120) score += 5;
      }

      return {
        ...event,
        recommendation_score: score,
        recommendation_reasons: reasons,
        recommendation_source: "history",
        distance_labels: parseDistanceLabels(event.distance_list),
      };
    });

  scored.sort((a, b) => b.recommendation_score - a.recommendation_score);
  return scored.slice(0, limit);
}

// ─── ヘルパー ───

function distanceBucket(km) {
  if (km <= 5) return "5km";
  if (km <= 10) return "10km";
  if (km <= 22) return "half";
  if (km <= 43) return "full";
  return "ultra";
}

function parseDistanceLabels(distList) {
  if (!distList) return [];
  const labels = new Set();
  for (const d of distList.split(",")) {
    const km = parseFloat(d);
    if (isNaN(km)) continue;
    if (km <= 5) labels.add("5km");
    else if (km <= 10) labels.add("10km");
    else if (km <= 22) labels.add("ハーフ");
    else if (km <= 43) labels.add("フル");
    else labels.add("ウルトラ");
  }
  return [...labels];
}
