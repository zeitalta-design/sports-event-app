"use client";

import Link from "next/link";
import { useAuthStatus } from "@/lib/use-auth-status";

/**
 * Phase193: 大会コミュニティセクション
 *
 * 「参加者の声」を1つのセクションにまとめて表示。
 * ・おすすめポイント（高評価カテゴリ）
 * ・注意点（低評価カテゴリ）
 * ・こんな人におすすめ（recommended_for集計）
 * ・最新口コミ抜粋
 * ・口コミ投稿CTA
 */

export default function CommunityVoicesSection({
  reviews = [],
  reviewSummary,
  reviewInsights = [],
  eventId,
  eventTitle,
  sportType,
  reviewsPath,
}) {
  const { isLoggedIn } = useAuthStatus();

  // 口コミが1件もなければ非表示
  if (!reviews || reviews.length === 0) return null;

  const positives = reviewInsights.filter((i) => i.type === "positive");
  const cautions = reviewInsights.filter((i) => i.type === "caution" || i.type === "info");

  // recommended_for を集計
  const recommendedTags = aggregateRecommendedFor(reviews);

  // 最新レビュー抜粋（本文があるものから最大2件）
  const excerpts = reviews
    .filter((r) => (r.review_body || r.body)?.trim().length > 20)
    .slice(0, 2);

  const allReviewsPath = reviewsPath || `/marathon/${eventId}/reviews`;
  const writeReviewPath = `/reviews/new?event_id=${eventId}${eventTitle ? `&event_title=${encodeURIComponent(eventTitle)}` : ""}${sportType ? `&sport_type=${sportType}` : ""}`;

  return (
    <div className="card p-5" data-track="community_voices_view">
      <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
        <span className="text-lg">🗣️</span>
        参加者の声
        {reviewSummary?.total > 0 && (
          <span className="text-xs font-normal text-gray-400 ml-1">
            ({reviewSummary.total}件の口コミから)
          </span>
        )}
      </h3>

      {/* おすすめポイント＋注意点 */}
      {(positives.length > 0 || cautions.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {positives.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs font-bold text-green-700 mb-2">おすすめポイント</p>
              <ul className="space-y-1.5">
                {positives.map((p, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-green-800">
                    <span className="flex-shrink-0 mt-0.5">{p.icon}</span>
                    <span>{p.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {cautions.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-bold text-amber-700 mb-2">注意点</p>
              <ul className="space-y-1.5">
                {cautions.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-amber-800">
                    <span className="flex-shrink-0 mt-0.5">{c.icon}</span>
                    <span>{c.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* こんな人におすすめ */}
      {recommendedTags.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-gray-600 mb-1.5">こんな人におすすめ</p>
          <div className="flex flex-wrap gap-1.5">
            {recommendedTags.map((tag) => (
              <span
                key={tag.text}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full"
              >
                {tag.text}
                {tag.count > 1 && (
                  <span className="text-indigo-400 font-medium">{tag.count}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 口コミ抜粋 */}
      {excerpts.length > 0 && (
        <div className="space-y-3 mb-4">
          {excerpts.map((review) => (
            <ReviewExcerpt key={review.id} review={review} />
          ))}
        </div>
      )}

      {/* フッター: もっと見る＋口コミ投稿 */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-100">
        <Link
          href={allReviewsPath}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
          data-track="community_all_reviews"
        >
          すべての口コミを見る →
        </Link>
        {isLoggedIn ? (
          <Link
            href={writeReviewPath}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors"
            data-track="community_write_review"
          >
            口コミを書く
          </Link>
        ) : (
          <Link
            href={`/login?redirect=${encodeURIComponent(writeReviewPath)}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors"
            data-track="community_login_review"
          >
            ログインして口コミを書く
          </Link>
        )}
      </div>
    </div>
  );
}

// ── 口コミ抜粋カード ──

function ReviewExcerpt({ review }) {
  const rating = review.rating_overall || review.rating || 0;
  const nickname = review.nickname || review.author_name || "匿名ランナー";
  const body = review.review_body || review.body || "";
  const truncated = body.length > 100 ? body.slice(0, 100) + "..." : body;

  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="flex text-yellow-400 text-xs">
          {[1, 2, 3, 4, 5].map((star) => (
            <span key={star} className={star <= rating ? "" : "text-gray-200"}>
              ★
            </span>
          ))}
        </div>
        <span className="text-xs text-gray-500">{nickname}</span>
        {review.year_joined && (
          <span className="text-[10px] text-gray-300">{review.year_joined}年参加</span>
        )}
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">{truncated}</p>
    </div>
  );
}

// ── recommended_for 集計 ──

function aggregateRecommendedFor(reviews) {
  const tagCounts = {};
  for (const r of reviews) {
    const rec = r.recommended_for;
    if (!rec) continue;
    // カンマ or 読点で分割
    const parts = rec.split(/[,、]/);
    for (const part of parts) {
      const text = part.trim();
      if (text.length > 0 && text.length <= 30) {
        tagCounts[text] = (tagCounts[text] || 0) + 1;
      }
    }
  }
  return Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([text, count]) => ({ text, count }));
}
