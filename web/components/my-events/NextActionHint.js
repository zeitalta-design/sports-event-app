"use client";

import Link from "next/link";
import { STATUS_NEXT_ACTIONS } from "@/lib/my-events-manager";

/**
 * Phase100+145+174: 次アクション提案
 * 大会のステータスに応じて次にやることを提示する。
 * Phase174: completed の場合は参加後ループの複数アクションを表示。
 */
export default function NextActionHint({ status, event }) {
  // Phase174: 完了大会には参加後ループの複数アクションを提示
  if (status === "completed" && event?.id) {
    const reviewPath = `/reviews/new?event_id=${event.id}${event.title ? `&event_title=${encodeURIComponent(event.title)}` : ""}`;
    const resultsPath = `/my-results/link?event_id=${event.id}${event.title ? `&event_title=${encodeURIComponent(event.title)}` : ""}`;
    const photosPath = `/marathon/${event.id}/photos`;
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
        <Link href={reviewPath} className="flex items-center gap-0.5 text-blue-600 hover:text-blue-800 hover:underline" data-track="completed_cta_review">
          <span>✍️</span> 口コミ
        </Link>
        <Link href={resultsPath} className="flex items-center gap-0.5 text-blue-600 hover:text-blue-800 hover:underline" data-track="completed_cta_link_result">
          <span>🔗</span> 結果紐付け
        </Link>
        <Link href={photosPath} className="flex items-center gap-0.5 text-blue-600 hover:text-blue-800 hover:underline" data-track="completed_cta_photos">
          <span>📸</span> 写真
        </Link>
      </div>
    );
  }

  const action = STATUS_NEXT_ACTIONS[status];
  if (!action) return null;

  // entered の場合、entry_url がなければ "エントリーサイト確認" は不要
  // planned の場合、entry_url をリンク先にする
  let linkHref = action.link;
  if (status === "planned" && event?.entry_url) {
    linkHref = event.entry_url;
  }

  return (
    <div className="text-xs text-gray-500 flex items-center gap-1">
      <span>💡</span>
      {linkHref ? (
        <Link
          href={linkHref}
          className="text-blue-600 hover:text-blue-800 hover:underline"
          {...(linkHref.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {action.text}
        </Link>
      ) : (
        <span>{action.text}</span>
      )}
    </div>
  );
}
