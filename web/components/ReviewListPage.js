"use client";

import { useState, useEffect, useMemo, memo } from "react";
import Link from "next/link";

/**
 * Phase141: 口コミ一覧ページコンポーネント
 *
 * /marathon/[id]/reviews, /[sportSlug]/[id]/reviews 共通で使用。
 * 並び替え・フィルタ・ページング対応。
 */

const SORT_OPTIONS = [
  { value: "newest", label: "新着順" },
  { value: "rating_high", label: "評価が高い順" },
  { value: "rating_low", label: "評価が低い順" },
  { value: "beginner", label: "初心者向け順" },
];

const PARTICIPANT_FILTERS = [
  { value: "", label: "すべて" },
  { value: "beginner", label: "初心者" },
  { value: "intermediate", label: "中級者" },
  { value: "experienced", label: "上級者" },
];

const PARTICIPANT_LABELS = {
  beginner: "初心者",
  intermediate: "中級者",
  experienced: "上級者",
  spectator: "観戦者",
};

const VISIT_LABELS = {
  first: "初参加",
  repeat: "リピート",
};

const CATEGORY_LABELS = [
  { key: "rating_course", label: "コース" },
  { key: "rating_access", label: "アクセス" },
  { key: "rating_venue", label: "会場・運営" },
  { key: "rating_beginner", label: "初心者向け" },
];

// Phase220: ページネーション導入（100→20件/ページ）+ useMemo最適化
const REVIEW_LIMIT = 20;

