/**
 * Phase58: 代わりに検討しやすい大会セクション
 *
 * 受付終了・締切近め・開催直前の大会で特に価値が高い。
 * 受付中の代替候補を優先表示する。
 */

import Link from "next/link";

function formatShortDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function AlternativeEventsSection({ events, sportSlug = "marathon" }) {
  if (!events || events.length === 0) return null;

  return (
    <section className="mt-2">
      <h2 className="text-base font-bold text-gray-900 mb-1">
        代わりに検討しやすい大会
      </h2>
      <p className="text-xs text-gray-400 mb-3">
        条件が近く、エントリーしやすい候補です
      </p>
      <div className="space-y-2">
        {events.map((ev) => {
          const href =
            sportSlug === "marathon"
              ? `/marathon/${ev.id}`
              : `/${sportSlug}/${ev.id}`;
          const dateStr = formatShortDate(ev.event_date);
          const location = ev.prefecture || "";

          return (
            <Link
              key={ev.id}
              href={href}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-white
                         hover:border-blue-200 hover:shadow-sm transition-all group"
            >
              {/* メイン情報 */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                  {ev.title}
                </h3>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                  {dateStr && <span>{dateStr}</span>}
                  {location && <span>{location}</span>}
                  {ev.primary_distance_label && (
                    <span className="font-medium text-gray-600">
                      {ev.primary_distance_label}
                    </span>
                  )}
                </div>
                {ev.relation_reason && (
                  <span className="text-[11px] text-gray-400 mt-0.5 block">
                    {ev.relation_reason}
                  </span>
                )}
              </div>

              {/* エントリーバッジ */}
              {ev.entry_status === "open" && (
                <span className="flex-shrink-0 inline-flex items-center px-2 py-1 text-xs font-semibold rounded-md bg-green-50 text-green-700 border border-green-200">
                  受付中
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
