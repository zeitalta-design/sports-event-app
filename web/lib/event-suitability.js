/**
 * Phase91: 適性スコア計算
 *
 * クライアントサイド（DB不要）。
 * ランナープロフィールと大会データから適性を判定する。
 */

// ── スコア配分 ──

const SUITABILITY_WEIGHTS = {
  distance: 35,
  prefecture: 25,
  level: 20,
  goals: 20,
};

// 距離キー → km 範囲
const DISTANCE_RANGES = {
  "5km": [0, 5],
  "10km": [5.1, 10],
  "half": [20, 22],
  "full": [42, 43],
  "ultra": [43.1, 999],
};

// ゴール → 特徴キーワード（大会のfeatures/descriptionから検出）
const GOAL_KEYWORDS = {
  fun: ["ファンラン", "楽しく", "仮装", "お祭り", "エイド充実", "完走"],
  record: ["公認", "記録", "日本陸連", "ペーサー", "BQ", "サブ", "記録証"],
  first_marathon: ["初心者", "初めて", "初マラソン", "制限時間", "ゆるめ", "サポート"],
  scenery: ["景色", "絶景", "海", "山", "自然", "風景", "ロケーション"],
  social: ["仲間", "チーム", "リレー", "グループ", "交流"],
  travel: ["旅", "観光", "温泉", "グルメ", "ご当地", "ツアー"],
};

// レベル → 特徴キーワード
const LEVEL_KEYWORDS = {
  beginner: ["初心者", "初めて", "初マラソン", "制限時間7", "制限時間8", "ファンラン", "初心者歓迎"],
  intermediate: ["ハーフ", "10km", "完走証", "タイム計測", "公認"],
  advanced: ["記録更新", "公認コース", "日本陸連", "ペーサー", "サブ3", "サブ4"],
};

// ── 適性レベル定義 ──

const SUITABILITY_LEVELS = {
  perfect: { key: "perfect", label: "ぴったり", icon: "🎯", minScore: 70, className: "bg-green-50 text-green-700 border-green-300" },
  good: { key: "good", label: "おすすめ", icon: "👍", minScore: 50, className: "bg-blue-50 text-blue-600 border-blue-300" },
  fair: { key: "fair", label: "検討の余地あり", icon: "🔵", minScore: 30, className: "bg-gray-50 text-gray-600 border-gray-300" },
  low: { key: "low", label: "条件不一致", icon: "⚪", minScore: 0, className: "bg-gray-50 text-gray-400 border-gray-200" },
};

/**
 * 大会とプロフィールの適性を計算
 *
 * @param {object} event - 大会データ
 *   必要フィールド: distance_labels, distance_list, prefecture, features, description
 * @param {object} profile - { distances, prefectures, level, goals }
 * @returns {{
 *   score: number,
 *   level: string,
 *   levelDef: object,
 *   reasons: string[],
 *   mismatches: string[]
 * }}
 */
export function calculateSuitability(event, profile) {
  if (!profile) {
    return {
      score: 0,
      level: "low",
      levelDef: SUITABILITY_LEVELS.low,
      reasons: [],
      mismatches: ["プロフィール未設定"],
    };
  }

  const reasons = [];
  const mismatches = [];
  let totalScore = 0;

  // 1. 距離マッチ (0-35)
  const distScore = calcDistanceSuitability(event, profile.distances);
  totalScore += distScore.score;
  if (distScore.reason) reasons.push(distScore.reason);
  if (distScore.mismatch) mismatches.push(distScore.mismatch);

  // 2. 地域マッチ (0-25)
  const prefScore = calcPrefectureSuitability(event, profile.prefectures);
  totalScore += prefScore.score;
  if (prefScore.reason) reasons.push(prefScore.reason);
  if (prefScore.mismatch) mismatches.push(prefScore.mismatch);

  // 3. レベル適性 (0-20)
  const levelScore = calcLevelSuitability(event, profile.level);
  totalScore += levelScore.score;
  if (levelScore.reason) reasons.push(levelScore.reason);

  // 4. ゴール適性 (0-20)
  const goalScore = calcGoalSuitability(event, profile.goals);
  totalScore += goalScore.score;
  if (goalScore.reason) reasons.push(goalScore.reason);

  // 適性レベル判定
  const level = getSuitabilityLevel(totalScore);

  return {
    score: Math.round(totalScore),
    level: level.key,
    levelDef: level,
    reasons,
    mismatches,
  };
}

