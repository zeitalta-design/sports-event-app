/**
 * Phase57: この大会の要点カード
 *
 * 開催日・会場・種目・エントリー状況などの要点を
 * 2〜4列グリッドでコンパクトに一覧表示する。
 * 初見ユーザーが数秒で大会概要を把握できるようにする。
 */

export default function EventQuickFactsCard({ quickFacts }) {
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
    </section>
  );
}
