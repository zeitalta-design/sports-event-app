"use client";

import Link from "next/link";

/**
 * Phase168+170: 大会振り返り統合カード
 *
 * 結果・口コミ・写真・次アクションを一枚のカードで表示。
 * My Results / 結果ページ / 詳細ページ下部で使用。
 */

const FINISH_STATUS_LABELS = {
  finished: { label: "完走", color: "text-green-600", bg: "bg-green-50" },
  dnf: { label: "DNF", color: "text-red-500", bg: "bg-red-50" },
  dns: { label: "DNS", color: "text-gray-400", bg: "bg-gray-50" },
};

export default function EventRecapCard({ recap, compact = false }) {
  if (!recap?.event) return null;

  const { event, resultsSummary, reviewSummary, photoCount, heroPhoto, contextPhotos, userResult, userReview, nextActions } = recap;

  const heroImg = heroPhoto?.image_url || event.hero_image_url;
  const hasContent = userResult || resultsSummary || reviewSummary || photoCount > 0;

  if (!hasContent && !nextActions?.length) return null;

  return (
    <div className="card overflow-hidden">
      {/* ヒーロー画像バナー */}
      {heroImg && !compact && (
        <div className="relative" style={{ aspectRatio: "21/6" }}>
          <img src={heroImg} alt={event.title} className="w-full h-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-2 left-3 right-3">
            <p className="text-white text-sm font-bold truncate">{event.title}</p>
            <p className="text-white/70 text-xs">
              {event.event_date && new Date(event.event_date).getFullYear()}
              {event.prefecture && ` · ${event.prefecture}`}
            </p>
          </div>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* コンパクト時のタイトル */}
        {compact && (
          <div className="flex items-center gap-2">
            {heroImg && (
              <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                <img src={heroImg} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="min-w-0">
              <Link href={`/marathon/${event.id}`} className="text-sm font-bold text-gray-900 hover:text-blue-600 truncate block">
                {event.title}
              </Link>
              <p className="text-xs text-gray-400">
                {event.event_date && new Date(event.event_date).getFullYear()}
                {event.prefecture && ` · ${event.prefecture}`}
              </p>
            </div>
          </div>
        )}

        {/* 自分の結果 */}
        {userResult && (
          <div className="flex items-center gap-4">
            <div className={`px-3 py-2 rounded-lg ${FINISH_STATUS_LABELS[userResult.finish_status]?.bg || "bg-gray-50"}`}>
              <p className={`text-lg font-bold tabular-nums ${FINISH_STATUS_LABELS[userResult.finish_status]?.color || "text-gray-700"}`}>
                {userResult.finish_time || FINISH_STATUS_LABELS[userResult.finish_status]?.label || "—"}
              </p>
              {userResult.net_time && userResult.net_time !== userResult.finish_time && (
                <p className="text-[10px] text-gray-400 tabular-nums">ネット {userResult.net_time}</p>
              )}
            </div>
            <div className="flex-1 space-y-0.5">
              {userResult.overall_rank && <p className="text-sm text-gray-600">総合 <strong>{userResult.overall_rank}</strong>位</p>}
              {userResult.category_name && <p className="text-xs text-gray-400">{userResult.category_name}</p>}
              {userResult.bib_number && <p className="text-[10px] text-gray-300">No.{userResult.bib_number}</p>}
            </div>
          </div>
        )}

        {/* サマリー帯 */}
        <div className="grid grid-cols-3 gap-2">
          {/* 結果サマリー */}
          {resultsSummary && (
            <Link href={`/marathon/${event.id}/results`} className="bg-gray-50 rounded-lg p-2.5 text-center hover:bg-gray-100 transition-colors">
              <p className="text-xs text-gray-400 mb-0.5">🏆 完走率</p>
              <p className="text-sm font-bold text-gray-800">{resultsSummary.completion_rate}%</p>
              <p className="text-[10px] text-gray-400">{resultsSummary.finisher_count}人完走</p>
            </Link>
          )}

          {/* 口コミサマリー */}
          {reviewSummary && reviewSummary.total > 0 && (
            <Link href={`/marathon/${event.id}/reviews`} className="bg-gray-50 rounded-lg p-2.5 text-center hover:bg-gray-100 transition-colors">
              <p className="text-xs text-gray-400 mb-0.5">💬 口コミ</p>
              <p className="text-sm font-bold text-gray-800">{reviewSummary.avg_overall ? `★${reviewSummary.avg_overall.toFixed(1)}` : `${reviewSummary.total}件`}</p>
              <p className="text-[10px] text-gray-400">{reviewSummary.total}件の評価</p>
            </Link>
          )}

          {/* 写真 */}
          {photoCount > 0 && (
            <Link href={`/marathon/${event.id}/photos`} className="bg-gray-50 rounded-lg p-2.5 text-center hover:bg-gray-100 transition-colors">
              <p className="text-xs text-gray-400 mb-0.5">📸 写真</p>
              <p className="text-sm font-bold text-gray-800">{photoCount}枚</p>
              <p className="text-[10px] text-gray-400">大会の雰囲気</p>
            </Link>
          )}
        </div>

        {/* コンテキスト写真ストリップ */}
        {contextPhotos?.length > 0 && !compact && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
            {contextPhotos.slice(0, 4).map((p) => (
              <div key={p.id} className="flex-shrink-0 w-20 h-14 rounded-md overflow-hidden bg-gray-100">
                <img src={p.thumbnail_url || p.image_url} alt={p.alt_text || ""} className="w-full h-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        )}

        {/* 口コミ投稿状態 */}
        {userReview && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>✅ 口コミ投稿済み</span>
            {userReview.rating_overall && <span>★{userReview.rating_overall}</span>}
          </div>
        )}

        {/* 次のアクション */}
        {nextActions?.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            {nextActions.slice(0, 4).map((action) => (
              <Link
                key={action.key}
                href={action.href}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 rounded-full border border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                data-track={`recap_action_${action.key}`}
              >
                <span>{action.icon}</span>
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
