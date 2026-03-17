"use client";

import Link from "next/link";
import { useAuthStatus } from "@/lib/use-auth-status";

/**
 * Phase140: 口コミ・レビューセクション（拡張版）
 *
 * - 平均評価 + 件数
 * - カテゴリ別評価バー
 * - 新着3件表示
 * - 「もっと見る」導線
 * - 口コミ投稿CTA（認証対応）
 */

const CATEGORY_LABELS = [
  { key: "rating_course", label: "コース" },
  { key: "rating_access", label: "アクセス" },
  { key: "rating_venue", label: "会場・運営" },
  { key: "rating_beginner", label: "初心者向け" },
];

const PARTICIPANT_LABELS = {
  beginner: "初心者",
  intermediate: "中級者",
  experienced: "上級者",
  spectator: "観戦者",
};

export default function EventCommentsSection({ reviews = [], eventId, eventTitle, sportType, reviewsPath }) {
  const { isLoggedIn } = useAuthStatus();

  const avgOverall = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + (r.rating_overall || r.rating || 0), 0) / reviews.length
    : 0;

  const categoryAverages = {};
  for (const cat of CATEGORY_LABELS) {
    const rated = reviews.filter((r) => r[cat.key] > 0);
    if (rated.length > 0) {
      categoryAverages[cat.key] = rated.reduce((sum, r) => sum + r[cat.key], 0) / rated.length;
    }
  }

  const displayReviews = reviews.slice(0, 3);
  const allReviewsPath = reviewsPath || `/marathon/${eventId}/reviews`;
  const writeReviewPath = `/reviews/new?event_id=${eventId}${eventTitle ? `&event_title=${encodeURIComponent(eventTitle)}` : ""}${sportType ? `&sport_type=${sportType}` : ""}`;

  return (
    <div id="reviews" className="card p-6 scroll-mt-20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">参加者の口コミ</h2>
        <ReviewWriteLink
          isLoggedIn={isLoggedIn}
          writeReviewPath={writeReviewPath}
          variant="text"
        />
      </div>

      {reviews.length > 0 ? (
        <>
          {/* サマリーエリア */}
          <div className="flex flex-col sm:flex-row gap-4 mb-5 pb-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="text-center">
                <span className="text-3xl font-bold text-gray-900">
                  {avgOverall.toFixed(1)}
                </span>
                <div className="flex text-yellow-400 text-sm mt-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={star <= Math.round(avgOverall) ? "text-yellow-400" : "text-gray-200"}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{reviews.length}件の口コミ</p>
              </div>
            </div>

            {Object.keys(categoryAverages).length > 0 && (
              <div className="flex-1 space-y-1.5">
                {CATEGORY_LABELS.map((cat) => {
                  const avg = categoryAverages[cat.key];
                  if (!avg) return null;
                  return (
                    <div key={cat.key} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-16 flex-shrink-0">{cat.label}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-400 rounded-full"
                          style={{ width: `${(avg / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 w-7 text-right tabular-nums">{avg.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 新着レビュー */}
          <div className="space-y-4">
            {displayReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>

          {/* もっと見る + 投稿CTA */}
          <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
            {reviews.length > 3 && (
              <Link
                href={allReviewsPath}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                すべての口コミを見る（{reviews.length}件）
              </Link>
            )}
            <ReviewWriteLink
              isLoggedIn={isLoggedIn}
              writeReviewPath={writeReviewPath}
              variant="button"
            />
          </div>
        </>
      ) : (
        /* 空状態 */
        <div className="text-center py-8">
          <p className="text-4xl mb-3">💬</p>
          <p className="text-sm font-medium text-gray-600 mb-1">まだ口コミがありません</p>
          <p className="text-xs text-gray-400 mb-5 max-w-xs mx-auto">
            この大会に参加したことがある方、ぜひ体験を共有してください。あなたの声が次のランナーの参考になります。
          </p>
          <ReviewWriteLink
            isLoggedIn={isLoggedIn}
            writeReviewPath={writeReviewPath}
            variant="primary"
          />
        </div>
      )}
    </div>
  );
}

/**
 * 認証状態に応じた口コミ投稿リンク
 * variant: "text" | "button" | "primary"
 */
function ReviewWriteLink({ isLoggedIn, writeReviewPath, variant }) {
  // ログイン済み → 直接投稿ページへ
  if (isLoggedIn) {
    if (variant === "text") {
      return (
        <Link
          href={writeReviewPath}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
          data-track="review_write_link"
        >
          口コミを書く
        </Link>
      );
    }
    if (variant === "button") {
      return (
        <Link
          href={writeReviewPath}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          data-track="review_write_button"
        >
          <span>✍️</span>
          この大会の口コミを書く
        </Link>
      );
    }
    // primary
    return (
      <Link
        href={writeReviewPath}
        className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        data-track="review_write_primary"
      >
        <span>✍️</span>
        最初の口コミを書く
      </Link>
    );
  }

  // 未ログイン → ログイン誘導
  if (variant === "text") {
    return (
      <Link
        href={`/login?redirect=${encodeURIComponent(writeReviewPath)}`}
        className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
        data-track="review_login_link"
      >
        ログインして口コミを書く
      </Link>
    );
  }
  if (variant === "button") {
    return (
      <Link
        href={`/login?redirect=${encodeURIComponent(writeReviewPath)}`}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        data-track="review_login_button"
      >
        <span>✍️</span>
        ログインして口コミを書く
      </Link>
    );
  }
  // primary
  return (
    <div className="flex flex-col items-center gap-2">
      <Link
        href={`/login?redirect=${encodeURIComponent(writeReviewPath)}`}
        className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        data-track="review_login_primary"
      >
        <span>✍️</span>
        ログインして最初の口コミを書く
      </Link>
      <Link
        href={`/signup?redirect=${encodeURIComponent(writeReviewPath)}`}
        className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
        data-track="review_signup_link"
      >
        会員登録はこちら（無料）
      </Link>
    </div>
  );
}

function ReviewCard({ review }) {
  const rating = review.rating_overall || review.rating || 0;
  const nickname = review.nickname || review.author_name || "匿名ランナー";
  const title = review.review_title || review.title;
  const body = review.review_body || review.body;
  const participantLabel = PARTICIPANT_LABELS[review.participant_type];

  return (
    <div className="pb-4 border-b border-gray-50 last:border-b-0 last:pb-0">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex text-yellow-400 text-xs">
          {[1, 2, 3, 4, 5].map((star) => (
            <span key={star} className={star <= rating ? "text-yellow-400" : "text-gray-200"}>
              ★
            </span>
          ))}
        </div>
        <span className="text-xs font-medium text-gray-600">{nickname}</span>
        {participantLabel && (
          <span className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded">
            {participantLabel}
          </span>
        )}
        {review.year_joined && (
          <span className="text-[10px] text-gray-300">{review.year_joined}年参加</span>
        )}
        {review.created_at && (
          <span className="text-[10px] text-gray-300 ml-auto">{review.created_at.slice(0, 10)}</span>
        )}
      </div>

      {title && (
        <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
      )}

      {body && (
        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap line-clamp-4">
          {body}
        </p>
      )}

      {review.recommended_for && (
        <p className="text-xs text-gray-500 mt-1.5">
          <span className="text-gray-400">向いている人:</span> {review.recommended_for}
        </p>
      )}
    </div>
  );
}
