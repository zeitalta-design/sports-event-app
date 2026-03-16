import Link from "next/link";
import Breadcrumbs from "./Breadcrumbs";
import { getStatusLabel, getStatusBadgeClassSimple } from "@/lib/entry-status";
import { getEventDetailPath } from "@/lib/sport-config";
import UrgencyBadge from "./UrgencyBadge";
import FreshnessBadge from "./FreshnessBadge";
import { ConflictBadge } from "./VerificationConflictBadge";

function formatDate(dateStr) {
  if (!dateStr) return "日程未定";
  const d = new Date(dateStr);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})`;
}

function formatDistances(distanceList) {
  if (!distanceList) return [];
  return [
    ...new Set(
      distanceList.split(",").map((d) => {
        const km = parseFloat(d);
        if (isNaN(km)) return null;
        if (km > 42.5) return "ウルトラ";
        if (km >= 42 && km <= 42.5) return "フル";
        if (km >= 20 && km <= 22) return "ハーフ";
        const rounded = km % 1 === 0 ? km : Math.round(km * 10) / 10;
        return `${rounded}km`;
      }).filter(Boolean)
    ),
  ];
}

function EntryBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${getStatusBadgeClassSimple(status)}`}>
      {getStatusLabel(status)}
    </span>
  );
}

function SeoEventCard({ event }) {
  const distances = formatDistances(event.distance_list);
  return (
    <div className="card hover:shadow-md transition-shadow">
      <Link href={getEventDetailPath(event)} className="block p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">
              {event.title}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span>{formatDate(event.event_date)}</span>
              <span className="text-gray-300">|</span>
              <span>{event.prefecture || "エリア未定"}</span>
              {event.venue_name && (
                <>
                  <span className="text-gray-300">|</span>
                  <span>{event.venue_name}</span>
                </>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {distances.map((d) => (
                <span key={d} className="inline-block px-1.5 py-0.5 text-xs bg-blue-50 text-blue-600 rounded">
                  {d}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <EntryBadge status={event.entry_status} />
            <UrgencyBadge event={event} />
          </div>
        </div>
      </Link>
      <div className="px-4 pb-2 -mt-1 flex items-center gap-2">
        <span className="text-[10px] text-gray-400">出典: RUNNET</span>
        <FreshnessBadge event={event} />
        <ConflictBadge level={event.verification_conflict_level} />
      </div>
    </div>
  );
}

/**
 * SEOページ共通の大会一覧レイアウト
 * Server Component — SSR で描画される
 */
export default function SeoEventList({
  title,
  description,
  breadcrumbs,
  events,
  total,
  ctaHref,
  ctaLabel,
  relatedLinks,
  emptyHref,
  emptyLabel,
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Breadcrumbs items={breadcrumbs} />

      <h1 className="text-2xl font-bold text-gray-900 mb-1">{title}</h1>
      <p className="text-sm text-gray-500 mb-6">{description}</p>

      <p className="text-sm text-gray-600 mb-4">{total}件の大会</p>

      {events.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-400 text-sm">該当する大会が見つかりませんでした</p>
          <Link href={emptyHref || "/marathon"} className="inline-block mt-4 text-sm text-blue-600 hover:text-blue-800">
            {emptyLabel || "マラソン大会一覧で探す →"}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <SeoEventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* フィルター付き検索への誘導CTA */}
      {ctaHref && (
        <div className="mt-8 text-center">
          <Link
            href={ctaHref}
            className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl
                       hover:bg-blue-700 transition-colors text-sm shadow-sm"
          >
            {ctaLabel || "条件を絞って探す →"}
          </Link>
        </div>
      )}

      {/* 関連リンク */}
      {relatedLinks && relatedLinks.length > 0 && (
        <div className="mt-10 pt-8 border-t border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 mb-3">関連する条件で探す</h2>
          <div className="flex flex-wrap gap-2">
            {relatedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200
                           rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