export default function ReviewListPage({ eventId, eventTitle, backPath, writeReviewPath }) {
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("newest");
  const [participantFilter, setParticipantFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    loadReviews();
  }, [sort, offset]);

  async function loadReviews() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        event_id: String(eventId),
        sort,
        limit: String(REVIEW_LIMIT),
        offset: String(offset),
      });
      if (participantFilter) params.set("participant_type", participantFilter);
      if (yearFilter) params.set("year", yearFilter);
      const res = await fetch(`/api/reviews?${params}`);
      const data = await res.json();
      setReviews(data.reviews || []);
      setSummary(data.summary || null);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to load reviews:", err);
    } finally {
      setLoading(false);
    }
  }

  // Phase220: フィルタ変更時にオフセットリセット＋再取得
  function handleFilterChange(filterFn) {
    filterFn();
    setOffset(0);
  }

  // Phase220: useMemoでフィルタ結果をキャッシュ
  const filtered = useMemo(() => reviews.filter((r) => {
    if (participantFilter && r.participant_type !== participantFilter) return false;
    if (yearFilter && String(r.year_joined) !== yearFilter) return false;
    return true;
  }), [reviews, participantFilter, yearFilter]);

  // Phase220: useMemoで年度リストをキャッシュ
  const years = useMemo(
    () => [...new Set(reviews.map((r) => r.year_joined).filter(Boolean))].sort((a, b) => b - a),
    [reviews]
  );

  const totalPages = Math.ceil(total / REVIEW_LIMIT);
  const currentPage = Math.floor(offset / REVIEW_LIMIT) + 1;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="mb-6">
        <Link href={backPath} className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block">
          ← 大会ページに戻る
        </Link>
        <h1 className="text-xl font-bold text-gray-900">
          {eventTitle ? `${eventTitle} の口コミ` : "口コミ一覧"}
        </h1>
        {total > 0 && (
          <p className="text-sm text-gray-500 mt-1">{total}件の口コミ</p>
        )}
      </div>

      {/* サマリーカード */}
      {summary && summary.total > 0 && (
        <div className="card p-5 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="text-center sm:text-left">
              <span className="text-3xl font-bold text-gray-900">
                {summary.avg_overall?.toFixed(1) || "-"}
              </span>
              <div className="flex text-yellow-400 text-sm mt-0.5 justify-center sm:justify-start">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className={star <= Math.round(summary.avg_overall || 0) ? "text-yellow-400" : "text-gray-200"}>
                    ★
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{summary.total}件</p>
            </div>
            <div className="flex-1 space-y-1.5">
              {CATEGORY_LABELS.map((cat) => {
                const avg = summary[`avg_${cat.key.replace("rating_", "")}`];
                if (!avg) return null;
                return (
                  <div key={cat.key} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-16 flex-shrink-0">{cat.label}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${(avg / 5) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-600 w-7 text-right tabular-nums">{avg.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* フィルタバー */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setOffset(0); }}
          className="text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-600"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          {PARTICIPANT_FILTERS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setParticipantFilter(opt.value); setOffset(0); }}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                participantFilter === opt.value
                  ? "bg-blue-50 border-blue-300 text-blue-700 font-medium"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {years.length > 1 && (
          <select
            value={yearFilter}
            onChange={(e) => { setYearFilter(e.target.value); setOffset(0); }}
            className="text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-600"
          >
            <option value="">全年度</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
        )}
        <span className="text-xs text-gray-400 ml-auto">{filtered.length}件</span>
      </div>

      {/* レビュー一覧 */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">読み込み中...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">💬</p>
          <p className="text-sm text-gray-400 mb-4">口コミがありません</p>
          <Link
            href={writeReviewPath}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            最初の口コミを書く
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((review) => (
            <ReviewFullCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {/* Phase220: ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setOffset(Math.max(0, offset - REVIEW_LIMIT))}
            disabled={offset === 0}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            前へ
          </button>
          <span className="text-xs text-gray-500">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setOffset(offset + REVIEW_LIMIT)}
            disabled={currentPage >= totalPages}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            次へ
          </button>
        </div>
      )}

      {/* 投稿CTA */}
      {filtered.length > 0 && (
        <div className="mt-8 text-center">
          <Link
            href={writeReviewPath}
            className="inline-flex items-center gap-1.5 px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span>✍️</span>
            この大会の口コミを書く
          </Link>
        </div>
      )}
    </div>
  );
}

// Phase220: React.memoでリスト内の不要な再描画を防止
const ReviewFullCard = memo(function ReviewFullCard({ review }) {
  const rating = review.rating_overall || review.rating || 0;
  const nickname = review.nickname || review.author_name || "匿名ランナー";
  const title = review.review_title || review.title;
  const body = review.review_body || review.body;

  return (
    <div className="card p-5">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex text-yellow-400 text-sm">
          {[1, 2, 3, 4, 5].map((star) => (
            <span key={star} className={star <= rating ? "text-yellow-400" : "text-gray-200"}>★</span>
          ))}
        </div>
        <span className="text-sm font-medium text-gray-700">{nickname}</span>
        {review.participant_type && (
          <span className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded">
            {PARTICIPANT_LABELS[review.participant_type] || review.participant_type}
          </span>
        )}
        {review.visit_type && (
          <span className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-600 rounded">
            {VISIT_LABELS[review.visit_type] || review.visit_type}
          </span>
        )}
      </div>

      {/* メタ */}
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
        {review.year_joined && <span>{review.year_joined}年参加</span>}
        {review.created_at && <span>{review.created_at.slice(0, 10)} 投稿</span>}
      </div>

      {/* タイトル */}
      {title && <p className="text-sm font-bold text-gray-900 mb-1.5">{title}</p>}

      {/* 本文 */}
      {body && (
        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap mb-3">{body}</p>
      )}

      {/* カテゴリ別評価 */}
      {(review.rating_course || review.rating_access || review.rating_venue || review.rating_beginner) && (
        <div className="flex flex-wrap gap-3 mb-2">
          {CATEGORY_LABELS.map((cat) => {
            const val = review[cat.key];
            if (!val) return null;
            return (
              <span key={cat.key} className="text-xs text-gray-500">
                {cat.label}: <span className="text-yellow-500">{"★".repeat(val)}</span><span className="text-gray-200">{"★".repeat(5 - val)}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* おすすめ対象 */}
      {review.recommended_for && (
        <div className="pt-2 border-t border-gray-50">
          <p className="text-xs text-gray-500">
            <span className="text-gray-400">こんな人に向いています:</span> {review.recommended_for}
          </p>
        </div>
      )}
    </div>
  );
});
