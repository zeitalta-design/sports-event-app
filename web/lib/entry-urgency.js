/**
 * 締切傾向・緊急度ラベル判定
 *
 * 履歴サマリーとイベント情報から、
 * 「早期エントリー推奨」等のラベルをルールベースで算出する。
 *
 * urgency_level:
 *   "high"   → 人気で早期締切注意 / 例年すぐ埋まる
 *   "medium" → やや早め推奨 / 先着順・早め推奨
 *   "low"    → 余裕あり
 *   "none"   → 判定不能 / ラベルなし
 */

import { detectEntrySignals } from "@/lib/entry-status";

// ─── ラベル定義 ──────────────────────────────────

export const URGENCY_LABELS = {
  fills_fast: {
    label: "例年すぐ埋まる",
    level: "high",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  early_close_warning: {
    label: "人気で早期締切注意",
    level: "high",
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  early_recommended: {
    label: "やや早め推奨",
    level: "medium",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  first_come: {
    label: "先着順・早め推奨",
    level: "medium",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  comfortable: {
    label: "余裕あり",
    level: "low",
    className: "bg-green-50 text-green-600 border-green-200",
  },
};

// ─── メインAPI ──────────────────────────────────

/**
 * 緊急度ラベルを算出する
 *
 * @param {object} event - イベント情報
 * @param {object} [historySummary] - getEntryHistorySummary() の結果
 * @returns {{
 *   urgencyLabel: string|null,
 *   urgencyLevel: string,
 *   reasonText: string|null,
 *   labelDef: object|null,
 *   historicalDaysToClose: number|null,
 *   daysBeforeEventClosed: number|null,
 *   confidence: string,
 *   signals: Array<string>,
 * }}
 */
export function getEntryUrgencyMeta(event, historySummary = null) {
  const result = {
    urgencyLabel: null,
    urgencyLevel: "none",
    reasonText: null,
    labelDef: null,
    historicalDaysToClose: null,
    daysBeforeEventClosed: null,
    confidence: "low",
    signals: [],
  };

  if (!event) return result;

  // イベントが終了済みまたは受付終了済みならラベル不要
  const status = event.entry_status;
  if (status === "ended" || status === "cancelled") return result;

  // シグナル取得（events.entry_signals_json または description から）
  const cachedSignals = safeParseArray(event.entry_signals_json);
  const descSignals = event.description
    ? detectEntrySignals(event.description).signals.map((s) => s.label)
    : [];
  const allSignals = [...new Set([...cachedSignals, ...descSignals])];
  result.signals = allSignals;

  // 履歴情報を反映
  if (historySummary?.hasHistory) {
    result.historicalDaysToClose = historySummary.daysOpenToClose;
    result.daysBeforeEventClosed = historySummary.daysBeforeEventClosed;

    if (historySummary.allSignals) {
      for (const s of historySummary.allSignals) {
        if (!result.signals.includes(s)) result.signals.push(s);
      }
    }
  }

  // ─── ルール適用（優先度順） ─────────────────

  // Rule 1: 募集開始から14日以内に締切 → 例年すぐ埋まる
  if (historySummary?.daysOpenToClose !== null && historySummary.daysOpenToClose <= 14) {
    return applyLabel(result, "fills_fast",
      `募集開始から${historySummary.daysOpenToClose}日で締切`, "high");
  }

  // Rule 2: 開催60日以上前に締切 → 人気で早期締切注意
  if (historySummary?.daysBeforeEventClosed !== null && historySummary.daysBeforeEventClosed >= 60) {
    return applyLabel(result, "early_close_warning",
      `開催${historySummary.daysBeforeEventClosed}日前に締切`, "high");
  }

  // Rule 3: capacity_reached が2回以上 → 人気で早期締切注意
  if (historySummary?.capacityCloseCount >= 2) {
    return applyLabel(result, "early_close_warning",
      `過去${historySummary.capacityCloseCount}回定員到達`, "medium");
  }

  // Rule 4: capacity_reached が1回 + 定員到達シグナル → やや早め推奨
  if (historySummary?.capacityCloseCount === 1 && historySummary.isCapacityBased) {
    return applyLabel(result, "early_recommended",
      "過去に定員到達実績あり", "medium");
  }

  // Rule 5: 先着順シグナルあり → 先着順・早め推奨
  if (allSignals.includes("先着順")) {
    const confidence = historySummary?.hasHistory ? "medium" : "low";
    return applyLabel(result, "first_come",
      "先着順のため早めの申込をおすすめします", confidence);
  }

  // Rule 6: 定員到達で締切 / 早期終了の可能性 シグナル
  if (
    allSignals.includes("定員到達で締切") ||
    allSignals.includes("早期終了の可能性")
  ) {
    return applyLabel(result, "early_recommended",
      "定員に達した場合は受付終了の可能性があります", "low");
  }

  // Rule 7: 人気大会 / 早め推奨 シグナル
  if (allSignals.includes("人気大会") || allSignals.includes("早め推奨")) {
    return applyLabel(result, "early_recommended",
      "早めの申込がおすすめです", "low");
  }

  // Rule 8: 残りわずか
  if (allSignals.includes("残りわずか") && status === "open") {
    return applyLabel(result, "early_close_warning",
      "残りわずかのため早めの申込をおすすめします", "high");
  }

  // 十分な履歴があり、上記に該当しない → 余裕あり
  if (historySummary?.hasHistory && historySummary.totalRecords >= 3 && !historySummary.isCapacityBased) {
    return applyLabel(result, "comfortable", "過去の履歴から余裕がある傾向", "medium");
  }

  return result;
}

/**
 * 簡易版: ラベル文字列だけ返す
 */
export function getEntryUrgencyLabel(event, historySummary = null) {
  const meta = getEntryUrgencyMeta(event, historySummary);
  return meta.urgencyLabel;
}

/**
 * events テーブルのキャッシュ値から簡易ラベル情報を返す
 * （DB結合なし、一覧表示用）
 */
export function getUrgencyFromCache(event) {
  if (!event) return null;

  // キャッシュされたラベルがあればそのまま使う
  if (event.urgency_label && event.urgency_level) {
    const def = Object.values(URGENCY_LABELS).find(
      (d) => d.label === event.urgency_label
    );
    return {
      label: event.urgency_label,
      level: event.urgency_level,
      className: def?.className || URGENCY_LABELS.early_recommended.className,
    };
  }

  // キャッシュがない場合、シグナルから簡易判定
  const signals = safeParseArray(event.entry_signals_json);
  if (signals.length === 0) return null;

  if (signals.includes("残りわずか") && event.entry_status === "open") {
    return URGENCY_LABELS.early_close_warning;
  }
  if (signals.includes("先着順")) {
    return URGENCY_LABELS.first_come;
  }
  if (
    signals.includes("定員到達で締切") ||
    signals.includes("早期終了の可能性")
  ) {
    return URGENCY_LABELS.early_recommended;
  }

  return null;
}

// ─── ヘルパー ──────────────────────────────────

function applyLabel(result, labelKey, reasonText, confidence) {
  const def = URGENCY_LABELS[labelKey];
  result.urgencyLabel = def.label;
  result.urgencyLevel = def.level;
  result.reasonText = reasonText;
  result.labelDef = def;
  result.confidence = confidence;
  return result;
}

function safeParseArray(json) {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
