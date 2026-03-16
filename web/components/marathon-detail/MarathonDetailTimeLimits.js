/**
 * 制限時間セクション
 *
 * time_limits_json 形式:
 * [{ name: "フルマラソン", limit: "4時間30分" }, ...]
 *
 * Phase 26: カードサイズ・テキスト・間隔改善
 */
export default function MarathonDetailTimeLimits({ timeLimits, races }) {
  const hasJsonLimits = timeLimits && timeLimits.length > 0;

  const raceLimits =
    !hasJsonLimits && races
      ? races
          .filter((r) => r.time_limit)
          .map((r) => ({ name: r.race_name, limit: r.time_limit }))
      : [];

  const items = hasJsonLimits ? timeLimits : raceLimits;
  if (items.length === 0) return null;

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">制限時間</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex justify-between items-center py-2.5 px-4 bg-gray-50 rounded-lg text-sm"
          >
            <span className="text-gray-700">{item.name}</span>
            <span className="font-semibold text-gray-900">{item.limit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
