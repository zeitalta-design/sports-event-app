"use client";

import Link from "next/link";
import { STATUS_NEXT_ACTIONS } from "@/lib/my-events-manager";

/**
 * Phase100: 次アクション提案
 * 大会のステータスに応じて次にやることを提示する。
 */
export default function NextActionHint({ status, event }) {
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
