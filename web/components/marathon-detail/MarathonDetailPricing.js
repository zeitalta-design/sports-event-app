/**
 * 種目・参加費セクション
 *
 * pricing_json がある場合はそちらを優先表示。
 * ない場合は既存の event_races テーブルから表示。
 *
 * Phase 26: テーブル行の高さ・テキストサイズ・ヘッダー改善
 */
export default function MarathonDetailPricing({ pricing, races }) {
  const hasPricing = pricing && pricing.length > 0;
  const hasRaces = races && races.length > 0;

  if (!hasPricing && !hasRaces) return null;

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">種目・参加費</h2>
      <div className="overflow-x-auto -mx-2">
        {hasPricing ? (
          <PricingTable items={pricing} />
        ) : (
          <RacesTable races={races} />
        )}
      </div>
    </div>
  );
}

function PricingTable({ items }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b-2 border-gray-200">
          <th className="text-left py-3 px-3 text-sm text-gray-500 font-semibold">
            種目
          </th>
          <th className="text-left py-3 px-3 text-sm text-gray-500 font-semibold">
            参加費
          </th>
          <th className="text-left py-3 px-3 text-sm text-gray-500 font-semibold">
            備考
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr
            key={i}
            className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <td className="py-3 px-3 font-semibold text-gray-900">
              {item.name}
            </td>
            <td className="py-3 px-3 text-gray-800 font-medium">
              {item.fee || "-"}
            </td>
            <td className="py-3 px-3 text-gray-500 text-sm">
              {item.note || ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RacesTable({ races }) {
  // 参加資格データがある種目があるか確認
  const hasEligibility = races.some((r) => r.eligibility);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b-2 border-gray-200">
          <th className="text-left py-3 px-3 text-sm text-gray-500 font-semibold">
            種目
          </th>
          <th className="text-left py-3 px-3 text-sm text-gray-500 font-semibold">
            距離
          </th>
          <th className="text-left py-3 px-3 text-sm text-gray-500 font-semibold">
            参加費
          </th>
          <th className="text-left py-3 px-3 text-sm text-gray-500 font-semibold">
            定員
          </th>
          <th className="text-left py-3 px-3 text-sm text-gray-500 font-semibold">
            制限時間
          </th>
          <th className="text-left py-3 px-3 text-sm text-gray-500 font-semibold">
            スタート
          </th>
          {hasEligibility && (
            <th className="text-left py-3 px-3 text-sm text-gray-500 font-semibold">
              参加資格
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {races.map((race) => (
          <tr
            key={race.id}
            className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <td className="py-3 px-3 font-semibold text-gray-900">
              {race.race_name}
            </td>
            <td className="py-3 px-3 text-gray-700">
              {race.distance_km ? `${race.distance_km}km` : "-"}
            </td>
            <td className="py-3 px-3 text-gray-700">
              {race.fee_min ? `¥${race.fee_min.toLocaleString()}` : "-"}
              {race.fee_max && race.fee_max !== race.fee_min
                ? `〜¥${race.fee_max.toLocaleString()}`
                : ""}
            </td>
            <td className="py-3 px-3 text-gray-700">
              {race.capacity ? `${race.capacity.toLocaleString()}人` : "-"}
            </td>
            <td className="py-3 px-3 text-gray-700">
              {race.time_limit || "-"}
            </td>
            <td className="py-3 px-3 text-gray-700">
              {race.start_time || "-"}
            </td>
            {hasEligibility && (
              <td className="py-3 px-3 text-gray-600 text-xs max-w-[200px]">
                {race.eligibility || "-"}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
