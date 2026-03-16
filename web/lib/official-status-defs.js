/**
 * Phase76: official_entry_status の定義（クライアント安全）
 * Phase79: awaiting_update 追加 + unknown_reason 定義追加
 *
 * DB依存なし。クライアントコンポーネントから安全にimportできる。
 */

export const OFFICIAL_STATUSES = {
  open: {
    key: "open",
    label: "受付中",
    shortLabel: "受付中",
    color: "green",
    className: "bg-green-100 text-green-700 border-green-300",
    badgeClass: "bg-green-500 text-white",
    priority: 1,
  },
  closing_soon: {
    key: "closing_soon",
    label: "締切間近",
    shortLabel: "締切間近",
    color: "amber",
    className: "bg-amber-100 text-amber-700 border-amber-300",
    badgeClass: "bg-amber-500 text-white",
    priority: 2,
  },
  capacity_warning: {
    key: "capacity_warning",
    label: "定員間近",
    shortLabel: "定員間近",
    color: "orange",
    className: "bg-orange-100 text-orange-700 border-orange-300",
    badgeClass: "bg-orange-500 text-white",
    priority: 3,
  },
  full: {
    key: "full",
    label: "定員到達",
    shortLabel: "定員到達",
    color: "red",
    className: "bg-red-100 text-red-700 border-red-300",
    badgeClass: "bg-red-600 text-white",
    priority: 4,
  },
  closed: {
    key: "closed",
    label: "募集終了",
    shortLabel: "募集終了",
    color: "gray",
    className: "bg-gray-200 text-gray-600 border-gray-300",
    badgeClass: "bg-gray-500 text-white",
    priority: 5,
  },
  suspended: {
    key: "suspended",
    label: "一時停止",
    shortLabel: "一時停止",
    color: "purple",
    className: "bg-purple-100 text-purple-700 border-purple-300",
    badgeClass: "bg-purple-500 text-white",
    priority: 6,
  },
  awaiting_update: {
    key: "awaiting_update",
    label: "情報更新待ち",
    shortLabel: "更新待ち",
    color: "slate",
    className: "bg-slate-100 text-slate-500 border-slate-300",
    badgeClass: "bg-slate-400 text-white",
    priority: 7,
  },
  unknown: {
    key: "unknown",
    label: "要確認",
    shortLabel: "要確認",
    color: "gray",
    className: "bg-gray-100 text-gray-500 border-gray-200",
    badgeClass: "bg-gray-400 text-white",
    priority: 8,
  },
};

// Phase79: unknown の理由カテゴリ
export const UNKNOWN_REASONS = {
  no_source: { key: "no_source", label: "ソース未取得", description: "確認元のURLが未取得です" },
  ambiguous_text: { key: "ambiguous_text", label: "文言曖昧", description: "ページの文言から状態を特定できません" },
  stale_data: { key: "stale_data", label: "更新が古い", description: "最終確認から時間が経過しています" },
  source_conflict: { key: "source_conflict", label: "状態競合", description: "複数ソースで状態が一致しません" },
  pre_open: { key: "pre_open", label: "受付開始前", description: "受付がまだ開始されていません" },
  fetch_error: { key: "fetch_error", label: "取得エラー", description: "ページの取得に失敗しました" },
};

// Phase79: ソース種別の優先度（数値が小さい方が高優先）
export const SOURCE_PRIORITY = {
  official: 1,   // 公式サイト
  runnet: 2,     // RUNNET（エントリーサイト）
  moshicom: 2,   // MOSHICOM（エントリーサイト）
  other: 3,      // その他参考ページ
};

export function getOfficialStatusDef(status) {
  return OFFICIAL_STATUSES[status] || OFFICIAL_STATUSES.unknown;
}
