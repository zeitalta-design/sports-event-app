import { memo, useMemo } from "react";
import Link from "next/link";
import CompareButton from "@/components/CompareButton";
import SaveButton from "@/components/SaveButton";
import AddToCalendarButton from "@/components/AddToCalendarButton";
import PopularityBadge from "@/components/PopularityBadge";
import OfficialStatusBadge from "@/components/OfficialStatusBadge";
import OrganizerVerifiedBadge from "@/components/OrganizerVerifiedBadge";
import { getStatusLabel } from "@/lib/entry-status";
import { getEventImageUrl, getPlaceholderProps } from "@/lib/event-image";
import { getEventDetailPath } from "@/lib/sport-config";
import {
  formatEventDate,
  formatEventLocation,
  formatVenueName,
  formatSportType,
  formatDescription,
  formatDeadline,
  extractAllTags,
} from "@/lib/event-list-formatters";

// ── Phase64: 締切バッジ（色分け対応） ──
function DeadlineBadge({ entryEndDate }) {
  const deadline = formatDeadline(entryEndDate);
  if (!deadline) return null;

  // 日数を再計算
  const endDate = new Date(entryEndDate);
  const now = new Date();
  const diffDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

  let style = "bg-gray-50 text-gray-600 border-gray-200"; // normal
  let icon = "📅";

  if (diffDays <= 0) {
    style = "bg-red-100 text-red-700 border-red-300";
    icon = "🔴";
  } else if (diffDays <= 3) {
    style = "bg-red-50 text-red-600 border-red-200";
    icon = "🔥";
  } else if (diffDays <= 7) {
    style = "bg-amber-50 text-amber-700 border-amber-200";
    icon = "⏰";
  } else if (diffDays <= 14) {
    style = "bg-blue-50 text-blue-600 border-blue-200";
    icon = "📅";
  }

  const label = diffDays <= 0 ? "本日締切" : `あと${diffDays}日`;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded border ${style}`}>
      <span>{icon}</span>
      {label}
    </span>
  );
}

// ── ジャンルバッジ（一覧用：スポーツ別色分け） ──
function SportBadge({ sportType }) {
  const label = formatSportType(sportType, { listContext: true });
  if (!label) return null;
  const colorMap = {
    marathon: "bg-blue-50 text-blue-700 border-blue-200",
    trail: "bg-green-50 text-green-700 border-green-200",
    triathlon: "bg-red-50 text-red-700 border-red-200",
    cycling: "bg-orange-50 text-orange-700 border-orange-200",
    walking: "bg-cyan-50 text-cyan-700 border-cyan-200",
    swimming: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };
  const cls = colorMap[sportType] || "bg-emerald-50 text-emerald-700 border-emerald-200";
  return (
    <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded border ${cls}`}>
      {label}
    </span>
  );
}

