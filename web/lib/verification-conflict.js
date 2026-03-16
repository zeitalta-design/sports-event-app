/**
 * ソース間矛盾判定ロジック
 *
 * 複数ソースの snapshot を比較し、矛盾の有無・レベル・理由を判定する。
 *
 * conflict level:
 *   0: 問題なし
 *   1: 軽微な差異
 *   2: 要確認
 *   3: 強い矛盾
 */

// ─── 受付状態の比較 ─────────────────────────────────

// 同義とみなすステータスのグループ
const STATUS_GROUPS = {
  active: ["open", "upcoming"],
  closed: ["closed", "ended", "cancelled"],
  unknown: ["unknown", null, undefined],
};

function getStatusGroup(status) {
  if (!status) return "unknown";
  for (const [group, statuses] of Object.entries(STATUS_GROUPS)) {
    if (statuses.includes(status)) return group;
  }
  return "other";
}

/**
 * 受付状態を比較する
 *
 * @param {string} a - snapshot A の entry_status
 * @param {string} b - snapshot B の entry_status
 * @returns {{ conflict: boolean, level: number, reason: string|null }}
 */
export function compareEntryStatuses(a, b) {
  if (!a || !b) return { conflict: false, level: 0, reason: null };
  if (a === b) return { conflict: false, level: 0, reason: null };

  const groupA = getStatusGroup(a);
  const groupB = getStatusGroup(b);

  // 一方が unknown なら軽微
  if (groupA === "unknown" || groupB === "unknown") {
    return { conflict: false, level: 1, reason: `一方が不明（${a} vs ${b}）` };
  }

  // open vs upcoming は軽微
  if (groupA === "active" && groupB === "active") {
    return { conflict: false, level: 1, reason: `受付状態の微差（${a} vs ${b}）` };
  }

  // active vs closed は強い矛盾
  if (
    (groupA === "active" && groupB === "closed") ||
    (groupA === "closed" && groupB === "active")
  ) {
    return {
      conflict: true,
      level: 3,
      reason: `受付状態が矛盾（${a} vs ${b}）`,
    };
  }

  // その他の差異
  return {
    conflict: true,
    level: 2,
    reason: `受付状態が異なる（${a} vs ${b}）`,
  };
}

// ─── 申込締切日の比較 ────────────────────────────────

/**
 * 申込締切日を比較する
 *
 * @param {string} a - YYYY-MM-DD
 * @param {string} b - YYYY-MM-DD
 * @returns {{ conflict: boolean, level: number, reason: string|null }}
 */
export function compareEntryEndDates(a, b) {
  if (!a || !b) return { conflict: false, level: 0, reason: null };
  if (a === b) return { conflict: false, level: 0, reason: null };

  const dateA = new Date(a + "T00:00:00Z");
  const dateB = new Date(b + "T00:00:00Z");
  if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
    return { conflict: false, level: 0, reason: null };
  }

  const diffDays = Math.abs((dateA - dateB) / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) {
    return { conflict: false, level: 0, reason: null };
  }

  if (diffDays <= 7) {
    return {
      conflict: false,
      level: 1,
      reason: `締切日が${Math.round(diffDays)}日ズレ（${a} vs ${b}）`,
    };
  }

  if (diffDays <= 14) {
    return {
      conflict: true,
      level: 2,
      reason: `締切日に${Math.round(diffDays)}日の差異（${a} vs ${b}）`,
    };
  }

  return {
    conflict: true,
    level: 3,
    reason: `締切日が大きく異なる（${a} vs ${b}、${Math.round(diffDays)}日差）`,
  };
}

// ─── 開催日の比較 ────────────────────────────────────

/**
 * 開催日を比較する
 *
 * @param {string} a - YYYY-MM-DD or text
 * @param {string} b - YYYY-MM-DD or text
 * @returns {{ conflict: boolean, level: number, reason: string|null }}
 */
export function compareEventDates(a, b) {
  if (!a || !b) return { conflict: false, level: 0, reason: null };
  if (a === b) return { conflict: false, level: 0, reason: null };

  const dateA = new Date(a + "T00:00:00Z");
  const dateB = new Date(b + "T00:00:00Z");

  if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
    // テキスト比較のみ
    return {
      conflict: true,
      level: 1,
      reason: `開催日の表記が異なる（${a} vs ${b}）`,
    };
  }

  const diffDays = Math.abs((dateA - dateB) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { conflict: false, level: 0, reason: null };

  if (diffDays <= 1) {
    return {
      conflict: false,
      level: 1,
      reason: `開催日が1日ズレ（${a} vs ${b}）`,
    };
  }

  return {
    conflict: true,
    level: 3,
    reason: `開催日が異なる（${a} vs ${b}、${Math.round(diffDays)}日差）`,
  };
}

