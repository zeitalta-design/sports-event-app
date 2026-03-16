/**
 * Phase58: 大会詳細ページ用 回遊強化ロジック
 *
 * 現在閲覧中の大会から、関連大会・代替候補・再検索リンクを生成する。
 * ルールベースの軽量スコアリングで説明可能な関連付けを行う。
 *
 * 公開関数:
 *   - getRelatedEvents(data, options)          → 似た条件の大会
 *   - getAlternativeEvents(data, options)      → 代替候補
 *   - buildSearchLinksFromEvent(data, options)  → 再検索導線
 *
 * @module event-related
 */

import { getDb } from "@/lib/db";
import {
  PREFECTURE_NAME_TO_SLUG,
  DISTANCE_SLUGS,
  REGION_GROUPS,
} from "@/lib/seo-mappings";

// ════════════════════════════════════════════════════
//  定数
// ════════════════════════════════════════════════════

/** 距離カテゴリ定義 */
const DISTANCE_CATEGORIES = {
  full: { min: 42, max: 43 },
  half: { min: 20, max: 22 },
  "10km": { min: 5.1, max: 10 },
  "5km": { min: 0, max: 5 },
  ultra: { min: 43.1, max: 999 },
};

/** スコア重み（関連大会用） */
const RELATED_SCORE = {
  SAME_PREFECTURE: 40,
  SAME_REGION: 20,
  SAME_CITY: 20,
  CLOSE_DATE: 25,       // ±45日以内
  SAME_MONTH: 15,
  SAME_DISTANCE: 25,
  SAME_TYPE: 15,        // ファミリー、フル中心、トレイル系
  ENTRY_OPEN: 10,
  HAS_DETAIL: 5,
};

/** スコア重み（代替候補用） */
const ALT_SCORE = {
  SAME_PREFECTURE: 35,
  SAME_REGION: 15,
  CLOSE_DATE: 30,
  SAME_DISTANCE: 30,
  ENTRY_OPEN: 25,       // 代替候補では受付中がより重要
  HAS_DETAIL: 5,
};

// ════════════════════════════════════════════════════
//  ヘルパー関数
// ════════════════════════════════════════════════════

/**
 * 都道府県名 → 地域ブロック名
 */
function getRegionForPrefecture(prefecture) {
  if (!prefecture) return null;
  const slug = PREFECTURE_NAME_TO_SLUG[prefecture];
  if (!slug) return null;
  for (const group of REGION_GROUPS) {
    if (group.slugs.includes(slug)) return group.label;
  }
  return null;
}

/**
 * 同一地域ブロックの都道府県リストを取得
 */
function getSameRegionPrefectures(prefecture) {
  if (!prefecture) return [];
  const slug = PREFECTURE_NAME_TO_SLUG[prefecture];
  if (!slug) return [];
  for (const group of REGION_GROUPS) {
    if (group.slugs.includes(slug)) {
      return group.slugs;
    }
  }
  return [];
}

/**
 * イベントの主要距離カテゴリを取得
 */
export function getPrimaryDistanceCategory(races) {
  if (!races || races.length === 0) return [];
  const cats = new Set();
  for (const race of races) {
    const km = race.distance_km;
    if (!km || km <= 0) continue;
    for (const [cat, range] of Object.entries(DISTANCE_CATEGORIES)) {
      if (km >= range.min && km <= range.max) {
        cats.add(cat);
      }
    }
  }
  return [...cats];
}

/**
 * 距離カテゴリの表示ラベル
 */
function getDistanceCategoryLabel(cats) {
  if (!cats || cats.length === 0) return null;
  const labels = {
    full: "フル",
    half: "ハーフ",
    "10km": "10km",
    "5km": "5km以下",
    ultra: "ウルトラ",
  };
  return cats.map((c) => labels[c] || c).join(" / ");
}

/**
 * ファミリー向け大会か判定
 */
function isFamilyFriendly(races) {
  if (!races) return false;
  return races.some((r) =>
    /ファミリー|親子|キッズ|こども|子供/.test(r.race_name || "")
  );
}

/**
 * 2つの日付の日数差
 */
function dateDiffDays(date1, date2) {
  if (!date1 || !date2) return null;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
  return Math.abs(Math.ceil((d1 - d2) / (1000 * 60 * 60 * 24)));
}

