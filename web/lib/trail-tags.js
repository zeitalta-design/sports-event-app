/**
 * Phase52: トレイルラン専用タグ抽出ヘルパー
 *
 * trail イベントの title/description/distance_list から
 * コース特性・距離帯・難易度の簡易タグを抽出する。
 */

/**
 * 距離帯を分類
 * @param {string|null} distanceList - カンマ区切りの距離(km)
 * @returns {{ label: string, type: string }[]}
 */
function extractDistanceCategory(distanceList) {
  if (!distanceList) return [];
  const distances = distanceList
    .split(",")
    .map((d) => parseFloat(d))
    .filter((d) => !isNaN(d));
  if (distances.length === 0) return [];

  const tags = [];
  const maxDist = Math.max(...distances);

  if (maxDist <= 20) {
    tags.push({ label: "ショート", type: "trail_distance" });
  } else if (maxDist <= 50) {
    tags.push({ label: "ミドル", type: "trail_distance" });
  } else {
    tags.push({ label: "ロング", type: "trail_distance" });
  }

  return tags;
}

/**
 * コース特性を description/title から簡易抽出
 * @param {string} title
 * @param {string} description
 * @returns {{ label: string, type: string }[]}
 */
function extractCourseFeatures(title, description) {
  const text = `${title || ""} ${description || ""}`;
  const tags = [];

  if (/外輪山|カルデラ|火山|山岳|縦走/.test(text)) {
    tags.push({ label: "山岳コース", type: "trail_course" });
  } else if (/里山|林道/.test(text)) {
    tags.push({ label: "里山コース", type: "trail_course" });
  } else if (/高原|カルスト|草原|牧野/.test(text)) {
    tags.push({ label: "高原コース", type: "trail_course" });
  }

  return tags;
}

/**
 * 難易度を簡易推定
 * @param {string} title
 * @param {string} description
 * @returns {{ label: string, type: string }|null}
 */
function extractTrailDifficulty(title, description) {
  const text = `${title || ""} ${description || ""}`.toLowerCase();

  if (/ビギナー|初心者|初めて|初級/.test(text)) {
    return { label: "初級向け", type: "trail_difficulty" };
  }
  if (/エキスパート|上級|中上級|本格/.test(text)) {
    return { label: "中上級向け", type: "trail_difficulty" };
  }

  return null;
}

/**
 * トレイルイベントの全タグを抽出
 *
 * @param {object} event - イベントデータ
 * @returns {{ label: string, type: string }[]}
 */
export function extractTrailTags(event) {
  const tags = [];

  // 距離帯
  const distTags = extractDistanceCategory(event.distance_list);
  tags.push(...distTags);

  // コース特性
  const courseTags = extractCourseFeatures(event.title, event.description);
  tags.push(...courseTags);

  // 難易度
  const diff = extractTrailDifficulty(event.title, event.description);
  if (diff) tags.push(diff);

  return tags;
}
