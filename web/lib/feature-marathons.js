/**
 * 比較軸ページ用の大会抽出サービス
 *
 * 各比較軸に該当する大会をルールベースで判定・抽出する。
 * marathon_details + events + event_races の情報を組み合わせて判定。
 */

import { getDb } from "@/lib/db";
import { getFeatureDefinition, getAllFeatureDefinitions } from "@/lib/feature-definitions";

// ─── 制限時間パーサー ────────────────────────

/**
 * "7時間", "6時間30分", "90分", "3時間" → 分数に変換
 */
function parseTimeLimitMinutes(str) {
  if (!str) return null;
  const s = String(str).trim();

  // "X時間Y分" パターン
  const hm = s.match(/(\d+)\s*時間\s*(\d+)?\s*分?/);
  if (hm) {
    const hours = parseInt(hm[1], 10);
    const mins = hm[2] ? parseInt(hm[2], 10) : 0;
    return hours * 60 + mins;
  }

  // "X分" パターン
  const mOnly = s.match(/^(\d+)\s*分$/);
  if (mOnly) return parseInt(mOnly[1], 10);

  return null;
}

/**
 * access_info から徒歩分数を抽出
 * "徒歩約12分" → 12, "徒歩5分" → 5
 */
function extractWalkMinutes(text) {
  if (!text) return [];
  const matches = text.matchAll(/徒歩[約]?(\d+)分/g);
  return [...matches].map((m) => parseInt(m[1], 10));
}

// ─── 共通: 全大会のベースデータ取得 ─────────────

function getAllEventsWithDetails(db) {
  return db
    .prepare(
      `SELECT
        e.id, e.title, e.event_date, e.event_month, e.prefecture, e.city,
        e.venue_name, e.entry_status, e.source_url, e.description,
        md.features_json, md.level_labels_json, md.time_limits_json,
        md.access_info, md.summary, md.tagline, md.measurement_method,
        md.course_info, md.notes, md.venue_address,
        md.organizer_name
       FROM events e
       LEFT JOIN marathon_details md ON md.marathon_id = e.id
       WHERE e.is_active = 1
       ORDER BY e.event_date DESC`
    )
    .all();
}

