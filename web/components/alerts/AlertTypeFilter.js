"use client";

/**
 * Phase102: アラート種別フィルター
 */

const FILTER_OPTIONS = [
  { key: "all",      label: "すべて",     icon: "📋" },
  { key: "deadline",  label: "締切関連",   icon: "⏰" },
  { key: "entry",     label: "受付状況",   icon: "🔒" },
  { key: "capacity",  label: "定員関連",   icon: "👥" },
  { key: "data",      label: "データ更新", icon: "📊" },
];

/**
 * アラートタイプからフィルターキーへのマッピング
 */
export const ALERT_TYPE_TO_FILTER = {
  deadline_imminent: "deadline",
  deadline_soon: "deadline",
  deadline_passed: "deadline",
  deadline_2weeks: "deadline",
  entry_closed: "entry",
  cancelled: "entry",
  capacity_limited: "capacity",
  stale_data: "data",
  event_imminent: "deadline",
  event_soon: "deadline",
  event_finished: "entry",
};

export default function AlertTypeFilter({ activeFilter, onFilterChange, counts = {} }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
      {FILTER_OPTIONS.map((opt) => {
        const count = opt.key === "all" ? null : (counts[opt.key] || 0);
        const isActive = activeFilter === opt.key;

        return (
          <button
            key={opt.key}
            onClick={() => onFilterChange(opt.key)}
            className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              isActive
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <span>{opt.icon}</span>
            <span>{opt.label}</span>
            {count !== null && count > 0 && (
              <span className={`ml-0.5 ${isActive ? "opacity-70" : "text-gray-400"}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