/**
 * 今日から開催日までの日数
 */
function daysUntilEvent(eventDate) {
  if (!eventDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(eventDate);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

/**
 * 候補イベントを一括取得（sport_type + is_active のみでフィルタ）
 */
function fetchCandidateEvents(db, currentId, sportType, limit = 100) {
  const rows = db
    .prepare(
      `SELECT e.id, e.title, e.event_date, e.event_month, e.prefecture, e.city,
              e.entry_status, e.entry_end_date, e.source_url, e.sport_type,
              e.venue_name
       FROM events e
       WHERE e.is_active = 1
         AND e.id != ?
         AND e.sport_type = ?
         AND e.event_date >= date('now', '-7 days')
       ORDER BY e.event_date ASC
       LIMIT ?`
    )
    .all(currentId, sportType || "marathon", limit);

  // レース情報も取得
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const races = db
    .prepare(
      `SELECT event_id, race_name, distance_km
       FROM event_races
       WHERE event_id IN (${placeholders})
       ORDER BY event_id, sort_order`
    )
    .all(...ids);

  // marathon_details の有無チェック
  const details = db
    .prepare(
      `SELECT marathon_id FROM marathon_details
       WHERE marathon_id IN (${placeholders})
         AND summary IS NOT NULL`
    )
    .all(...ids);
  const detailSet = new Set(details.map((d) => d.marathon_id));

  // race情報をイベントに紐付け
  const raceMap = {};
  for (const race of races) {
    if (!raceMap[race.event_id]) raceMap[race.event_id] = [];
    raceMap[race.event_id].push(race);
  }

  return rows.map((r) => ({
    ...r,
    races: raceMap[r.id] || [],
    hasDetail: detailSet.has(r.id),
  }));
}

// ════════════════════════════════════════════════════
//  A. getRelatedEvents — 似た条件の大会
// ════════════════════════════════════════════════════

/**
 * 関連大会を取得（ルールベーススコアリング）
 *
 * @param {object} data - getMarathonDetailPageData() の戻り値
 * @param {object} [options]
 * @param {number} [options.limit=6]
 * @returns {Array<object>}
 */
export function getRelatedEvents(data, options = {}) {
  const limit = options.limit || 6;

  try {
    const db = getDb();
    const candidates = fetchCandidateEvents(
      db, data.id, data.sport_type, 150
    );
    if (candidates.length === 0) return [];

    const currentDistCats = getPrimaryDistanceCategory(data.races || []);
    const currentRegion = getRegionForPrefecture(data.prefecture);
    const currentIsFamily = isFamilyFriendly(data.races || []);

    const scored = candidates.map((cand) => {
      const candDistCats = getPrimaryDistanceCategory(cand.races);
      const candRegion = getRegionForPrefecture(cand.prefecture);
      const candIsFamily = isFamilyFriendly(cand.races);

      let score = 0;
      const reasons = [];

      // 同じ都道府県
      if (data.prefecture && cand.prefecture === data.prefecture) {
        score += RELATED_SCORE.SAME_PREFECTURE;
        reasons.push("same_pref");
      } else if (currentRegion && candRegion === currentRegion) {
        score += RELATED_SCORE.SAME_REGION;
        reasons.push("same_region");
      }

      // 同市区町村
      if (data.city && cand.city === data.city) {
        score += RELATED_SCORE.SAME_CITY;
      }

      // 開催日の近さ
      const daysDiff = dateDiffDays(data.event_date, cand.event_date);
      if (daysDiff !== null && daysDiff <= 45) {
        score += RELATED_SCORE.CLOSE_DATE;
        reasons.push("close_date");
      } else if (data.event_month && cand.event_month &&
                 data.event_month === cand.event_month) {
        score += RELATED_SCORE.SAME_MONTH;
        reasons.push("same_month");
      }

      // 同じ距離カテゴリ
      const distOverlap = currentDistCats.filter(
        (c) => candDistCats.includes(c)
      );
      if (distOverlap.length > 0) {
        score += RELATED_SCORE.SAME_DISTANCE;
        reasons.push("same_distance");
      }

      // 同タイプ感
      if (currentIsFamily && candIsFamily) {
        score += RELATED_SCORE.SAME_TYPE;
        reasons.push("same_type");
      }

      // エントリー受付中
      if (cand.entry_status === "open") {
        score += RELATED_SCORE.ENTRY_OPEN;
      }

      // 詳細情報あり
      if (cand.hasDetail) {
        score += RELATED_SCORE.HAS_DETAIL;
      }

      return {
        ...cand,
        score,
        reasons,
        relation_reason: buildRelationReason(reasons, cand, data),
        primary_distance_label: getDistanceCategoryLabel(candDistCats),
      };
    });

    return scored
      .filter((c) => c.score > 20) // 最低限の関連性
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch {
    return [];
  }
}

// ════════════════════════════════════════════════════
//  B. getAlternativeEvents — 代替候補
// ════════════════════════════════════════════════════

/**
 * 代替候補を取得
 *
 * 特に受付終了・締切間近・開催直前の大会で価値が高い。
 * 受付中の大会を強く優先する。
 *
 * @param {object} data - getMarathonDetailPageData() の戻り値
 * @param {object} [options]
 * @param {number} [options.limit=4]
 * @param {Set<number>} [options.excludeIds] - 除外するID（関連大会との重複排除用）
 * @returns {Array<object>}
 */
export function getAlternativeEvents(data, options = {}) {
  const limit = options.limit || 4;
  const excludeIds = options.excludeIds || new Set();

  // 代替候補が有効なシーン判定
  const isEntryClosedOrEnding = (
    data.entry_status === "closed" ||
    (() => {
      if (!data.entry_end_date || data.entry_status !== "open") return false;
      const days = daysUntilEvent(data.entry_end_date);
      return days !== null && days <= 14;
    })()
  );

  const isEventSoon = (() => {
    const days = daysUntilEvent(data.event_date);
    return days !== null && days <= 14 && days >= 0;
  })();

  const isEventPast = (() => {
    const days = daysUntilEvent(data.event_date);
    return days !== null && days < 0;
  })();

  // 代替候補が特に有効でないなら控えめに
  const needsAlternatives = isEntryClosedOrEnding || isEventSoon || isEventPast;

  try {
    const db = getDb();
    const candidates = fetchCandidateEvents(
      db, data.id, data.sport_type, 150
    );
    if (candidates.length === 0) return [];

    const currentDistCats = getPrimaryDistanceCategory(data.races || []);

    const scored = candidates
      .filter((c) => !excludeIds.has(c.id))
      .map((cand) => {
        const candDistCats = getPrimaryDistanceCategory(cand.races);

        let score = 0;
        const reasons = [];

        // 同都道府県
        if (data.prefecture && cand.prefecture === data.prefecture) {
          score += ALT_SCORE.SAME_PREFECTURE;
          reasons.push("same_pref");
        } else {
          const currentRegion = getRegionForPrefecture(data.prefecture);
          const candRegion = getRegionForPrefecture(cand.prefecture);
          if (currentRegion && candRegion === currentRegion) {
            score += ALT_SCORE.SAME_REGION;
            reasons.push("same_region");
          }
        }

        // 開催日が近い
        const daysDiff = dateDiffDays(data.event_date, cand.event_date);
        if (daysDiff !== null && daysDiff <= 60) {
          score += ALT_SCORE.CLOSE_DATE;
          reasons.push("close_date");
        }

        // 同距離帯
        const distOverlap = currentDistCats.filter(
          (c) => candDistCats.includes(c)
        );
        if (distOverlap.length > 0) {
          score += ALT_SCORE.SAME_DISTANCE;
          reasons.push("same_distance");
        }

        // 受付中（代替候補ではとても重要）
        if (cand.entry_status === "open") {
          score += ALT_SCORE.ENTRY_OPEN;
          reasons.push("entry_open");
        }

        // 詳細あり
        if (cand.hasDetail) {
          score += ALT_SCORE.HAS_DETAIL;
        }

        return {
          ...cand,
          score,
          reasons,
          relation_reason: buildAlternativeReason(reasons, cand, data),
          primary_distance_label: getDistanceCategoryLabel(candDistCats),
        };
      });

    const minScore = needsAlternatives ? 30 : 50;
    const results = scored
      .filter((c) => c.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // 候補が弱い場合は非表示
    if (!needsAlternatives && results.length < 2) return [];

    return results;
  } catch {
    return [];
  }
}

// ════════════════════════════════════════════════════
//  C. buildSearchLinksFromEvent — 再検索導線
// ════════════════════════════════════════════════════

/**
 * 再検索リンクを生成
 *
 * @param {object} data - getMarathonDetailPageData() の戻り値
 * @param {object} [options]
 * @param {string} [options.sportSlug="marathon"]
 * @returns {Array<{label: string, href: string}>}
 */
export function buildSearchLinksFromEvent(data, options = {}) {
  const sportSlug = options.sportSlug || "marathon";
  const sportLabel = sportSlug === "trail" ? "トレイルラン" : "マラソン";
  const links = [];

  // 1. 都道府県で探す
  if (data.prefecture) {
    const prefSlug = PREFECTURE_NAME_TO_SLUG[data.prefecture];
    if (prefSlug) {
      links.push({
        label: `${data.prefecture}の${sportLabel}大会をもっと見る`,
        href: `/${sportSlug}/prefecture/${prefSlug}`,
      });
    }
  }

  // 2. 距離で探す
  const distCats = getPrimaryDistanceCategory(data.races || []);
  if (distCats.length > 0) {
    // 最も代表的な距離を1つ選ぶ
    const primaryDist = distCats.includes("full")
      ? "full"
      : distCats.includes("half")
        ? "half"
        : distCats[0];

    const distInfo = DISTANCE_SLUGS[primaryDist];
    if (distInfo) {
      links.push({
        label: `${distInfo.label}をもっと見る`,
        href: `/${sportSlug}/distance/${primaryDist}`,
      });
    }
  }

  // 3. 開催月で探す
  const month = data.event_month ? parseInt(data.event_month) : null;
  if (month && month >= 1 && month <= 12) {
    links.push({
      label: `${month}月開催の${sportLabel}大会をもっと見る`,
      href: `/${sportSlug}/month/${month}`,
    });
  }

  // 4. スポーツトップへ
  links.push({
    label: `${sportLabel}大会を条件で探す`,
    href: `/${sportSlug}`,
  });

  return links.slice(0, 5);
}

// ════════════════════════════════════════════════════
//  理由文言生成
// ════════════════════════════════════════════════════

function buildRelationReason(reasons, cand, current) {
  // 最も強い理由を1つ選ぶ
  if (reasons.includes("same_pref") && reasons.includes("same_distance")) {
    return `同じ${current.prefecture}・同距離帯の大会です`;
  }
  if (reasons.includes("same_pref") && reasons.includes("close_date")) {
    return `同じ${current.prefecture}で近い時期に開催されます`;
  }
  if (reasons.includes("same_pref")) {
    return `同じ${current.prefecture}の大会です`;
  }
  if (reasons.includes("same_region") && reasons.includes("same_distance")) {
    return "同じ地域・同距離帯で探しやすい大会です";
  }
  if (reasons.includes("same_distance") && reasons.includes("close_date")) {
    return "同じ距離帯で近い時期に開催されます";
  }
  if (reasons.includes("close_date")) {
    return "近い時期に開催される大会です";
  }
  if (reasons.includes("same_distance")) {
    return "同じ距離帯で比較しやすい大会です";
  }
  if (reasons.includes("same_region")) {
    return "同じ地域の大会です";
  }
  if (reasons.includes("same_month")) {
    return "同じ月に開催される大会です";
  }
  return null;
}

function buildAlternativeReason(reasons, cand, current) {
  if (reasons.includes("entry_open") && reasons.includes("same_pref")) {
    return `${current.prefecture}で受付中の大会です`;
  }
  if (reasons.includes("entry_open") && reasons.includes("same_distance")) {
    return "同距離帯で受付中の大会です";
  }
  if (reasons.includes("entry_open") && reasons.includes("close_date")) {
    return "近い時期に開催で受付中です";
  }
  if (reasons.includes("entry_open")) {
    return "受付中の代替候補です";
  }
  if (reasons.includes("same_pref") && reasons.includes("close_date")) {
    return `${current.prefecture}で近い時期に開催されます`;
  }
  if (reasons.includes("same_distance") && reasons.includes("close_date")) {
    return "同距離帯で近い時期の候補です";
  }
  if (reasons.includes("close_date")) {
    return "近い時期に開催される候補です";
  }
  return "代わりに検討しやすい大会です";
}
