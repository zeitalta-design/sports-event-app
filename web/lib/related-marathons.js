/**
 * 関連大会推薦サービス
 *
 * 大会属性ベースのスコアリングで関連大会を推薦する。
 * 将来的に閲覧共起・お気に入り共起・協調フィルタリング等に拡張可能な設計。
 *
 * strategy:
 *   "attribute"     — 属性類似ベース（Phase25 現在のデフォルト）
 *   "cooccurrence"  — 閲覧/お気に入り共起ベース（将来）
 *   "hybrid"        — 複数戦略のブレンド（将来）
 */

import { getDb } from "@/lib/db";
import {
  PREFECTURE_SLUGS,
  PREFECTURE_NAME_TO_SLUG,
  REGION_GROUPS,
} from "@/lib/seo-mappings";

// ─── 定数 ─────────────────────────────────

const DEFAULT_LIMIT = 6;

/** スコア重み */
const SCORE = {
  SAME_PREFECTURE: 40,
  SAME_REGION: 18,
  SAME_DISTANCE_CATEGORY: 35,
  SAME_MONTH: 18,
  NEARBY_MONTH: 10, // 2〜3ヶ月差
  SAME_DAY_PENALTY: -12,
  POPULARITY_MAX: 15,
};

/** 距離カテゴリ定義（km範囲） */
const DISTANCE_CATEGORIES = {
  full: { min: 42, max: 43 },
  half: { min: 20, max: 22 },
  "10km": { min: 5.1, max: 10 },
  "5km": { min: 0, max: 5 },
  ultra: { min: 43.1, max: 999 },
};

// ─── 地域ユーティリティ ──────────────────────

/**
 * 都道府県名 → 地域ブロック名
 * @param {string} prefecture - 都道府県名（例: "東京都"）
 * @returns {string|null}
 */
export function getRegionForPrefecture(prefecture) {
  if (!prefecture) return null;
  const slug = PREFECTURE_NAME_TO_SLUG[prefecture];
  if (!slug) return null;
  for (const group of REGION_GROUPS) {
    if (group.slugs.includes(slug)) {
      return group.label;
    }
  }
  return null;
}

/**
 * 同一地域の都道府県名リストを取得
 * @param {string} prefecture - 都道府県名
 * @returns {string[]}
 */
function getSameRegionPrefectures(prefecture) {
  if (!prefecture) return [];
  const slug = PREFECTURE_NAME_TO_SLUG[prefecture];
  if (!slug) return [];
  for (const group of REGION_GROUPS) {
    if (group.slugs.includes(slug)) {
      return group.slugs.map((s) => PREFECTURE_SLUGS[s]).filter(Boolean);
    }
  }
  return [];
}

// ─── 距離カテゴリユーティリティ ──────────────

/**
 * 距離km値から距離カテゴリを判定
 * @param {number} km
 * @returns {string|null}
 */
export function getDistanceCategory(km) {
  if (!km || km <= 0) return null;
  if (km >= 42 && km <= 43) return "full";
  if (km >= 20 && km <= 22) return "half";
  if (km > 5 && km <= 10) return "10km";
  if (km > 0 && km <= 5) return "5km";
  if (km > 43) return "ultra";
  return null;
}

/**
 * レース配列から主要距離カテゴリ一覧を取得
 * @param {Array} races - event_racesの配列
 * @returns {string[]} - カテゴリ名の配列
 */
function getDistanceCategories(races) {
  if (!races || races.length === 0) return [];
  const cats = new Set();
  for (const race of races) {
    const cat = getDistanceCategory(race.distance_km);
    if (cat) cats.add(cat);
  }
  return [...cats];
}

// ─── 月差ユーティリティ ──────────────────────

/**
 * 2つの月の差（循環考慮、0〜6）
 * @param {number} m1
 * @param {number} m2
 * @returns {number}
 */
function monthDiff(m1, m2) {
  if (!m1 || !m2) return 12;
  const diff = Math.abs(m1 - m2);
  return Math.min(diff, 12 - diff);
}

/**
 * 2つの日付の日差
 * @param {string} d1
 * @param {string} d2
 * @returns {number|null}
 */
function dayDiff(d1, d2) {
  if (!d1 || !d2) return null;
  try {
    const t1 = new Date(d1).getTime();
    const t2 = new Date(d2).getTime();
    if (isNaN(t1) || isNaN(t2)) return null;
    return Math.abs(t1 - t2) / (1000 * 60 * 60 * 24);
  } catch {
    return null;
  }
}

// ─── 人気指標 ────────────────────────────────

/**
 * お気に入り数をイベントIDごとに取得
 * @param {object} db
 * @param {number[]} eventIds
 * @returns {Map<number, number>}
 */
