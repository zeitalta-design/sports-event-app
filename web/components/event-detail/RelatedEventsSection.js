/**
 * Phase58: 似た条件の大会セクション
 *
 * 同地域 / 同スポーツ / 近い開催時期 / 近い距離感の大会を
 * カード一覧で表示し、回遊導線を提供する。
 */

import Link from "next/link";

function formatShortDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function EntryBadge({ status }) {
  if (status === "open") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded bg-green-50 text-green-700 border border-green-200">
        受付中
      </span>
    );
  }
  if (status === "closed") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded bg-gray-100 text-gray-500 border border-gray-200">
        受付終了
      </span>
    );
  }
  return null;
}

function EventMiniCard({ event, sportSlug }) {
  const href =
    sportSlug === "marathon"
      ? `/marathon/${event.id}`
      : `/${sportSlug}/${event.id}`;

  const dateStr = formatShortDate(event.event_date);
  const location = [event.prefecture, event.city].filter(Boolean).join(" ");

  return (
    <Link
      href={href}
      className="block card p-4 hover:shadow-md hover:border-blue-200 transition-all group"
    >
      {/* タイトル */}
      <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-snug line-clamp-2 mb-2">
        {event.title}
      </h3>

      {/* メタ情報 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mb-2">
        {dateStr && <span>{dateStr}</span>}
        {location && <span>{location}</span>}
        {event.primary_distance_label && (
          <span className="text-gray-600 font-medium">
            {event.primary_distance_label}
          </span>
        )}
      </div>

      {/* 下段: エントリー状態 + 関連理由 */}
      <div className="flex items-center justify-between gap-2">
        <EntryBadge status={event.entry_status} />
        {event.relation_reason && (
          <span className="text-[11px] text-gray-400 truncate">
            {event.relation_reason}
          </span>
        )}
      </div>
    </Link>
  );
}

export default function RelatedEventsSection({ events, sportSlug = "marathon" }) {
  if (!events || events.length === 0) return null;

  return (
    <section className="mt-2">
      <h2 className="text-base font-bold text-gray-900 mb-3">
        似た条件の大会
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {events.map((ev) => (
          <EventMiniCard key={ev.id} event={ev} sportSlug={sportSlug} />
        ))}
      </div>
    </section>
  );
}
