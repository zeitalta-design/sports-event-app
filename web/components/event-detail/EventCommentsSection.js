/**
 * Phase55: 口コミ・レビューセクション
 *
 * レビューがある場合は一覧表示、
 * ない場合は「まだ口コミはありません」の器を表示。
 * 将来の口コミ投稿機能の受け皿。
 */
export default function EventCommentsSection({ reviews = [], eventId }) {
  // 平均評価を計算
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
      : 0;

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">口コミ・レビュー</h2>

      {reviews.length > 0 ? (
        <>
          {/* サマリー */}
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold text-gray-900">
                {avgRating.toFixed(1)}
              </span>
              <div className="flex text-yellow-400 text-sm">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={
                      star <= Math.round(avgRating)
                        ? "text-yellow-400"
                        : "text-gray-200"
                    }
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
            <span className="text-sm text-gray-500">
              {reviews.length}件の口コミ
            </span>
          </div>

          {/* レビュー一覧 */}
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="pb-4 border-b border-gray-50 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex text-yellow-400 text-xs">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={
                          star <= (review.rating || 0)
                            ? "text-yellow-400"
                            : "text-gray-200"
                        }
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  {review.author_name && (
                    <span className="text-xs text-gray-400">
                      {review.author_name}
                    </span>
                  )}
                  {review.created_at && (
                    <span className="text-xs text-gray-300">
                      {review.created_at.slice(0, 10)}
                    </span>
                  )}
                </div>
                {review.title && (
                  <p className="text-sm font-semibold text-gray-900 mb-1">
                    {review.title}
                  </p>
                )}
                {review.body && (
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {review.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        /* 空状態 */
        <div className="text-center py-6">
          <p className="text-3xl mb-2">💬</p>
          <p className="text-sm text-gray-400">まだ口コミはありません</p>
          <p className="text-xs text-gray-300 mt-1">
            この大会に参加された方の声をお待ちしています
          </p>
        </div>
      )}
    </div>
  );
}