/**
 * 適性レベル定義を取得
 */
export function getSuitabilityLevelDef(levelKey) {
  return SUITABILITY_LEVELS[levelKey] || SUITABILITY_LEVELS.low;
}

// ── 個別計算 ──

function calcDistanceSuitability(event, profileDistances) {
  if (!profileDistances || profileDistances.length === 0) {
    return { score: 0, reason: null, mismatch: null };
  }

  const eventDistances = getEventDistances(event);
  if (eventDistances.length === 0) {
    return { score: 0, reason: null, mismatch: null };
  }

  // 完全マッチチェック
  for (const pd of profileDistances) {
    const range = DISTANCE_RANGES[pd];
    if (!range) continue;
    for (const km of eventDistances) {
      if (km >= range[0] && km <= range[1]) {
        return {
          score: SUITABILITY_WEIGHTS.distance,
          reason: "希望距離にマッチ",
          mismatch: null,
        };
      }
    }
  }

  // 近い距離があれば部分マッチ
  const targetKms = profileDistances
    .map((d) => {
      const r = DISTANCE_RANGES[d];
      return r ? (r[0] + r[1]) / 2 : null;
    })
    .filter(Boolean);

  if (targetKms.length > 0 && eventDistances.length > 0) {
    const minDiff = Math.min(
      ...eventDistances.flatMap((ek) =>
        targetKms.map((tk) => Math.abs(ek - tk))
      )
    );
    if (minDiff < 5) {
      return {
        score: Math.round(SUITABILITY_WEIGHTS.distance * 0.5),
        reason: "近い距離あり",
        mismatch: null,
      };
    }
  }

  return {
    score: 0,
    reason: null,
    mismatch: "希望距離と異なる",
  };
}

function calcPrefectureSuitability(event, profilePrefectures) {
  if (!profilePrefectures || profilePrefectures.length === 0) {
    return { score: 0, reason: null, mismatch: null };
  }
  if (!event.prefecture) {
    return { score: 0, reason: null, mismatch: null };
  }

  if (profilePrefectures.includes(event.prefecture)) {
    return {
      score: SUITABILITY_WEIGHTS.prefecture,
      reason: "希望エリア",
      mismatch: null,
    };
  }

  // 同じ地方なら部分マッチ
  const REGION_MAP = buildRegionMap();
  const eventRegion = REGION_MAP[event.prefecture];
  const profileRegions = profilePrefectures.map((p) => REGION_MAP[p]);
  if (eventRegion && profileRegions.includes(eventRegion)) {
    return {
      score: Math.round(SUITABILITY_WEIGHTS.prefecture * 0.4),
      reason: "同じ地方の大会",
      mismatch: null,
    };
  }

  return {
    score: 0,
    reason: null,
    mismatch: "希望エリア外",
  };
}

function calcLevelSuitability(event, level) {
  if (!level) return { score: 0, reason: null };
  const keywords = LEVEL_KEYWORDS[level] || [];
  if (keywords.length === 0) return { score: 0, reason: null };

  const text = getEventText(event);
  if (!text) return { score: 0, reason: null };

  const matchCount = keywords.filter((kw) => text.includes(kw)).length;
  if (matchCount === 0) return { score: 0, reason: null };

  const score = Math.min(
    SUITABILITY_WEIGHTS.level,
    Math.round((matchCount / Math.max(keywords.length, 3)) * SUITABILITY_WEIGHTS.level)
  );

  return {
    score,
    reason: level === "beginner" ? "初心者向き" : level === "advanced" ? "上級者向き" : "レベル適合",
  };
}

