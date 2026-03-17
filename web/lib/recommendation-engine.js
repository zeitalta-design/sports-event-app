/**
 * Phase88: 統合レコメンドエンジン
 *
 * プロフィール + 行動履歴 + 人気度を組み合わせて
 * ユーザーに合った大会をスコアリング・推薦する。
 *
 * サーバーサイド専用（DB依存）。
 */

import { getDb } from "@/lib/db";
import { getAllEventActivityMetrics } from "@/lib/event-activity";
import { calculatePopularityScore } from "@/lib/event-popularity";

// ── スコアリング重み ──

const WEIGHTS = {
  distance: 20,        // 距離マッチ
  prefecture: 15,      // 地域マッチ
  popularity: 12,      // 人気度
  freshness: 12,       // 開催日の近さ
  cooccurrence: 11,    // 閲覧共起
  level: 10,           // レベル適性
  history: 10,         // Phase206: 参加履歴ベース
  season: 10,          // Phase206: 季節マッチ
};

// 距離キー → distance_km 範囲マッピング
const DISTANCE_KM_RANGES = {
  "5km": [0, 5],
  "10km": [5.1, 10],
  "half": [20, 22],
  "full": [42, 43],
  "ultra": [43.1, 999],
};

// レベル別の特徴キーワード
const LEVEL_FEATURE_KEYWORDS = {
  beginner: ["初心者", "初めて", "制限時間ゆるめ", "ファンラン", "完走", "初心者歓迎"],
  intermediate: ["ハーフ", "10km", "完走証", "タイム計測"],
  advanced: ["記録", "公認", "日本陸連", "ペーサー", "BQ", "サブ"],
};

// ── メインAPI ──

/**
 * パーソナライズされたおすすめ大会を取得
 *
 * @param {object} params
 * @param {object} params.profile - { distances, prefectures, level, goals }
 * @param {number[]} [params.excludeIds=[]] - 除外する大会ID
 * @param {number} [params.limit=10]
 * @param {string} [params.sessionId] - 共起計算用セッションID
 * @returns {Array<object>} スコア付き大会配列
 */
export function getPersonalizedRecommendations({
  profile,
  excludeIds = [],
  limit = 10,
  sessionId = null,
}) {
  try {
    const db = getDb();

    // 1. 対象大会を取得（未来開催 + アクティブ + 受付可能系）
    const events = db.prepare(`
      SELECT e.id, e.title, e.event_date, e.entry_end_date,
             e.entry_start_date, e.prefecture, e.city, e.venue_name,
             e.entry_status, e.sport_type, e.hero_image_url, e.description,
             e.source_url, e.entry_url,
             e.official_entry_status, e.official_entry_status_label,
             e.official_status_confidence, e.official_checked_at,
             (SELECT COUNT(*) FROM favorites f WHERE f.event_id = e.id) as fav_count,
             (SELECT GROUP_CONCAT(d, ',') FROM (
               SELECT DISTINCT CAST(er.distance_km AS TEXT) as d
               FROM event_races er WHERE er.event_id = e.id AND er.distance_km IS NOT NULL
             )) as distance_list,
             md.features_json
      FROM events e
      LEFT JOIN marathon_details md ON md.event_id = e.id
      WHERE e.is_active = 1
        AND e.event_date >= date('now')
        AND (
          e.official_entry_status IN ('open', 'closing_soon', 'capacity_warning')
          OR (e.official_entry_status IS NULL AND e.entry_status IN ('open', 'upcoming'))
        )
      ORDER BY e.event_date ASC
      LIMIT 200
    `).all();

    if (events.length === 0) return [];

    // 2. 除外IDセット
    const excludeSet = new Set(excludeIds);

    // 3. 行動ログ取得
    const activityMap = getAllEventActivityMetrics({ days: 30, limit: 500 });

    // 4. 共起データ取得（セッションがあれば）
    const cooccurrenceMap = sessionId
      ? getSessionCooccurrences(db, sessionId)
      : new Map();

    // 5. 各大会をスコアリング
    const scored = events
      .filter((e) => !excludeSet.has(e.id))
      .map((event) => {
        const breakdown = scoreEventForProfile(event, profile, {
          activityMap,
          cooccurrenceMap,
        });
        return {
          ...event,
          recommendation_score: breakdown.total,
          recommendation_breakdown: breakdown,
          recommendation_source: "personalized",
        };
      });

    // 6. スコア降順ソート
    scored.sort((a, b) => b.recommendation_score - a.recommendation_score);

    // 7. distance_labels を付与して返却
    return scored.slice(0, limit).map((e) => ({
      ...e,
      distance_labels: parseDistanceLabels(e.distance_list),
    }));
  } catch (err) {
    console.error("getPersonalizedRecommendations error:", err);
    return [];
  }
}

