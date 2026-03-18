/**
 * 種目・参加費セクション — CV改善版
 *
 * スマホ: カード型で種目ごとに見やすく表示
 * PC: コンパクトなテーブル表示
 * 初心者にも分かりやすいラベルと情報整理
 */
export default function MarathonDetailPricing({ pricing, races }) {
  const hasPricing = pricing && pricing.length > 0;
  const hasRaces = races && races.length > 0;

  if (!hasPricing && !hasRaces) return null;

  const items = hasPricing
    ? pricing.map((p, i) => ({ id: i, name: p.name, fee: p.fee, note: p.note }))
    : races;

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1 h-6 bg-blue-600 rounded-full" />
        <h2 className="text-xl font-bold text-gray-900">種目・参加費</h2>
        <span className="text-xs text-gray-400 ml-auto">{items.length}種目</span>
      </div>

      {hasPricing ? (
        <PricingCards items={pricing} />
      ) : (
        <RaceCards races={races} />
      )}

      <p className="mt-4 text-[11px] text-gray-400 text-center">
        ※ 参加費・定員等は変更される場合があります。最新情報は公式サイトでご確認ください。
      </p>
    </div>
  );
}

function PricingCards({ items }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-100"
        >
          <span className="font-semibold text-sm text-gray-900">{item.name}</span>
          <div className="text-right">
            <span className="font-bold text-sm text-gray-900">{item.fee || "-"}</span>
            {item.note && (
              <span className="block text-[11px] text-gray-500">{item.note}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RaceCards({ races }) {
  // 主要レース（距離あり or fee_min > 0）を先に、その他を後に
  const primary = races.filter((r) => r.distance_km || (r.fee_min && r.fee_min > 0));
  const other = races.filter((r) => !r.distance_km && (!r.fee_min || r.fee_min <= 0));
  const sorted = [...primary, ...other];

  return (
    <div className="space-y-2">
      {sorted.map((race) => (
        <RaceCard key={race.id} race={race} />
      ))}
    </div>
  );
}

function RaceCard({ race }) {
  const distance = race.distance_km
    ? race.distance_km >= 42
      ? "フルマラソン"
      : race.distance_km >= 21
        ? "ハーフマラソン"
        : `${race.distance_km}km`
    : null;

  const fee = race.fee_min
    ? `¥${race.fee_min.toLocaleString()}${
        race.fee_max && race.fee_max !== race.fee_min
          ? `〜¥${race.fee_max.toLocaleString()}`
          : ""
      }`
    : null;

  return (
    <div className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
      {/* 種目名 + 距離 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-gray-900 leading-snug">
            {race.race_name}
          </p>
          {distance && (
            <span className="inline-block mt-1 px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 rounded">
              {distance}
            </span>
          )}
        </div>
        {/* 参加費（右寄せ、目立たせる） */}
        {fee && (
          <div className="flex-shrink-0 text-right">
            <span className="text-base font-bold text-gray-900">{fee}</span>
          </div>
        )}
      </div>

      {/* 補助情報（定員・制限時間・スタート） */}
      {(race.capacity || race.time_limit || race.start_time || race.eligibility) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-gray-500">
          {race.capacity && (
            <span>定員 {race.capacity.toLocaleString()}人</span>
          )}
          {race.time_limit && (
            <span>制限 {race.time_limit}</span>
          )}
          {race.start_time && (
            <span>スタート {race.start_time}</span>
          )}
          {race.eligibility && (
            <span className="basis-full text-gray-400">{race.eligibility}</span>
          )}
        </div>
      )}
    </div>
  );
}
