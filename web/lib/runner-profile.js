/**
 * Phase70: Runnerプロフィール管理
 *
 * localStorageベースでランナーの嗜好設定を管理。
 * ログイン不要。
 *
 * 保存形式:
 * {
 *   distances: string[], // ["5km", "10km", "half", "full", "ultra"]
 *   prefectures: string[], // ["東京都", "神奈川県"]
 *   level: string, // "beginner" | "intermediate" | "advanced"
 *   goals: string[], // ["fun", "record", "first_marathon", "scenery"]
 *   updatedAt: string // ISO date
 * }
 */

const STORAGE_KEY = "taikai_runner_profile";

export const DISTANCE_OPTIONS = [
  { key: "5km", label: "〜5km" },
  { key: "10km", label: "10km" },
  { key: "half", label: "ハーフ" },
  { key: "full", label: "フルマラソン" },
  { key: "ultra", label: "ウルトラ" },
];

export const LEVEL_OPTIONS = [
  { key: "beginner", label: "初心者", description: "これから始める / 初大会" },
  { key: "intermediate", label: "中級者", description: "何度か大会に出た" },
  { key: "advanced", label: "上級者", description: "記録更新を狙う" },
];

export const GOAL_OPTIONS = [
  { key: "fun", label: "楽しく完走", icon: "😊" },
  { key: "record", label: "記録更新", icon: "🏅" },
  { key: "first_marathon", label: "初マラソン", icon: "🌟" },
  { key: "scenery", label: "景色を楽しむ", icon: "🏔️" },
  { key: "social", label: "仲間と走る", icon: "👥" },
  { key: "travel", label: "旅ラン", icon: "✈️" },
];

/**
 * プロフィールを取得
 * @returns {object|null}
 */
export function getRunnerProfile() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * プロフィールを保存
 * @param {object} profile
 */
export function saveRunnerProfile(profile) {
  if (typeof window === "undefined") return;
  try {
    const data = {
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("runner-profile-change"));
  } catch {
    // storage full
  }
}

/**
 * プロフィールをクリア
 */
export function clearRunnerProfile() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("runner-profile-change"));
  } catch {}
}

/**
 * プロフィールが設定済みか
 * @returns {boolean}
 */
export function hasRunnerProfile() {
  const profile = getRunnerProfile();
  return profile !== null && (
    (profile.distances && profile.distances.length > 0) ||
    (profile.prefectures && profile.prefectures.length > 0) ||
    profile.level
  );
}

/**
 * プロフィールからおすすめクエリパラメータを生成
 * @returns {URLSearchParams}
 */
export function buildRecommendationParams(profile) {
  const params = new URLSearchParams();
  if (!profile) return params;

  // 距離
  if (profile.distances && profile.distances.length > 0) {
    // 主要距離を選択
    if (profile.distances.includes("full")) params.set("distance", "full");
    else if (profile.distances.includes("half")) params.set("distance", "half");
    else if (profile.distances.includes("10km")) params.set("distance", "10");
    else if (profile.distances.includes("5km")) params.set("distance", "5");
  }

  // エリア
  if (profile.prefectures && profile.prefectures.length > 0) {
    params.set("prefecture", profile.prefectures[0]);
  }

  // 受付中のみ
  params.set("status", "open");
  params.set("sort", "popularity");

  return params;
}