function calcGoalSuitability(event, goals) {
  if (!goals || goals.length === 0) return { score: 0, reason: null };

  const text = getEventText(event);
  if (!text) return { score: 0, reason: null };

  let totalMatches = 0;
  let totalKeywords = 0;
  const matchedGoals = [];

  for (const goal of goals) {
    const keywords = GOAL_KEYWORDS[goal] || [];
    totalKeywords += keywords.length;
    const matches = keywords.filter((kw) => text.includes(kw)).length;
    if (matches > 0) {
      totalMatches += matches;
      matchedGoals.push(goal);
    }
  }

  if (totalMatches === 0) return { score: 0, reason: null };

  const score = Math.min(
    SUITABILITY_WEIGHTS.goals,
    Math.round((totalMatches / Math.max(totalKeywords, 5)) * SUITABILITY_WEIGHTS.goals * 2)
  );

  const goalLabels = {
    fun: "楽しく完走", record: "記録更新", first_marathon: "初マラソン",
    scenery: "景色", social: "仲間", travel: "旅ラン",
  };
  const reason = matchedGoals
    .slice(0, 2)
    .map((g) => goalLabels[g] || g)
    .join("・") + "向き";

  return { score, reason };
}

// ── ヘルパー ──

function getEventDistances(event) {
  // distance_list (from DB: "42.195,21.0975") or distance_labels (["フル", "ハーフ"])
  if (event.distance_list) {
    return event.distance_list
      .split(",")
      .map(Number)
      .filter((n) => n > 0);
  }
  if (event.distance_labels && Array.isArray(event.distance_labels)) {
    return event.distance_labels
      .map(labelToKm)
      .filter(Boolean);
  }
  return [];
}

function labelToKm(label) {
  if (!label) return null;
  if (label.includes("フル") || label.includes("full")) return 42.195;
  if (label.includes("ハーフ") || label.includes("half")) return 21.0975;
  if (label.includes("10km") || label.includes("10K")) return 10;
  if (label.includes("5km") || label.includes("5K")) return 5;
  if (label.includes("ウルトラ") || label.includes("ultra")) return 100;
  return null;
}

function getEventText(event) {
  let text = event.description || "";
  if (event.features) {
    if (Array.isArray(event.features)) {
      text += " " + event.features.join(" ");
    }
  }
  if (event.features_json) {
    try {
      const f = typeof event.features_json === "string"
        ? JSON.parse(event.features_json)
        : event.features_json;
      if (Array.isArray(f)) text += " " + f.join(" ");
    } catch {}
  }
  return text;
}

function getSuitabilityLevel(score) {
  if (score >= SUITABILITY_LEVELS.perfect.minScore) return SUITABILITY_LEVELS.perfect;
  if (score >= SUITABILITY_LEVELS.good.minScore) return SUITABILITY_LEVELS.good;
  if (score >= SUITABILITY_LEVELS.fair.minScore) return SUITABILITY_LEVELS.fair;
  return SUITABILITY_LEVELS.low;
}

function buildRegionMap() {
  return {
    北海道: "北海道",
    青森県: "東北", 岩手県: "東北", 宮城県: "東北", 秋田県: "東北", 山形県: "東北", 福島県: "東北",
    茨城県: "関東", 栃木県: "関東", 群馬県: "関東", 埼玉県: "関東", 千葉県: "関東", 東京都: "関東", 神奈川県: "関東",
    新潟県: "中部", 富山県: "中部", 石川県: "中部", 福井県: "中部", 山梨県: "中部", 長野県: "中部", 岐阜県: "中部", 静岡県: "中部", 愛知県: "中部",
    三重県: "近畿", 滋賀県: "近畿", 京都府: "近畿", 大阪府: "近畿", 兵庫県: "近畿", 奈良県: "近畿", 和歌山県: "近畿",
    鳥取県: "中国", 島根県: "中国", 岡山県: "中国", 広島県: "中国", 山口県: "中国",
    徳島県: "四国", 香川県: "四国", 愛媛県: "四国", 高知県: "四国",
    福岡県: "九州", 佐賀県: "九州", 長崎県: "九州", 熊本県: "九州", 大分県: "九州", 宮崎県: "九州", 鹿児島県: "九州", 沖縄県: "九州",
  };
}