function getFavoriteCounts(db, eventIds) {
  if (eventIds.length === 0) return new Map();
  const placeholders = eventIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT event_id, COUNT(*) as cnt FROM favorites WHERE event_id IN (${placeholders}) GROUP BY event_id`
    )
    .all(...eventIds);
  const map = new Map();
  for (const row of rows) {
    map.set(row.event_id, row.cnt);
  }
  return map;
}

// ─── スコアリング ────────────────────────────

/**
 * 基準大会に対する候補大会の関連スコアを計算
 * @param {object} base - 基準大会
 * @param {object} candidate - 候補大会
 * @param {object} options - { baseCats, favoriteCount, maxFavorites }
 * @returns {{ score: number, reasons: string[] }}
 */
function calcScore(base, candidate, options = {}) {
  const { baseCats = [], favoriteCount = 0, maxFavorites = 1 } = options;
  let score = 0;
  const reasons = [];

  // 同一都道府県
  if (base.prefecture && candidate.prefecture === base.prefecture) {
    score += SCORE.SAME_PREFECTURE;
    reasons.push("同じ都道府県");
  }
  // 同一地域ブロック（都道府県が違う場合のみ）
  else if (base.prefecture && candidate.prefecture) {
    const baseRegion = getRegionForPrefecture(base.prefecture);
    const candRegion = getRegionForPrefecture(candidate.prefecture);
    if (baseRegion && baseRegion === candRegion) {
      score += SCORE.SAME_REGION;
      reasons.push("同じエリア");
    }
  }

  // 距離カテゴリ
  const candCats = candidate._distanceCategories || [];
  const commonCats = baseCats.filter((c) => candCats.includes(c));
  if (commonCats.length > 0) {
    score += SCORE.SAME_DISTANCE_CATEGORY;
    reasons.push("同じ距離");
  }

  // 開催月
  const baseMonth = base.event_month ? parseInt(base.event_month) : null;
  const candMonth = candidate.event_month
    ? parseInt(candidate.event_month)
    : null;
  if (baseMonth && candMonth) {
    const md = monthDiff(baseMonth, candMonth);
    if (md === 0) {
      score += SCORE.SAME_MONTH;
      reasons.push("同じ月に開催");
    } else if (md <= 1) {
      score += SCORE.SAME_MONTH;
      reasons.push("開催時期が近い");
    } else if (md <= 3) {
      score += SCORE.NEARBY_MONTH;
      reasons.push("開催時期が近い");
    }
  }

  // 同日開催ペナルティ
  const dd = dayDiff(base.event_date, candidate.event_date);
  if (dd !== null && dd === 0) {
    score += SCORE.SAME_DAY_PENALTY;
  }

  // 人気補正（お気に入り数ベース）
  if (favoriteCount > 0 && maxFavorites > 0) {
    const popScore = Math.round(
      (favoriteCount / maxFavorites) * SCORE.POPULARITY_MAX
    );
    score += Math.min(popScore, SCORE.POPULARITY_MAX);
    if (favoriteCount >= 3) {
      reasons.push("人気大会");
    }
  }

  return { score, reasons };
}

// ─── メインAPI ───────────────────────────────

/**
 * 関連大会を取得する
 *
 * @param {number} marathonId - 基準大会ID
 * @param {object} [options={}]
 * @param {number} [options.limit=6] - 取得件数
 * @param {string} [options.strategy="attribute"] - 推薦戦略（将来拡張用）
 * @returns {{ base: object, related: Array<object> }}
 */
export function getRelatedMarathons(marathonId, options = {}) {
  const { limit = DEFAULT_LIMIT, strategy = "attribute" } = options;

  const db = getDb();

  // 基準大会を取得
  const base = db
    .prepare("SELECT * FROM events WHERE id = ? AND is_active = 1")
    .get(marathonId);
  if (!base) return { base: null, related: [] };

  // 基準大会のレース情報
  const baseRaces = db
    .prepare("SELECT distance_km FROM event_races WHERE event_id = ?")
    .all(marathonId);
  const baseCats = getDistanceCategories(baseRaces);

  // 候補大会を取得（同一大会を除外、アクティブのみ）
  // 効率のため、まず同一都道府県・同一地域で広めに取得
  const regionPrefectures = getSameRegionPrefectures(base.prefecture);
  const candidateLimit = Math.max(limit * 10, 60); // 十分な候補を取得

  // 1クエリで候補取得（地域優先 + 全国から補完）
  const candidates = db
    .prepare(
      `SELECT e.id, e.title, e.event_date, e.event_month, e.prefecture, e.city,
              e.venue_name, e.entry_status, e.entry_end_date, e.source_url, e.official_url
       FROM events e
       WHERE e.id != ? AND e.is_active = 1
       ORDER BY
         CASE WHEN e.prefecture = ? THEN 0
              WHEN e.prefecture IN (${regionPrefectures.map(() => "?").join(",")}) THEN 1
              ELSE 2 END,
         e.event_date
       LIMIT ?`
    )
    .all(marathonId, base.prefecture || "", ...regionPrefectures, candidateLimit);

  if (candidates.length === 0) return { base, related: [] };

  // 候補の距離カテゴリを一括取得
  const candidateIds = candidates.map((c) => c.id);
  const placeholders = candidateIds.map(() => "?").join(",");
  const raceRows = db
    .prepare(
      `SELECT event_id, distance_km FROM event_races WHERE event_id IN (${placeholders}) AND distance_km IS NOT NULL`
    )
    .all(...candidateIds);

  // event_id → distance_km[] のマップ
  const raceMap = new Map();
  for (const row of raceRows) {
    if (!raceMap.has(row.event_id)) raceMap.set(row.event_id, []);
    raceMap.get(row.event_id).push(row.distance_km);
  }

  // 候補に距離カテゴリを付与
  for (const c of candidates) {
    const distances = raceMap.get(c.id) || [];
    c._distanceCategories = getDistanceCategories(
      distances.map((km) => ({ distance_km: km }))
    );
    c._distanceList = distances;
  }

  // お気に入り数を取得（人気指標）
  const favCounts = getFavoriteCounts(db, candidateIds);
  const maxFavorites = Math.max(...[...favCounts.values(), 1]);

  // スコアリング
  const scored = candidates.map((candidate) => {
    const favCount = favCounts.get(candidate.id) || 0;
    const { score, reasons } = calcScore(base, candidate, {
      baseCats,
      favoriteCount: favCount,
      maxFavorites,
    });
    return {
      ...candidate,
      related_score: score,
      related_reason_labels: [...new Set(reasons)],
      favorite_count: favCount,
    };
  });

  // スコアでソート → 上位N件
  scored.sort((a, b) => b.related_score - a.related_score);
  const topResults = scored.slice(0, limit);

  // 結果をクリーンアップ（内部プロパティ除去、距離情報を整形）
  const related = topResults
    .filter((r) => r.related_score > 0)
    .map((r) => {
      // 距離ラベル生成
      const distanceLabels = (r._distanceCategories || []).map((cat) => {
        const labelMap = {
          full: "フル",
          half: "ハーフ",
          "10km": "10km",
          "5km": "5km",
          ultra: "ウルトラ",
        };
        return labelMap[cat] || cat;
      });

      return {
        id: r.id,
        title: r.title,
        event_date: r.event_date,
        event_month: r.event_month,
        prefecture: r.prefecture,
        city: r.city,
        venue_name: r.venue_name,
        entry_status: r.entry_status,
        entry_end_date: r.entry_end_date,
        source_url: r.source_url,
        official_url: r.official_url,
        distance_labels: distanceLabels,
        related_score: r.related_score,
        related_reason_labels: r.related_reason_labels,
        favorite_count: r.favorite_count,
      };
    });

  return { base, related };
}

// ─── 系列大会 / 同主催者大会 ─────────────────

/**
 * 系列大会・同主催者の大会を取得する
 *
 * 優先度:
 *   1. marathon_details.series_events_json に記載された大会
 *   2. 同一 organizer_name を持つ大会
 *   3. 大会名に共通シリーズ語を含む大会
 *
 * @param {number} marathonId - 基準大会ID
 * @param {object} [options={}]
 * @param {number} [options.limit=6] - 取得件数
 * @returns {{ base: object|null, series: Array<object> }}
 */
export function getSeriesMarathons(marathonId, options = {}) {
  const { limit = DEFAULT_LIMIT } = options;

  const db = getDb();

  // 基準大会を取得
  const base = db
    .prepare("SELECT * FROM events WHERE id = ? AND is_active = 1")
    .get(marathonId);
  if (!base) return { base: null, series: [] };

  // marathon_details から主催者情報・シリーズ情報を取得
  const detail = db
    .prepare(
      `SELECT organizer_name, series_events_json
       FROM marathon_details WHERE marathon_id = ?`
    )
    .get(marathonId);

  const organizerName = detail?.organizer_name || null;
  const seriesEventsJson = detail?.series_events_json || null;

  // シリーズ名の抽出（大会名から共通シリーズ語を推定）
  const seriesKeyword = extractSeriesKeyword(base.title);

  const resultMap = new Map(); // id → { event, source, priority }

  // --- 1. series_events_json からの候補 ---
  if (seriesEventsJson) {
    try {
      const seriesEvents = JSON.parse(seriesEventsJson);
      if (Array.isArray(seriesEvents) && seriesEvents.length > 0) {
        // series_events_json の id リストで検索
        const seriesIds = seriesEvents
          .map((s) => s.event_id || s.id)
          .filter((id) => id && id !== marathonId);

        if (seriesIds.length > 0) {
          const ph = seriesIds.map(() => "?").join(",");
          const rows = db
            .prepare(
              `SELECT id, title, event_date, event_month, prefecture, city,
                      venue_name, entry_status, source_url
               FROM events WHERE id IN (${ph}) AND is_active = 1`
            )
            .all(...seriesIds);

          for (const row of rows) {
            resultMap.set(row.id, {
              event: row,
              source: "series_json",
              priority: 0,
              reason: "シリーズ大会",
            });
          }
        }
      }
    } catch {
      // JSON parse失敗は無視
    }
  }

  // --- 2. 同一主催者の大会 ---
  if (organizerName && resultMap.size < limit) {
    const orgRows = db
      .prepare(
        `SELECT e.id, e.title, e.event_date, e.event_month, e.prefecture, e.city,
                e.venue_name, e.entry_status, e.source_url
         FROM events e
         JOIN marathon_details md ON md.marathon_id = e.id
         WHERE md.organizer_name = ? AND e.id != ? AND e.is_active = 1
         ORDER BY e.event_date
         LIMIT ?`
      )
      .all(organizerName, marathonId, limit * 2);

    for (const row of orgRows) {
      if (!resultMap.has(row.id)) {
        resultMap.set(row.id, {
          event: row,
          source: "same_organizer",
          priority: 1,
          reason: "同じ主催者",
        });
      }
    }
  }

  // --- 3. 大会名のシリーズ共通語で検索 ---
  if (seriesKeyword && seriesKeyword.length >= 3 && resultMap.size < limit) {
    const nameRows = db
      .prepare(
        `SELECT id, title, event_date, event_month, prefecture, city,
                venue_name, entry_status, source_url
         FROM events
         WHERE title LIKE ? AND id != ? AND is_active = 1
         ORDER BY event_date
         LIMIT ?`
      )
      .all(`%${seriesKeyword}%`, marathonId, limit * 2);

    for (const row of nameRows) {
      if (!resultMap.has(row.id)) {
        resultMap.set(row.id, {
          event: row,
          source: "series_name",
          priority: 2,
          reason: "同じシリーズ",
        });
      }
    }
  }

  if (resultMap.size === 0)
    return { base, series: [], organizerName, seriesKeyword };

  // 距離情報を一括取得
  const allIds = [...resultMap.keys()];
  const ph = allIds.map(() => "?").join(",");
  const raceRows = db
    .prepare(
      `SELECT event_id, distance_km FROM event_races
       WHERE event_id IN (${ph}) AND distance_km IS NOT NULL`
    )
    .all(...allIds);

  const raceMap = new Map();
  for (const row of raceRows) {
    if (!raceMap.has(row.event_id)) raceMap.set(row.event_id, []);
    raceMap.get(row.event_id).push(row.distance_km);
  }

  // 結果を整形
  const series = [...resultMap.values()]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, limit)
    .map(({ event, reason }) => {
      const distances = raceMap.get(event.id) || [];
      const distanceLabels = getDistanceCategories(
        distances.map((km) => ({ distance_km: km }))
      ).map((cat) => {
        const labelMap = {
          full: "フル",
          half: "ハーフ",
          "10km": "10km",
          "5km": "5km",
          ultra: "ウルトラ",
        };
        return labelMap[cat] || cat;
      });

      return {
        id: event.id,
        title: event.title,
        event_date: event.event_date,
        event_month: event.event_month,
        prefecture: event.prefecture,
        city: event.city,
        venue_name: event.venue_name,
        entry_status: event.entry_status,
        source_url: event.source_url,
        distance_labels: distanceLabels,
        series_reason: reason,
      };
    });

  return { base, series, organizerName, seriesKeyword };
}

// ─── シリーズ名抽出ヘルパー ─────────────────

/**
 * 大会名から共通シリーズキーワードを抽出
 * 例:
 *   "THE CHALLENGE RACE KOBE 1 in 2026" → "THE CHALLENGE RACE"
 *   "第10回 ○○マラソン" → "○○マラソン"
 *
 * @param {string} title
 * @returns {string|null}
 */
function extractSeriesKeyword(title) {
  if (!title) return null;

  // 年号・回数・開催地を除去してシリーズ共通部分を抽出
  let cleaned = title
    .replace(/\d{4}年?/g, "") // 年号
    .replace(/第\d+回\s*/g, "") // 第N回
    .replace(/in\s+\d{4}/gi, "") // in 2026
    .replace(/\d+\s*$/, "") // 末尾数字
    .replace(/【[^】]*】/g, "") // 【地名】
    .replace(/\([^)]*\)/g, "") // (補足)
    .trim();

  // 残った部分が短すぎれば使わない
  if (cleaned.length < 3) return null;

  // 地名部分を除去（都道府県・市区町村名の後の部分を取る場合など）
  // ここでは大まかに、英数字混じりの長い名前はそのまま使う
  return cleaned;
}