/**
 * 大会とプロフィールの適合スコアを計算
 *
 * @param {object} event - 大会データ
 * @param {object} profile - { distances, prefectures, level, goals }
 * @param {object} [ctx] - { activityMap, cooccurrenceMap }
 * @returns {{ total, distance, prefecture, popularity, freshness, cooccurrence, level }}
 */
export function scoreEventForProfile(event, profile, ctx = {}) {
  const breakdown = {
    distance: 0,
    prefecture: 0,
    popularity: 0,
    freshness: 0,
    cooccurrence: 0,
    level: 0,
    history: 0,
    season: 0,
    total: 0,
  };

  if (!profile) {
    // プロフィールなし → 人気度 + 鮮度のみ
    breakdown.popularity = calcPopularityScore(event, ctx.activityMap);
    breakdown.freshness = calcFreshnessScore(event);
    breakdown.total = breakdown.popularity + breakdown.freshness;
    return breakdown;
  }

  // 距離マッチ
  breakdown.distance = calcDistanceScore(event, profile.distances);

  // 地域マッチ
  breakdown.prefecture = calcPrefectureScore(event, profile.prefectures);

  // 人気度
  breakdown.popularity = calcPopularityScore(event, ctx.activityMap);

  // 鮮度（開催日の近さ）
  breakdown.freshness = calcFreshnessScore(event);

  // 共起
  breakdown.cooccurrence = calcCooccurrenceScore(event, ctx.cooccurrenceMap);

  // レベル適性
  breakdown.level = calcLevelScore(event, profile.level);

  // Phase206: 参加履歴ベース（同じ地域・距離に参加歴あればボーナス）
  breakdown.history = calcHistoryScore(event, ctx.participationHistory);

  // Phase206: 季節マッチ（過去に参加した季節と同じ季節ならボーナス）
  breakdown.season = calcSeasonScore(event, profile.preferredSeasons);

  breakdown.total = Object.keys(WEIGHTS).reduce(
    (sum, key) => sum + (breakdown[key] || 0),
    0
  );

  return breakdown;
}

// ── 個別スコア計算 ──

function calcDistanceScore(event, profileDistances) {
  if (!profileDistances || profileDistances.length === 0) return 0;
  if (!event.distance_list) return 0;

  const eventKms = event.distance_list.split(",").map(Number).filter(Boolean);
  if (eventKms.length === 0) return 0;

  // イベントの距離がプロフィールの希望距離にマッチするか
  let bestMatch = 0;
  for (const distKey of profileDistances) {
    const range = DISTANCE_KM_RANGES[distKey];
    if (!range) continue;
    for (const km of eventKms) {
      if (km >= range[0] && km <= range[1]) {
        bestMatch = WEIGHTS.distance; // 完全マッチ
        break;
      }
    }
    if (bestMatch > 0) break;
  }

  // 部分マッチ: 希望距離と近い距離がある場合
  if (bestMatch === 0) {
    const targetKms = profileDistances.map((d) => {
      const r = DISTANCE_KM_RANGES[d];
      return r ? (r[0] + r[1]) / 2 : null;
    }).filter(Boolean);

    if (targetKms.length > 0) {
      const minDiff = Math.min(
        ...eventKms.flatMap((ek) => targetKms.map((tk) => Math.abs(ek - tk)))
      );
      if (minDiff < 5) bestMatch = Math.round(WEIGHTS.distance * 0.5);
      else if (minDiff < 15) bestMatch = Math.round(WEIGHTS.distance * 0.2);
    }
  }

  return bestMatch;
}

