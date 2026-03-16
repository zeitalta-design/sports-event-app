/**
 * Phase67: カレンダー月間統計
 */

const SPORT_LABELS = {
  marathon: { label: "マラソン", color: "bg-blue-100 text-blue-700" },
  trail: { label: "トレイル", color: "bg-green-100 text-green-700" },
  triathlon: { label: "トライアスロン", color: "bg-red-100 text-red-700" },
  cycling: { label: "自転車", color: "bg-orange-100 text-orange-700" },
  walking: { label: "ウォーキング", color: "bg-cyan-100 text-cyan-700" },
};

export default function CalendarStats({ stats }) {
  if (!stats || stats.total === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
      <span className="text-sm font-semibold text-gray-700">
        {stats.total}件の大会
      </span>
      <span className="text-xs text-gray-400">|</span>
      <span className="text-xs text-green-600 font-medium">
        受付中: {stats.openCount}件
      </span>
      {Object.entries(stats.sportCounts || {}).map(([sport, count]) => {
        const info = SPORT_LABELS[sport];
        if (!info) return null;
        return (
          <span
            key={sport}
            className={`px-2 py-0.5 text-xs font-medium rounded ${info.color}`}
          >
            {info.label} {count}
          </span>
        );
      })}
    </div>
  );
}
