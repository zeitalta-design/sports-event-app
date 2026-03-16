/**
 * 特徴チップセクション
 * 日本陸連公認 / ペーサーあり / チップ計測 etc.
 * Phase 26: チップサイズ拡大・間隔改善
 */
export default function MarathonDetailFeatures({ features }) {
  if (!features || features.length === 0) return null;

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">大会の特徴</h2>
      <div className="flex flex-wrap gap-2.5">
        {features.map((f) => (
          <span
            key={f}
            className="inline-flex items-center px-4 py-2 text-sm font-medium bg-blue-50 text-blue-700 border border-blue-100 rounded-lg"
          >
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}
