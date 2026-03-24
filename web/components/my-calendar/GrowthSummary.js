"use client";

/**
 * 成長サマリー — 参加実績と今後の予定を数値で見せる
 */
export default function GrowthSummary({
  futureCount,
  pastCount,
  finishCount,
  pbCount,
  avgPrepPercent,
}) {
  // データがない場合は非表示
  if (pastCount === 0 && futureCount === 0) return null;

  const stats = [
    { label: "参加大会", value: pastCount, unit: "回", color: "text-gray-800", bg: "bg-gray-50" },
    { label: "完走", value: finishCount, unit: "回", color: "text-green-700", bg: "bg-green-50" },
    { label: "PB", value: pbCount, unit: "回", color: "text-yellow-700", bg: "bg-yellow-50" },
    { label: "予定", value: futureCount, unit: "件", color: "text-blue-700", bg: "bg-blue-50" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <h3 className="text-xs font-bold text-gray-600 mb-3 flex items-center gap-1.5">
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
        あなたの記録
      </h3>

      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-2.5 text-center`}>
            <div className={`text-xl sm:text-2xl font-black ${s.color}`}>
              {s.value}
            </div>
            <div className="text-[10px] text-gray-500 font-medium">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* 準備完了率（未来大会がある場合） */}
      {futureCount > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10px] text-gray-500 shrink-0">準備完了率</span>
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                avgPrepPercent === 100 ? "bg-green-500" :
                avgPrepPercent >= 50 ? "bg-blue-500" :
                "bg-amber-500"
              }`}
              style={{ width: `${avgPrepPercent}%` }}
            />
          </div>
          <span className={`text-[10px] font-bold shrink-0 ${
            avgPrepPercent === 100 ? "text-green-600" : "text-gray-600"
          }`}>
            {avgPrepPercent}%
          </span>
        </div>
      )}
    </div>
  );
}
