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
 * 自転車 / サイクリング判定パターン
 */
const CYCLING_PATTERNS = [
  /ヒルクライム/i,
  /サイクル(?:イベント|フェスタ|ロード|レース|大会)/i,
  /サイクリング/i,
  /自転車/i,
  /ロードバイク/i,
  /エンデューロ/i,
  /グランフォンド/i,
  /ブルベ/i,
  /cycling/i,
  /hill\s*climb/i,
  /BIKE/i,
];

/**
 * トライアスロン判定パターン
 */
const TRIATHLON_PATTERNS = [
  /トライアスロン/i,
  /triathlon/i,
  /デュアスロン/i,
  /duathlon/i,
  /アクアスロン/i,
  /aquathlon/i,
];

/**
 * 水泳判定パターン
 */
const SWIMMING_PATTERNS = [
  /オーシャンスイム/i,
  /オープンウォーター/i,
  /遠泳/i,
  /水泳大会/i,
  /(?:^|\s)スイム(?:大会|チャレンジ|レース)/i,
  /open\s*water/i,
  /swimming/i,
];

/**
 * ゴルフ判定パターン
 */
const GOLF_PATTERNS = [
  /ゴルフ/i,
  /golf/i,
];

/**
 * スカッシュ判定パターン
 */
const SQUASH_PATTERNS = [
  /スカッシュ/i,
  /squash/i,
];

/**
 * 練習会・講習会判定パターン
 * ※ 「マラソン練習会」のように競技名を含む場合は、タイトル全体が練習会中心かで判定
 */
const WORKSHOP_PATTERNS = [
  /(?:ランニング|マラソン)?(?:練習会|講習会|教室|レッスン|クリニック|セミナー)(?:$|\s|[0-9]|[（(]|参加|募集|開催)/i,
  /(?:^|　|\s)(?:練習会|講習会|教室|レッスン|クリニック|セミナー)/i,
];

/**
 * ウォーキング判定パターン
 */
const WALKING_PATTERNS = [
  /ウォーキング(?:大会|イベント)?/i,
  /ウォーク(?:大会|イベント|ラリー|フェス)/i,
  /(?:ウルトラ)?ウォーク(?:ing|$|\s)/i,
  /ウォークラリー/i,
  /^(?:(?!マラソン|ラン).)*ウォーク/i,
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
  golf: "golf",
  squash: "squash",
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

  const text = titleStr + " " + descStr;

  // Step 1: 自転車（ヒルクライム等）— マラソンガードより先に判定
  for (const pattern of CYCLING_PATTERNS) {
    if (pattern.test(titleStr)) {
      return { sportType: "cycling", sportSlug: "cycling", confidence: "high" };
    }
  }

  // Step 2: トライアスロン
  for (const pattern of TRIATHLON_PATTERNS) {
    if (pattern.test(titleStr)) {
      return { sportType: "triathlon", sportSlug: "triathlon", confidence: "high" };
    }
  }

  // Step 3: 水泳
  for (const pattern of SWIMMING_PATTERNS) {
    if (pattern.test(titleStr)) {
      return { sportType: "swimming", sportSlug: "swimming", confidence: "high" };
    }
  }

  // Step 4: ゴルフ
  for (const pattern of GOLF_PATTERNS) {
    if (pattern.test(titleStr)) {
      return { sportType: "golf", sportSlug: "golf", confidence: "high" };
    }
  }

  // Step 4.5: スカッシュ
  for (const pattern of SQUASH_PATTERNS) {
    if (pattern.test(titleStr)) {
      return { sportType: "squash", sportSlug: "squash", confidence: "high" };
    }
  }

  // Step 5: トレイルラン — 高信頼
  for (const pattern of TRAIL_PATTERNS_HIGH) {
    if (pattern.test(titleStr)) {
      return { sportType: "trail", sportSlug: "trail", confidence: "high" };
    }
  }

  // Step 6: ウォーキング（タイトルに「マラソン」が含まれない場合のみ）
  if (!MARATHON_TITLE_GUARD.test(titleStr)) {
    for (const pattern of WALKING_PATTERNS) {
      if (pattern.test(titleStr)) {
        return { sportType: "walking", sportSlug: "walking", confidence: "high" };
      }
    }
  }

  // Step 6.5: 練習会・講習会（大会名よりイベント性質が練習会中心の場合）
  for (const pattern of WORKSHOP_PATTERNS) {
    if (pattern.test(titleStr)) {
      return { sportType: "workshop", sportSlug: "workshop", confidence: "high" };
    }
  }

  // Step 7: タイトルにマラソン/ロード系があれば marathon 確定ガード
  if (MARATHON_TITLE_GUARD.test(titleStr)) {
    return { sportType: "marathon", sportSlug: "marathon", confidence: "high" };
  }

  // Step 8: 説明文から他競技判定
  for (const pattern of CYCLING_PATTERNS) {
    if (pattern.test(descStr)) return { sportType: "cycling", sportSlug: "cycling", confidence: "medium" };
  }
  for (const pattern of TRIATHLON_PATTERNS) {
    if (pattern.test(descStr)) return { sportType: "triathlon", sportSlug: "triathlon", confidence: "medium" };
  }
  for (const pattern of SWIMMING_PATTERNS) {
    if (pattern.test(descStr)) return { sportType: "swimming", sportSlug: "swimming", confidence: "medium" };
  }
  for (const pattern of GOLF_PATTERNS) {
    if (pattern.test(descStr)) return { sportType: "golf", sportSlug: "golf", confidence: "medium" };
  }
  for (const pattern of SQUASH_PATTERNS) {
    if (pattern.test(descStr)) return { sportType: "squash", sportSlug: "squash", confidence: "medium" };
  }

  // Step 9: 説明文から trail 高信頼
  for (const pattern of TRAIL_PATTERNS_HIGH) {
    if (pattern.test(descStr)) {
      return { sportType: "trail", sportSlug: "trail", confidence: "high" };
    }
  }

  // Step 10: 説明文から trail 中信頼スコア
  if (descStr.length > 0) {
    let mediumScore = 0;
    for (const { pattern, score } of TRAIL_PATTERNS_MEDIUM) {
      if (pattern.test(descStr)) mediumScore += score;
    }
    if (mediumScore >= MEDIUM_SCORE_THRESHOLD) {
      return { sportType: "trail", sportSlug: "trail", confidence: "medium" };
    }
  }

  // デフォルト: marathon
  return { sportType: "marathon", sportSlug: "marathon", confidence: "default" };
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
