"use client";

import Link from "next/link";
import { useAuthStatus } from "@/lib/use-auth-status";

/**
 * Phase174: 参加後CTA
 *
 * 過去の大会詳細ページに表示。
 * 口コミ・結果紐付け・写真閲覧・メモ記録への導線。
 */
export default function PostEventCTA({ eventId, eventTitle, sportType, eventDate, photosPath }) {
  const { isLoggedIn } = useAuthStatus();

  // 未来の大会には表示しない
  if (eventDate) {
    const d = new Date(eventDate);
    if (!isNaN(d.getTime()) && d > new Date()) return null;
  }

  const reviewPath = `/reviews/new?event_id=${eventId}&event_title=${encodeURIComponent(eventTitle || "")}&sport_type=${sportType || "marathon"}`;
  const linkResultPath = `/my-results/link?event_id=${eventId}&event_title=${encodeURIComponent(eventTitle || "")}`;

  return (
    <div className="card p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100" data-track="post_event_cta">
      <h3 className="text-sm font-bold text-gray-700 mb-1">この大会に参加しましたか？</h3>
      <p className="text-xs text-gray-500 mb-3">参加後の記録を残して、次の大会に活かしましょう</p>

      <div className="flex flex-wrap gap-2">
        {isLoggedIn ? (
          <Link
            href={reviewPath}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700 transition-colors"
            data-track="post_event_write_review"
          >
            ✍️ 口コミを書く
          </Link>
        ) : (
          <Link
            href={`/login?redirect=${encodeURIComponent(reviewPath)}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700 transition-colors"
            data-track="post_event_login_review"
          >
            ✍️ ログインして口コミを書く
          </Link>
        )}
        {isLoggedIn && (
          <Link
            href={linkResultPath}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-full hover:bg-blue-50 transition-colors"
            data-track="post_event_link_result"
          >
            🔗 結果を紐付ける
          </Link>
        )}
        {photosPath && (
          <Link
            href={photosPath}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
            data-track="post_event_view_photos"
          >
            📸 写真を見る
          </Link>
        )}
      </div>
    </div>
  );
}