function getEventRaces(db, eventIds) {
  if (eventIds.length === 0) return new Map();
  const ph = eventIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT event_id, race_name, race_type, distance_km, time_limit
       FROM event_races
       WHERE event_id IN (${ph})`
    )
    .all(...eventIds);

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.event_id)) map.set(row.event_id, []);
    map.get(row.event_id).push(row);
  }
  return map;
}

function getDistanceLabels(races) {
  const labels = new Set();
  for (const r of races) {
    const km = r.distance_km;
    if (!km) continue;
    if (km >= 42 && km <= 43) labels.add("フル");
    else if (km >= 20 && km <= 22) labels.add("ハーフ");
    else if (km > 5 && km <= 10) labels.add("10km");
    else if (km > 0 && km <= 5) labels.add("5km");
    else if (km > 43) labels.add("ウルトラ");
  }
  return [...labels];
}

function safeParseJson(str) {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── 各軸の判定ロジック ──────────────────────

const MATCHERS = {
  "beginner-friendly-marathons": matchBeginnerFriendly,
  "pb-friendly-marathons": matchPbFriendly,
  "station-access-marathons": matchStationAccess,
  "long-time-limit-marathons": matchLongTimeLimit,
};

/**
 * 初心者向け判定
 */
function matchBeginnerFriendly(event, races) {
  const reasons = [];
  let score = 0;

  // level_labels_json
  const levels = safeParseJson(event.level_labels_json);
  if (levels.some((l) => /初心者/.test(l))) {
    reasons.push("初心者向け");
    score += 40;
  }

  // features_json
  const features = safeParseJson(event.features_json);
  for (const f of features) {
    if (/初心者|ビギナー|ファンラン/.test(f)) {
      if (!reasons.includes("初心者向け")) reasons.push("初心者向け");
      score += 20;
      break;
    }
  }

  // 制限時間の長さ（フル6時間以上、ハーフ3時間以上）
  for (const race of races) {
    const mins = parseTimeLimitMinutes(race.time_limit);
    if (!mins) continue;
    if (race.race_type === "full" && mins >= 360) {
      reasons.push(`フル制限${race.time_limit}`);
      score += 30;
      break;
    }
    if (race.race_type === "half" && mins >= 180) {
      reasons.push(`ハーフ制限${race.time_limit}`);
      score += 25;
      break;
    }
  }

  // time_limits_json from marathon_details
  const timeLimits = safeParseJson(event.time_limits_json);
  for (const tl of timeLimits) {
    const mins = parseTimeLimitMinutes(tl.limit);
    if (!mins) continue;
    if (/フル|マラソン/i.test(tl.name) && mins >= 360 && !reasons.some((r) => r.includes("フル制限"))) {
      reasons.push(`フル制限${tl.limit}`);
      score += 30;
    }
  }

  // テキスト検索
  const searchText = [event.summary, event.tagline, event.description, event.notes].filter(Boolean).join(" ");
  if (/初心者[歓も]?[迎OK]|初めて[のでも]|初マラソン|ビギナー/.test(searchText)) {
    if (!reasons.includes("初心者向け")) reasons.push("初心者歓迎");
    score += 15;
  }

  // 5km/10kmの短距離種目あり
  if (races.some((r) => r.distance_km && r.distance_km <= 10)) {
    reasons.push("短距離種目あり");
    score += 10;
  }

  return { score, reasons };
}

/**
 * PB狙い判定
 */
function matchPbFriendly(event, races) {
  const reasons = [];
  let score = 0;

  const features = safeParseJson(event.features_json);
  const searchText = [event.summary, event.tagline, event.description, event.course_info].filter(Boolean).join(" ");

  // 公認
  if (features.some((f) => /公認|陸連/.test(f)) || /陸連公認|日本陸連|JAAF/.test(searchText)) {
    reasons.push("陸連公認");
    score += 40;
  }

  // ペーサー
  if (features.some((f) => /ペーサー|ペースメーカー/.test(f)) || /ペーサー|ペースメーカー/.test(searchText)) {
    reasons.push("ペーサーあり");
    score += 30;
  }

  // フラット / 高速
  if (features.some((f) => /フラット|高速|高低差/.test(f)) || /フラット|高速コース|高低差(が)?少/.test(searchText)) {
    reasons.push("フラットコース");
    score += 25;
  }

  // チップ計測
  if (features.some((f) => /チップ計測/.test(f)) || event.measurement_method?.includes("チップ")) {
    reasons.push("チップ計測");
    score += 15;
  }

  // 記録狙い系
  if (features.some((f) => /記録狙い|記録更新|PB/.test(f)) || /記録狙い|自己ベスト|PB|記録更新|タイムを狙/.test(searchText)) {
    reasons.push("記録狙い");
    score += 20;
  }

  // フル or ハーフがある（PB狙いには距離が明確であること）
  if (races.some((r) => r.race_type === "full" || r.race_type === "half")) {
    score += 5;
  }

  // タイトルに「公認」
  if (/公認/.test(event.title)) {
    if (!reasons.includes("陸連公認")) reasons.push("公認大会");
    score += 20;
  }

  return { score, reasons };
}

/**
 * 駅近判定
 */
function matchStationAccess(event, races) {
  const reasons = [];
  let score = 0;

  // access_info の徒歩分数
  const walkMins = extractWalkMinutes(event.access_info);
  if (walkMins.length > 0) {
    const minWalk = Math.min(...walkMins);
    if (minWalk <= 5) {
      reasons.push(`駅徒歩${minWalk}分`);
      score += 50;
    } else if (minWalk <= 10) {
      reasons.push(`駅徒歩${minWalk}分`);
      score += 35;
    } else if (minWalk <= 15) {
      reasons.push(`駅徒歩${minWalk}分`);
      score += 20;
    }
  }

  // テキスト検索
  const searchText = [event.access_info, event.summary, event.description, event.venue_address].filter(Boolean).join(" ");
  if (/駅近|駅前|駅直結|アクセス[良好抜群]|交通至便/.test(searchText)) {
    if (reasons.length === 0) reasons.push("アクセス良好");
    score += 20;
  }

  // 駅から徒歩の記載がある（access_info以外）
  if (reasons.length === 0) {
    const allText = [event.description, event.summary].filter(Boolean).join(" ");
    const textWalk = [...allText.matchAll(/徒歩[約]?(\d+)分/g)].map((m) => parseInt(m[1], 10));
    if (textWalk.length > 0) {
      const minW = Math.min(...textWalk);
      if (minW <= 15) {
        reasons.push(`駅徒歩約${minW}分`);
        score += 15;
      }
    }
  }

  return { score, reasons };
}

/**
 * 制限時間が長い判定
 */
function matchLongTimeLimit(event, races) {
  const reasons = [];
  let score = 0;

  // event_races の time_limit
  for (const race of races) {
    const mins = parseTimeLimitMinutes(race.time_limit);
    if (!mins) continue;

    if (race.race_type === "full") {
      if (mins >= 420) {
        reasons.push(`フル${race.time_limit}`);
        score += 50;
      } else if (mins >= 390) {
        reasons.push(`フル${race.time_limit}`);
        score += 35;
      }
    } else if (race.race_type === "half") {
      if (mins >= 180) {
        reasons.push(`ハーフ${race.time_limit}`);
        score += 40;
      }
    } else if (race.race_type === "10k") {
      if (mins >= 100) {
        reasons.push(`10km ${race.time_limit}`);
        score += 20;
      }
    }
  }

  // time_limits_json from marathon_details
  if (reasons.length === 0) {
    const timeLimits = safeParseJson(event.time_limits_json);
    for (const tl of timeLimits) {
      const mins = parseTimeLimitMinutes(tl.limit);
      if (!mins) continue;
      if (/フル|マラソン/i.test(tl.name) && mins >= 390) {
        reasons.push(`フル${tl.limit}`);
        score += 40;
      } else if (/ハーフ/i.test(tl.name) && mins >= 180) {
        reasons.push(`ハーフ${tl.limit}`);
        score += 30;
      }
    }
  }

  return { score, reasons };
}

// ─── メイン関数 ──────────────────────────

/**
 * 比較軸に該当する大会一覧を取得
 *
 * @param {string} slug - 比較軸slug
 * @param {object} [options]
 * @param {number} [options.limit=50]
 * @returns {{ events: Array, definition: object, total: number }}
 */
export function getFeatureMarathons(slug, options = {}) {
  const { limit = 50 } = options;

  const definition = getFeatureDefinition(slug);
  if (!definition) return { events: [], definition: null, total: 0 };

  const matcher = MATCHERS[slug];
  if (!matcher) return { events: [], definition, total: 0 };

  const db = getDb();
  const allEvents = getAllEventsWithDetails(db);
  const eventIds = allEvents.map((e) => e.id);
  const racesMap = getEventRaces(db, eventIds);

  // 各大会を判定
  const matched = [];
  for (const event of allEvents) {
    const races = racesMap.get(event.id) || [];
    const { score, reasons } = matcher(event, races);

    if (score > 0 && reasons.length > 0) {
      matched.push({
        id: event.id,
        title: event.title,
        event_date: event.event_date,
        event_month: event.event_month,
        prefecture: event.prefecture,
        city: event.city,
        venue_name: event.venue_name,
        entry_status: event.entry_status,
        source_url: event.source_url,
        distance_labels: getDistanceLabels(races),
        feature_score: score,
        reason_labels: reasons,
      });
    }
  }

  // スコア降順
  matched.sort((a, b) => b.feature_score - a.feature_score);

  return {
    events: matched.slice(0, limit),
    definition,
    total: matched.length,
  };
}

/**
 * 全比較軸の大会件数サマリーを取得（トップページ導線用）
 */
export function getFeatureSummaries() {
  const definitions = getAllFeatureDefinitions();
  return definitions.map((def) => {
    const result = getFeatureMarathons(def.slug, { limit: 0 });
    return {
      ...def,
      eventCount: result.total,
    };
  });
}
