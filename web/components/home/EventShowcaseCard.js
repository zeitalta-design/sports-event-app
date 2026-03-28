"use client";
import Link from "next/link";
import { getStatusLabel } from "@/lib/entry-status";
import { getEventImageUrl, getPlaceholderProps } from "@/lib/event-image";
import { getEventDetailPath, SPORT_CONFIGS } from "@/lib/sport-config";
import { formatEventDate, formatEventLocation, formatDistanceBadges } from "@/lib/event-list-formatters";
import AddToCalendarButton from "@/components/AddToCalendarButton";

/**
 * 統一イベントカード — トップページ全セクション共通
 *
 * variant:
 *   "popular"  — 人気ランキング（順位バッジ付き）
 *   "closing"  — 締切間近（締切ラベル最優先）
 *   "featured" — 注目（シンプル）
 *
 * 後方互換: variant="deadline" → "closing" と同等
 */

function daysUntilDeadline(dateStr) {
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

// ── 左上バッジ ──

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

function DeadlineBadge({ days }) {
  if (days === null || days < 0) return null;
  let bg, text;
  if (days === 0) { bg = "bg-red-600"; text = "本日締切"; }
  else if (days <= 3) { bg = "bg-red-500"; text = `あと${days}日`; }
  else if (days <= 7) { bg = "bg-orange-500"; text = `あと${days}日`; }
  else { bg = "bg-amber-500"; text = `あと${days}日`; }
  return (
    <span className={`absolute top-3 left-3 z-10 px-2.5 py-1 text-[11px] font-extrabold text-white rounded-md shadow-sm ${bg}`}>
      {text}
    </span>
  );
}

// ── メインコンポーネント ──

export default function EventShowcaseCard({ event, rank, variant = "popular" }) {
  // 後方互換
  const v = variant === "deadline" ? "closing" : variant;

  const imageUrl = getEventImageUrl(event);
  const placeholder = getPlaceholderProps(event);
  const date = formatEventDate(event.event_date);
  const location = formatEventLocation(event);
  const statusLabel = getStatusLabel(event.entry_status);
  const isOpen = event.entry_status === "open";
  const distances = formatDistanceBadges(event.distance_list);
  const deadlineDays = daysUntilDeadline(event.entry_end_date);

  return (
    <Link
      href={getEventDetailPath(event)}
      className="group flex-shrink-0 w-[260px] sm:w-auto block"
    >
      <div className="overflow-hidden rounded-xl bg-white border border-gray-100
                      shadow-sm hover:shadow-md hover:-translate-y-0.5
                      transition-all duration-200 h-full flex flex-col">
        {/* ── 画像エリア: 16:9 ── */}
        <div className="relative overflow-hidden bg-gray-100" style={{ aspectRatio: "16/9" }}>
          {/* 左上バッジ */}
          {v === "popular" && <RankBadge rank={rank} />}
          {v === "closing" && <DeadlineBadge days={deadlineDays} />}
          {/* featured は左上バッジなし（シンプル） */}

          {/* 画像 or プレースホルダー */}
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={event.title || "大会画像"}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
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

          {/* 右上: 受付ステータス */}
          <span className={`absolute top-3 right-3 px-2 py-0.5 text-[10px] font-bold rounded-md shadow-sm ${
            isOpen ? "bg-pink-500 text-white" : "bg-gray-700/70 text-white"
          }`}>
            {statusLabel}
          </span>
        </div>

        {/* ── 本文エリア ── */}
        <div className="p-3.5 flex-1 flex flex-col">
          {/* スポーツタグ + 締切補助（popular時のみ） */}
          <div className="flex flex-wrap gap-1 mb-1.5">
            {event.sport_type && event.sport_type !== "marathon" && (() => {
              const sport = SPORT_CONFIGS.find((s) => s.sportTypeForDb === event.sport_type);
              return sport ? (
                <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: `${sport.themeColor}15`, color: sport.themeColor }}>
                  {sport.icon} {sport.shortLabel || sport.label}
                </span>
              ) : null;
            })()}
            {v === "popular" && deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 7 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                deadlineDays <= 3 ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"
              }`}>
                締切まであと{deadlineDays}日
              </span>
            )}
          </div>

          {/* 大会名 (2行まで) */}
          <h3
            className="font-bold text-sm leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors min-h-[2.5rem]"
            style={{ color: "#1a1a1a" }}
          >
            {event.title}
          </h3>

          {/* 日付・場所 */}
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

          {/* 種目タグ */}
          {distances.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {distances.slice(0, 3).map((d) => (
                <span key={d} className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 rounded border border-blue-100">
                  {d}
                </span>
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="mt-auto pt-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:text-blue-800 transition-colors">
              詳細を見る
              <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </span>
            <AddToCalendarButton eventId={event.id} variant="icon" />
          </div>
        </div>
      </div>
    </Link>
  );
}
