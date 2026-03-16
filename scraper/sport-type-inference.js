/**
 * Phase51/55: スポーツ種別推定モジュール
 *
 * イベント名・説明文からsport_typeを推定する。
 * conservative な判定方針: 明確にtrail等と判定できるものだけ分類し、
 * 曖昧なものは marathon に残す。
 *
 * Phase55 で trail パターンを拡充:
 * - 高信頼: タイトルに明確なトレイル/山岳キーワード → 即 trail
 * - 中信頼: 説明文に複数の trail 関連ワード → スコア加算で trail
 * - 除外ガード: タイトルに「マラソン」があれば marathon 確定（trail誤爆防止）
 *
 * 使い方:
 *   const { inferSportType } = require("./sport-type-inference");
 *   const { sportType, sportSlug } = inferSportType(title, description);
 */

/**
 * トレイルラン判定パターン — 高信頼（タイトル・説明文どちらにあっても確定）
 */
const TRAIL_PATTERNS_HIGH = [
  /トレイルラン/i,
  /トレイル\s*レース/i,
  /トレラン/i,
  /トレイル(?!ウォーキング)/i,
  /TRAIL\s*RUN/i,
  /TRAILRUN/i,
  /山岳(?:ラン|レース|マラソン|耐久)/i,
  /林道(?:ラン|レース)/i,
  /峠走/i,
  /チャレンジ登山/i,
  /登山(?:レース|競走|大会)/i,
  /カルスト(?:ラン|RUN|レース)/i,
  /スカイラン/i,
  /SKY\s*RUN/i,
  /マウンテン(?:ラン|レース)/i,
  /MOUNTAIN\s*(?:RUN|RACE)/i,
  /縦走(?:レース|ラン|大会)/i,
];

/**
 * トレイルラン判定パターン — 中信頼（説明文のみ、スコア加算用）
 * 単独では trail 確定しないが、複数一致でスコアが閾値を超えれば trail
 */
const TRAIL_PATTERNS_MEDIUM = [
  { pattern: /山道/, score: 3 },
  { pattern: /登山道/, score: 3 },
  { pattern: /不整地/, score: 3 },
  { pattern: /林道/, score: 2 },
  { pattern: /尾根/, score: 2 },
  { pattern: /稜線/, score: 2 },
  { pattern: /渓谷/, score: 2 },
  { pattern: /高原コース/, score: 2 },
  { pattern: /山頂/, score: 1 },
  { pattern: /峠/, score: 1 },
  { pattern: /山岳/, score: 2 },
  { pattern: /自然の中/, score: 1 },
  { pattern: /里山/, score: 2 },
  { pattern: /ダート/, score: 2 },
  { pattern: /累積標高/, score: 3 },
  { pattern: /獲得標高/, score: 3 },
  { pattern: /エイドステーション/, score: 1 },
];

/** 中信頼スコアの閾値（これ以上で trail 判定） */
const MEDIUM_SCORE_THRESHOLD = 5;

/**
 * マラソン確定パターン（trail判定より優先度高い場合に使用）
 * タイトルに「マラソン」があれば trail にしないガード
 */
const MARATHON_TITLE_GUARD = /マラソン|marathon|ロードレース|駅伝|リレーマラソン/i;

/**
 * 将来拡張用: ウォーキング判定パターン
 */
const WALKING_PATTERNS = [
  /ウォーキング大会/i,
  /ウォーク(?:大会|イベント|ラリー)/i,
];

/**
 * sport_type → sport_slug のマッピング
 */
const SPORT_TYPE_TO_SLUG = {
  marathon: "marathon",
  trail: "trail",
  triathlon: "triathlon",
  cycling: "cycling",
  walking: "walking",
  swimming: "swimming",
  workshop: "workshop",
};

/**
 * イベント名と説明文からsport_typeを推定
 *
 * @param {string} title - イベント名
 * @param {string} [description] - 説明文（任意）
 * @returns {{ sportType: string, sportSlug: string, confidence: string }}
 *   confidence: "high" = パターン一致, "medium" = スコア判定, "default" = デフォルト(marathon)
 */
function inferSportType(title, description) {
  const titleStr = title || "";
  const descStr = description || "";

  // Step 1: タイトルから trail 高信頼パターン判定
  for (const pattern of TRAIL_PATTERNS_HIGH) {
    if (pattern.test(titleStr)) {
      return {
        sportType: "trail",
        sportSlug: "trail",
        confidence: "high",
      };
    }
  }

  // Step 2: タイトルにマラソン/ロード系があれば marathon 確定ガード
  // （説明文にtrail要素があっても、タイトルがマラソンなら marathon を維持）
  if (MARATHON_TITLE_GUARD.test(titleStr)) {
    return {
      sportType: "marathon",
      sportSlug: "marathon",
      confidence: "high",
    };
  }

  // Step 3: 説明文から trail 高信頼パターン判定
  for (const pattern of TRAIL_PATTERNS_HIGH) {
    if (pattern.test(descStr)) {
      return {
        sportType: "trail",
        sportSlug: "trail",
        confidence: "high",
      };
    }
  }

  // Step 4: 説明文から trail 中信頼スコア判定
  // 単独では弱いが複数一致で trail と判定
  if (descStr.length > 0) {
    let mediumScore = 0;
    for (const { pattern, score } of TRAIL_PATTERNS_MEDIUM) {
      if (pattern.test(descStr)) {
        mediumScore += score;
      }
    }
    if (mediumScore >= MEDIUM_SCORE_THRESHOLD) {
      return {
        sportType: "trail",
        sportSlug: "trail",
        confidence: "medium",
      };
    }
  }

  // Walking 判定（将来拡張用、今回は無効）
  // for (const pattern of WALKING_PATTERNS) {
  //   if (pattern.test(text)) {
  //     return { sportType: "walking", sportSlug: "walking", confidence: "high" };
  //   }
  // }

  // デフォルト: marathon
  return {
    sportType: "marathon",
    sportSlug: "marathon",
    confidence: "default",
  };
}

/**
 * sport_type から sport_slug を解決
 * @param {string} sportType
 * @returns {string}
 */
function getSportSlug(sportType) {
  return SPORT_TYPE_TO_SLUG[sportType] || "marathon";
}

module.exports = {
  inferSportType,
  getSportSlug,
  TRAIL_PATTERNS_HIGH,
  TRAIL_PATTERNS_MEDIUM,
  MEDIUM_SCORE_THRESHOLD,
};
