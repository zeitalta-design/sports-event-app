/**
 * データ鮮度の算出・表示ロジック
 *
 * last_verified_at / scraped_at から鮮度レベルを算出し、
 * 一覧・詳細ページで「いつ確認した情報か」を表示する。
 *
 * 鮮度レベル:
 *   "fresh"      : 3日以内
 *   "normal"     : 7日以内
 *   "stale"      : 14日以内
 *   "very_stale" : 14日超 or 未確認
 */

// ─── 鮮度定義 ──────────────────────────────────

export const FRESHNESS_LEVELS = {
  fresh: {
    label: "最新",
    className: "text-green-600",
    maxDays: 3,
  },
  normal: {
    label: "良好",
    className: "text-gray-500",
    maxDays: 7,
  },
  stale: {
    label: "やや古い",
    className: "text-amber-600",
    maxDays: 14,
  },
  very_stale: {
    label: "要確認",
    className: "text-red-500",
    maxDays: Infinity,
  },
};

// ─── メインAPI ──────────────────────────────────

/**
 * 鮮度情報を算出する
 *
 * @param {object} params
 * @param {string} [params.lastVerifiedAt] - 最終確認日時 (ISO)
 * @param {string} [params.scrapedAt] - 最終取得日時 (ISO)
 * @param {Date} [now] - 現在日時（テスト用）
 * @returns {{
 *   level: string,
 *   label: string,
 *   className: string,
 *   daysAgo: number|null,
 *   lastCheckedAt: string|null,
 *   displayText: string,
 *   cautionText: string|null,
 * }}
 */
export function getFreshnessInfo(params, now = new Date()) {
  const { lastVerifiedAt, scrapedAt } = params || {};

  // 最終確認日: last_verified_at 優先、なければ scraped_at
  const lastChecked = lastVerifiedAt || scrapedAt || null;

  if (!lastChecked) {
    return {
      level: "very_stale",
      label: FRESHNESS_LEVELS.very_stale.label,
      className: FRESHNESS_LEVELS.very_stale.className,
      daysAgo: null,
      lastCheckedAt: null,
      displayText: "未確認",
      cautionText: "最新情報は公式サイトでご確認ください",
    };
  }

  const checkedDate = new Date(lastChecked);
  if (isNaN(checkedDate.getTime())) {
    return {
      level: "very_stale",
      label: FRESHNESS_LEVELS.very_stale.label,
      className: FRESHNESS_LEVELS.very_stale.className,
      daysAgo: null,
      lastCheckedAt: null,
      displayText: "未確認",
      cautionText: "最新情報は公式サイトでご確認ください",
    };
  }

  const diffMs = now.getTime() - checkedDate.getTime();
  const daysAgo = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // レベル判定
  let level, levelDef;
  if (daysAgo <= FRESHNESS_LEVELS.fresh.maxDays) {
    level = "fresh";
    levelDef = FRESHNESS_LEVELS.fresh;
  } else if (daysAgo <= FRESHNESS_LEVELS.normal.maxDays) {
    level = "normal";
    levelDef = FRESHNESS_LEVELS.normal;
  } else if (daysAgo <= FRESHNESS_LEVELS.stale.maxDays) {
    level = "stale";
    levelDef = FRESHNESS_LEVELS.stale;
  } else {
    level = "very_stale";
    levelDef = FRESHNESS_LEVELS.very_stale;
  }

  // 表示テキスト
  const displayText = formatDaysAgo(daysAgo);

  // 注意文
  let cautionText = null;
  if (level === "stale") {
    cautionText = "情報確認から時間が経っています。最新情報は公式サイトもご確認ください";
  } else if (level === "very_stale") {
    cautionText = "最新情報は公式サイトでご確認ください";
  }

  return {
    level,
    label: levelDef.label,
    className: levelDef.className,
    daysAgo,
    lastCheckedAt: lastChecked,
    displayText,
    cautionText,
  };
}

/**
 * 一覧カード用: 簡易鮮度テキストを返す
 * 古い場合のみ表示用（freshなら null）
 */
export function getFreshnessLabel(params) {
  const info = getFreshnessInfo(params);
  // fresh/normal は一覧では非表示
  if (info.level === "fresh" || info.level === "normal") return null;
  return {
    text: info.displayText,
    className: info.className,
  };
}

// ─── ヘルパー ──────────────────────────────────

function formatDaysAgo(days) {
  if (days === 0) return "今日確認";
  if (days === 1) return "昨日確認";
  if (days <= 30) return `${days}日前確認`;
  const months = Math.floor(days / 30);
  return `${months}ヶ月以上前`;
}