// ── タグチップ ──
function TagChip({ tag }) {
  const styleMap = {
    distance: "bg-blue-50 text-blue-700 border-blue-200",
    difficulty: "bg-amber-50 text-amber-800 border-amber-200",
    event_type: "bg-purple-50 text-purple-700 border-purple-200",
    capacity: "bg-gray-100 text-gray-700 border-gray-200",
    trail_distance: "bg-green-50 text-green-700 border-green-200",
    trail_course: "bg-emerald-50 text-emerald-700 border-emerald-200",
    trail_difficulty: "bg-amber-50 text-amber-800 border-amber-200",
  };
  const cls = styleMap[tag.type] || styleMap.distance;
  return (
    <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded border ${cls}`}>
      {tag.label}
    </span>
  );
}

// ── 画像プレースホルダー ──
function EventImagePlaceholder({ event }) {
  const props = getPlaceholderProps(event);
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center"
      style={{ backgroundColor: props.bgColor }}
    >
      <span className="text-5xl mb-1" role="img" aria-label={props.label}>
        {props.icon}
      </span>
      <span className="text-sm font-medium" style={{ color: props.color }}>
        {props.label}
      </span>
    </div>
  );
}

// ── メインカード（Phase63 再設計 + Phase220 React.memo最適化） ──
export default memo(function EventCard({ event, isFavorite, onFavoriteToggle }) {
  // Phase220: useMemoで重い計算をキャッシュ
  const { imageUrl, date, location, venue, tags, desc, reviewCount, detailPath } = useMemo(() => ({
    imageUrl: getEventImageUrl(event),
    date: formatEventDate(event.event_date),
    location: formatEventLocation(event),
    venue: formatVenueName(event),
    tags: extractAllTags(event),
    desc: formatDescription(event),
    reviewCount: event.review_count || 0,
    detailPath: getEventDetailPath(event),
  }), [event]);

  return (
    <div className="card group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex flex-col sm:flex-row">
        {/* ── 画像エリア ── */}
        <Link
          href={detailPath}
          className="relative block flex-shrink-0 w-full sm:w-56 md:w-64 overflow-hidden rounded-t-lg sm:rounded-t-none sm:rounded-l-lg bg-gray-50"
          style={{ aspectRatio: "16/9" }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={event.title || "大会画像"}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div className={imageUrl ? "hidden w-full h-full" : "w-full h-full"}>
            <EventImagePlaceholder event={event} />
          </div>
        </Link>

        {/* ── 情報エリア ── */}
        <div className="flex-1 min-w-0 p-4 sm:p-5 flex flex-col">
          {/* 上段: 日付・場所・ジャンル + 締切バッジ */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm mb-2.5" style={{ color: "#1a1a1a" }}>
            <span className="inline-flex items-center gap-1">
              <svg className="w-4 h-4" style={{ color: "#1a1a1a" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {date}
            </span>
            <span className="inline-flex items-center gap-1">
              <svg className="w-4 h-4" style={{ color: "#1a1a1a" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {location}
            </span>
            {venue && location !== venue && (
              <span style={{ color: "#1a1a1a" }}>{venue}</span>
            )}
            <SportBadge sportType={event.sport_type} />
            {event.popularity_score >= 40 && (
              <PopularityBadge
                score={event.popularity_score}
                label={event.popularity_label}
                popularityKey={event.popularity_key}
                size="sm"
              />
            )}
            <OrganizerVerifiedBadge
              status={event.organizer_verified}
              updatedAt={event.updated_at}
              context="list"
            />
          </div>

          {/* メイン: 大会名 + 受付状態 */}
          <div className="flex items-start gap-3 mb-2">
            <Link href={detailPath} className="flex-1 min-w-0">
              <h3 className="font-bold text-lg leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors" style={{ color: "#1a1a1a" }}>
                {event.title}
              </h3>
            </Link>
            <div className="flex-shrink-0 mt-0.5">
              <OfficialStatusBadge event={event} variant="badge" showDeadline />
            </div>
          </div>

          {/* Phase63: 締切バッジ + エントリー状況 */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <DeadlineBadge entryEndDate={event.entry_end_date} />
          </div>

          {/* タグ群 */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {tags.map((tag, i) => (
                <TagChip key={`${tag.type}-${i}`} tag={tag} />
              ))}
            </div>
          )}

          {/* 概要文 */}
          <p className="text-sm leading-relaxed line-clamp-2 mb-3" style={{ color: "#1a1a1a" }}>
            {desc}
          </p>

          {/* 下段: Phase63 CTA強化 — 保存・比較・詳細 */}
          <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-100">
            <div className="flex items-center gap-3">
              {/* 詳細導線 */}
              <Link
                href={`${detailPath}#reviews`}
                className="inline-flex items-center gap-1.5 text-sm hover:text-blue-600 transition-colors"
                style={{ color: "#1a1a1a" }}
                aria-label={reviewCount > 0 ? `${reviewCount}件のレビュー` : "詳細を見る"}
              >
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-2.763-.73A8.994 8.994 0 003 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                {reviewCount > 0 ? `${reviewCount}件` : "詳細"}
              </Link>

              {/* Phase63: 保存ボタン */}
              <SaveButton
                eventId={event.id}
                variant="compact"
              />

              {/* カレンダーに追加 */}
              <AddToCalendarButton
                eventId={event.id}
                variant="compact"
              />

              {/* 比較ボタン */}
              <CompareButton
                eventId={event.id}
                eventTitle={event.title}
                variant="compact"
                sourcePage="search"
              />

              {/* 出典 */}
              <span className="text-xs hidden sm:inline" style={{ color: "#1a1a1a" }}>出典: RUNNET</span>
            </div>

            {/* お気に入り（大きめ丸ボタン） */}
            <div className="flex items-center">
              {onFavoriteToggle && (
                <button
                  onClick={() => onFavoriteToggle(event.id)}
                  className={`flex items-center justify-center w-10 h-10 rounded-full border transition-all ${
                    isFavorite
                      ? "bg-red-50 text-red-500 border-red-200 hover:bg-red-100"
                      : "bg-white text-gray-400 border-gray-200 hover:bg-red-50 hover:text-red-400 hover:border-red-200"
                  }`}
                  aria-label={isFavorite ? "お気に入り解除" : "お気に入りに追加"}
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