// ─── 総合矛盾判定 ────────────────────────────────────

/**
 * 複数の snapshot から矛盾を総合判定する
 *
 * @param {Array} snapshots - event_source_snapshots のレコード配列（is_success=1 のもの）
 * @returns {{ conflict: boolean, level: number, reasons: Array, details: object }}
 */
export function detectVerificationConflict(snapshots) {
  if (!snapshots || snapshots.length < 2) {
    return { conflict: false, level: 0, reasons: [], details: {} };
  }

  const reasons = [];
  let maxLevel = 0;
  const details = {};

  // 全ペア比較（通常は2ソース）
  for (let i = 0; i < snapshots.length; i++) {
    for (let j = i + 1; j < snapshots.length; j++) {
      const a = snapshots[i];
      const b = snapshots[j];
      const pairKey = `${a.source_type}_vs_${b.source_type}`;

      // A. 受付状態の比較
      const statusResult = compareEntryStatuses(a.entry_status, b.entry_status);
      if (statusResult.level > 0) {
        reasons.push(statusResult.reason);
        maxLevel = Math.max(maxLevel, statusResult.level);
        details[`${pairKey}_status`] = statusResult;
      }

      // B. 申込締切日の比較
      const endDateResult = compareEntryEndDates(a.entry_end_date, b.entry_end_date);
      if (endDateResult.level > 0) {
        reasons.push(endDateResult.reason);
        maxLevel = Math.max(maxLevel, endDateResult.level);
        details[`${pairKey}_end_date`] = endDateResult;
      }

      // C. 開催日の比較
      const eventDateResult = compareEventDates(a.event_date_text, b.event_date_text);
      if (eventDateResult.level > 0) {
        reasons.push(eventDateResult.reason);
        maxLevel = Math.max(maxLevel, eventDateResult.level);
        details[`${pairKey}_event_date`] = eventDateResult;
      }
    }
  }

  return {
    conflict: maxLevel >= 2,
    level: maxLevel,
    reasons,
    details,
  };
}

// ─── UI用サマリー生成 ────────────────────────────────

/**
 * 矛盾判定結果からUI表示用のサマリーテキストを生成する
 *
 * @param {object} conflictResult - detectVerificationConflict() の戻り値
 * @returns {string}
 */
export function buildConflictSummary(conflictResult) {
  if (!conflictResult || conflictResult.level === 0) {
    return "";
  }

  if (conflictResult.reasons.length === 0) {
    return "情報の検証中";
  }

  // 最も重要な理由を先頭に
  const sorted = [...conflictResult.reasons].sort((a, b) => {
    // level 3 の理由を優先
    const aHigh = a.includes("矛盾") || a.includes("大きく");
    const bHigh = b.includes("矛盾") || b.includes("大きく");
    return bHigh - aHigh;
  });

  return sorted.slice(0, 2).join(" / ");
}

// ─── ユーザー向けラベル ──────────────────────────────

/**
 * conflict_level に応じたユーザー向け表示情報を返す
 *
 * @param {number} level
 * @returns {{ text: string, className: string, showInList: boolean }|null}
 */
export function getConflictDisplayLabel(level) {
  if (!level || level === 0) return null;

  if (level >= 3) {
    return {
      text: "情報に差異あり",
      detail: "掲載元の情報に差異があります。公式サイトをご確認ください。",
      className: "text-amber-700 bg-amber-50 border-amber-200",
      showInList: true,
    };
  }

  if (level >= 2) {
    return {
      text: "要確認",
      detail: "掲載情報に差異の可能性があります。",
      className: "text-yellow-700 bg-yellow-50 border-yellow-200",
      showInList: true,
    };
  }

  // level 1: 詳細ページのみ
  return {
    text: "情報差異の可能性",
    detail: "掲載元の情報に軽微な差異があります。",
    className: "text-gray-500 bg-gray-50 border-gray-200",
    showInList: false,
  };
}
