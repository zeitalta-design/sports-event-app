"use client";

/**
 * Phase68: 検索フィルターチップ
 *
 * ワンタップで距離・状態を絞り込めるチップUI。
 * 既存のselect型フィルターに加え、視認性の高い導線を提供。
 */

const DISTANCE_CHIPS = [
  { key: "5", label: "〜5km", icon: "🚶" },
  { key: "10", label: "10km", icon: "🏃" },
  { key: "half", label: "ハーフ", icon: "🏃‍♂️" },
  { key: "full", label: "フル", icon: "🏅" },
  { key: "ultra", label: "ウルトラ", icon: "⚡" },
];

const STATUS_CHIPS = [
  { key: "open", label: "受付中", color: "bg-green-50 text-green-700 border-green-300" },
  { key: "upcoming", label: "受付予定", color: "bg-blue-50 text-blue-600 border-blue-200" },
];

export default function SearchFilterChips({
  currentDistance,
  currentStatus,
  onDistanceChange,
  onStatusChange,
}) {
  return (
    <div className="space-y-3 mb-4">
      {/* 距離チップ */}
      <div>
        <span className="text-xs font-medium text-gray-500 mr-2">距離:</span>
        <div className="inline-flex flex-wrap gap-1.5">
          <button
            onClick={() => onDistanceChange("")}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              !currentDistance
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"
            }`}
          >
            すべて
          </button>
          {DISTANCE_CHIPS.map((chip) => (
            <button
              key={chip.key}
              onClick={() => onDistanceChange(currentDistance === chip.key ? "" : chip.key)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                currentDistance === chip.key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"
              }`}
            >
              {chip.icon} {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* 状態チップ */}
      <div>
        <span className="text-xs font-medium text-gray-500 mr-2">状態:</span>
        <div className="inline-flex flex-wrap gap-1.5">
          <button
            onClick={() => onStatusChange("")}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              !currentStatus
                ? "bg-gray-700 text-white border-gray-700"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
            }`}
          >
            すべて
          </button>
          {STATUS_CHIPS.map((chip) => (
            <button
              key={chip.key}
              onClick={() => onStatusChange(currentStatus === chip.key ? "" : chip.key)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                currentStatus === chip.key
                  ? chip.color
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
