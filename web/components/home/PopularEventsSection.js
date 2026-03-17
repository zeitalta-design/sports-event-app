"use client";
import Link from "next/link";
import PopularityBadge from "@/components/PopularityBadge";
import { getStatusLabel } from "@/lib/entry-status";
import { getEventImageUrl, getPlaceholderProps } from "@/lib/event-image";
import { getEventDetailPath, SPORT_CONFIGS } from "@/lib/sport-config";
import { formatEventDate, formatEventLocation, formatSportType, formatDistanceBadges } from "@/lib/event-list-formatters";

function RankBadge({ rank }) {
  const styles = {
    1: "bg-amber-400 text-amber-900 ring-amber-300",
    2: "bg-gray-300 text-gray-700 ring-gray-200",
    3: "bg-orange-300 text-orange-800 ring-orange-200",
  };
  const cls = styles[rank] || "bg-gray-200 text-gray-600 ring-gray-100";
  return (
    <span className={`absolute top-3 left-3 z-10 w-7 h-7 flex items-center justify-center
                      rounded-full text-xs font-extrabold ring-2 shadow-sm ${cls}`}>
      {rank}
    </span>
  );
}

function PopularEventCard({ event, rank }) {
  const imageUrl = getEventImageUrl(event);
  const placeholder = getPlaceholderProps(event);
  const date = formatEventDate(event.event_date);
  const location = formatEventLocation(event);
  const statusLabel = getStatusLabel(event.entry_status);
  const isOpen = event.entry_status === "open";
  const distances = formatDistanceBadges(event.distance_list);

  return (
    <Link
      href={getEventDetailPath(event)}
      className="group flex-shrink-0 w-[280px] sm:w-auto block"
    >
      <div className="card overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200 h-full">
        {/* 画像 — 横長 16:9 + object-contain */}
        <div className="relative overflow-hidden bg-gray-50" style={{ aspectRatio: "16/9" }}>
          <RankBadge rank={rank} />
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={event.title || "大会画像"}
              className="w-full h-full object-contain bg-gray-50 group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div
            className={`${imageUrl ? "hidden" : ""} w-full h-full flex flex-col items-center justify-center`}
            style={{ backgroundColor: placeholder.bgColor }}
          >
            <span className="text-4xl mb-1">{placeholder.icon}</span>
            <span className="text-xs font-medium" style={{ color: placeholder.color }}>
              {placeholder.label}
            </span>
          </div>
          {/* ステータスオーバーレイ */}
          <span className={`absolute top-3 right-3 px-2 py-0.5 text-[10px] font-bold rounded-md shadow-sm ${
            isOpen ? "bg-pink-500 text-white" : "bg-gray-700/70 text-white"
          }`}>
            {statusLabel}
          </span>
        </div>

        {/* 情報 */}
        <div className="p-3.5">
          {/* Phase52: marathon以外にスポーツラベル表示 */}
          {event.sport_type && event.sport_type !== "marathon" && (() => {
            const sport = SPORT_CONFIGS.find((s) => s.sportTypeForDb === event.sport_type);
            return sport ? (
              <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mb-1"
                    style={{ backgroundColor: `${sport.themeColor}15`, color: sport.themeColor }}>
                {sport.icon} {sport.shortLabel || sport.label}
              </span>
            ) : null;
          })()}
          <h3
            className="font-bold text-sm leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors min-h-[2.5rem]"
            style={{ color: "#1a1a1a" }}
          >
            {event.title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium" style={{ color: "#1a1a1a" }}>
            <span className="inline-flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {date}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {location}
            </span>
          </div>
          {distances.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {distances.slice(0, 3).map((d) => (
                <span key={d} className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 rounded border border-blue-100">
                  {d}
                </span>
              ))}
            </div>
          )}
          {event.popularity_score >= 40 && (
            <div className="mt-2">
              <PopularityBadge
                score={event.popularity_score}
                label={event.popularity_label}
                popularityKey={event.popularity_key}
                size="sm"
              />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function PopularEventsSection({ events = [] }) {
  if (events.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
      {/* 見出し */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-7 bg-blue-600 rounded-full" />
        <h2 className="text-xl sm:text-2xl font-bold" style={{ color: "#1a1a1a" }}>今人気の大会</h2>
      </div>

      {/* カード横並び */}
      <div className="flex gap-4 overflow-x-auto pb-2 sm:pb-0 sm:overflow-visible sm:grid sm:grid-cols-5 scrollbar-hide">
        {events.map((event, i) => (
          <PopularEventCard key={event.id} event={event} rank={i + 1} />
        ))}
      </div>
    </section>
  );
}