function calcPrefectureScore(event, profilePrefectures) {
  if (!profilePrefectures || profilePrefectures.length === 0) return 0;
  if (!event.prefecture) return 0;

  if (profilePrefectures.includes(event.prefecture)) {
    return WEIGHTS.prefecture;
  }

  // 同じ地方ならば部分スコア
  const region = getRegion(event.prefecture);
  const profileRegions = profilePrefectures.map(getRegion);
  if (region && profileRegions.includes(region)) {
    return Math.round(WEIGHTS.prefecture * 0.4);
  }

  return 0;
}

function calcPopularityScore(event, activityMap) {
  if (!activityMap) return 0;
  const activity = activityMap.get(event.id);
  if (!activity) {
    // お気に入り数をフォールバック
    return event.fav_count > 0
      ? Math.min(WEIGHTS.popularity, Math.round(event.fav_count * 2))
      : 0;
  }
  const { popularity_score } = calculatePopularityScore(activity);
  return Math.round((popularity_score / 100) * WEIGHTS.popularity);
}

function calcFreshnessScore(event) {
  if (!event.event_date) return 0;
  const eventDate = new Date(event.event_date);
  const now = new Date();
  const diffDays = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 0;
  if (diffDays <= 30) return WEIGHTS.freshness;
  if (diffDays <= 60) return Math.round(WEIGHTS.freshness * 0.8);
  if (diffDays <= 90) return Math.round(WEIGHTS.freshness * 0.6);
  if (diffDays <= 180) return Math.round(WEIGHTS.freshness * 0.3);
  return Math.round(WEIGHTS.freshness * 0.1);
}

function calcCooccurrenceScore(event, cooccurrenceMap) {
  if (!cooccurrenceMap || cooccurrenceMap.size === 0) return 0;
  const count = cooccurrenceMap.get(event.id) || 0;
  if (count === 0) return 0;
  // 共起回数を対数スケールで正規化
  return Math.min(WEIGHTS.cooccurrence, Math.round(Math.log2(count + 1) * 5));
}

function calcLevelScore(event, level) {
  if (!level) return 0;
  const keywords = LEVEL_FEATURE_KEYWORDS[level] || [];
  if (keywords.length === 0) return 0;

  // features_json からキーワードマッチ
  let text = event.description || "";
  if (event.features_json) {
    try {
      const features = JSON.parse(event.features_json);
      if (Array.isArray(features)) {
        text += " " + features.join(" ");
      }
    } catch {}
  }

  if (!text) return 0;

  const matchCount = keywords.filter((kw) => text.includes(kw)).length;
  if (matchCount === 0) return 0;
  return Math.min(WEIGHTS.level, Math.round((matchCount / keywords.length) * WEIGHTS.level));
}

// ── ヘルパー ──

function getSessionCooccurrences(db, sessionId) {
  const map = new Map();
  try {
    // このセッションで閲覧した大会と共起関係のある大会を取得
    const viewedIds = db.prepare(`
      SELECT DISTINCT marathon_id
      FROM marathon_view_events
      WHERE session_id = ?
      AND viewed_at > datetime('now', '-30 days')
      LIMIT 20
    `).all(sessionId).map((r) => r.marathon_id);

    if (viewedIds.length === 0) return map;

    const ph = viewedIds.map(() => "?").join(",");
    const rows = db.prepare(`
      SELECT marathon_id AS target_id, COUNT(*) AS cnt
      FROM marathon_view_events
      WHERE referrer_marathon_id IN (${ph})
        AND marathon_id NOT IN (${ph})
        AND viewed_at > datetime('now', '-90 days')
      GROUP BY marathon_id
    `).all(...viewedIds, ...viewedIds);

    for (const row of rows) {
      map.set(row.target_id, (map.get(row.target_id) || 0) + row.cnt);
    }
  } catch {}
  return map;
}

