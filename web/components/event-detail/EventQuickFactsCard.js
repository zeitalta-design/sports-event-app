/**
 * Phase57→Phase228: この大会の要点カード
 *
 * 開催日・会場・種目・エントリー状況などの要点を
 * 2列グリッドでコンパクトに一覧表示する。
 * データ出典・情報確認も統合表示。
 */

export default function EventQuickFactsCard({ quickFacts, dataSource, freshness }) {
  if (!quickFacts?.items || quickFacts.items.length === 0) return null;

  return (
    <section className="card p-5">
      <h2 className="text-base font-bold text-gray-900 mb-4">
        この大会の要点
      </h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-x-6 gap-y-3">
        {quickFacts.items.map((item, i) => (
          <div
            key={i}
            className="flex items-baseline gap-2 py-1.5 border-b border-gray-50 last:border-b-0"
          >
            <dt className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0 min-w-[4.5rem]">
              {item.label}
            </dt>
            <dd className="text-sm font-medium text-gray-900 leading-snug break-words min-w-0">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* データ出典・情報確認 */}
      {(dataSource || freshness) && (
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-x-6 gap-y-1.5">
          {dataSource && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400">データ出典:</span>
              <span className="text-xs text-gray-600 font-medium">{dataSource}</span>
            </div>
          )}
          {freshness && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400">情報確認:</span>
              <span className={`text-xs font-medium ${freshness.className || "text-gray-600"}`}>
                {freshness.displayText}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
