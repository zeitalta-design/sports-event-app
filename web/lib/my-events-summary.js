/**
 * Phase61: マイ大会統合ロジック
 *
 * 保存済み / 比較中 / 見直し対象を統合し、
 * マイ大会ページやsavedページで使える形にまとめる。
 *
 * 公開関数:
 *   - buildMyEventsSummary({ savedEvents, compareEvents, alertItems })
 *   - mergeTrackedEvents(savedEvents, compareEvents)
 *   - pickPriorityEvents(alertItems, limit)
 *
 * @module my-events-summary
 */

// ════════════════════════════════════════════════════
//  A. buildMyEventsSummary
// ════════════════════════════════════════════════════

/**
 * saved / compare / alerts データから統合サマリーを生成
 *
 * @param {object} params
 * @param {Array} params.savedEvents - 保存済み大会（API by-ids レスポンス形式）
 * @param {Array} params.compareEvents - 比較中大会
 * @param {Array} params.alertItems - buildSavedEventsAlerts の出力
 * @returns {{ counts: object, priorityEvents: Array, compareReady: boolean }}
 */
export function buildMyEventsSummary({ savedEvents = [], compareEvents = [], alertItems = [] }) {
  const alertHigh = alertItems.filter((a) => a.level === "high").length;
  const alertMedium = alertItems.filter((a) => a.level === "medium").length;

  // 重複除去した合計追跡数
  const allIds = new Set([
    ...savedEvents.map((e) => e.id),
    ...compareEvents.map((e) => e.id),
  ]);

  return {
    counts: {
      saved: savedEvents.length,
      compare: compareEvents.length,
      alertHigh,
      alertMedium,
      totalTracked: allIds.size,
    },
    priorityEvents: pickPriorityEvents(alertItems, 3),
    compareReady: compareEvents.length >= 2,
  };
}

// ════════════════════════════════════════════════════
//  B. mergeTrackedEvents
// ════════════════════════════════════════════════════

/**
 * saved / compare の重複を統合し、各イベントにフラグを付与
 *
 * @param {Array} savedEvents
 * @param {Array} compareEvents
 * @param {Set<number>} savedIds - localStorageのsaved ID set
 * @param {Set<number>} compareIds - localStorageのcompare ID set
 * @returns {Array<object>} 統合済みイベント（isSaved, isCompared フラグ付き）
 */
export function mergeTrackedEvents(savedEvents, compareEvents, savedIds, compareIds) {
  const merged = new Map();

  for (const ev of savedEvents) {
    merged.set(ev.id, {
      ...ev,
      isSaved: true,
      isCompared: compareIds.has(ev.id),
    });
  }

  for (const ev of compareEvents) {
    if (merged.has(ev.id)) {
      // 既に saved で追加済み
      merged.get(ev.id).isCompared = true;
    } else {
      merged.set(ev.id, {
        ...ev,
        isSaved: savedIds.has(ev.id),
        isCompared: true,
      });
    }
  }

  return Array.from(merged.values());
}

// ════════════════════════════════════════════════════
//  C. pickPriorityEvents
// ════════════════════════════════════════════════════

/**
 * アラート候補から優先確認すべき大会を抽出
 *
 * @param {Array} alertItems - buildSavedEventsAlerts の出力
 * @param {number} limit - 最大件数
 * @returns {Array} high/medium のアラート付き大会
 */
export function pickPriorityEvents(alertItems, limit = 3) {
  return alertItems
    .filter((a) => a.level === "high" || a.level === "medium")
    .slice(0, limit);
}