function parseDistanceLabels(distanceList) {
  if (!distanceList) return [];
  const labels = [];
  const seen = new Set();
  for (const d of distanceList.split(",")) {
    const km = Number(d);
    if (!km) continue;
    const label = getDistanceLabel(km);
    if (label && !seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  return labels;
}

function getDistanceLabel(km) {
  if (!km || km <= 0) return null;
  if (km >= 42 && km <= 43) return "フル";
  if (km >= 20 && km <= 22) return "ハーフ";
  if (km > 5 && km <= 10) return "10km";
  if (km > 0 && km <= 5) return "5km";
  if (km > 43) return "ウルトラ";
  return null;
}

// 都道府県 → 地方
const REGION_MAP = {
  北海道: "北海道",
  青森県: "東北", 岩手県: "東北", 宮城県: "東北", 秋田県: "東北", 山形県: "東北", 福島県: "東北",
  茨城県: "関東", 栃木県: "関東", 群馬県: "関東", 埼玉県: "関東", 千葉県: "関東", 東京都: "関東", 神奈川県: "関東",
  新潟県: "中部", 富山県: "中部", 石川県: "中部", 福井県: "中部", 山梨県: "中部", 長野県: "中部", 岐阜県: "中部", 静岡県: "中部", 愛知県: "中部",
  三重県: "近畿", 滋賀県: "近畿", 京都府: "近畿", 大阪府: "近畿", 兵庫県: "近畿", 奈良県: "近畿", 和歌山県: "近畿",
  鳥取県: "中国", 島根県: "中国", 岡山県: "中国", 広島県: "中国", 山口県: "中国",
  徳島県: "四国", 香川県: "四国", 愛媛県: "四国", 高知県: "四国",
  福岡県: "九州", 佐賀県: "九州", 長崎県: "九州", 熊本県: "九州", 大分県: "九州", 宮崎県: "九州", 鹿児島県: "九州", 沖縄県: "九州",
};

function getRegion(prefecture) {
  return REGION_MAP[prefecture] || null;
}

// Phase206: 参加履歴スコア
function calcHistoryScore(event, participationHistory) {
  if (!participationHistory || participationHistory.length === 0) return 0;
  let score = 0;

  // 同じ地域に参加歴あれば +50%
  const region = getRegion(event.prefecture);
  if (region && participationHistory.some((h) => getRegion(h.prefecture) === region)) {
    score += WEIGHTS.history * 0.5;
  }

  // 同じ距離帯に参加歴あれば +50%
  if (event.distance_list) {
    const eventKms = event.distance_list.split(",").map(Number).filter(Boolean);
    const hasMatchingDistance = eventKms.some((km) => {
      return participationHistory.some((h) => {
        if (!h.distance_km) return false;
        return Math.abs(km - h.distance_km) < 5;
      });
    });
    if (hasMatchingDistance) score += WEIGHTS.history * 0.5;
  }

  return Math.min(score, WEIGHTS.history);
}

// Phase206: 季節マッチスコア
function calcSeasonScore(event, preferredSeasons) {
  if (!preferredSeasons || preferredSeasons.length === 0) return 0;
  if (!event.event_date) return 0;

  try {
    const month = new Date(event.event_date).getMonth() + 1;
    const season = monthToSeason(month);
    if (preferredSeasons.includes(season)) {
      return WEIGHTS.season;
    }
    // 隣接季節なら半分
    const adjacent = getAdjacentSeasons(season);
    if (preferredSeasons.some((s) => adjacent.includes(s))) {
      return WEIGHTS.season * 0.5;
    }
  } catch {}
  return 0;
}

function monthToSeason(month) {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

function getAdjacentSeasons(season) {
  const map = {
    spring: ["winter", "summer"],
    summer: ["spring", "autumn"],
    autumn: ["summer", "winter"],
    winter: ["autumn", "spring"],
  };
  return map[season] || [];
}
