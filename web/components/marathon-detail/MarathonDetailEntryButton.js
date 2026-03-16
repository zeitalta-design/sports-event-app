"use client";

import { trackEvent, EVENTS } from "@/lib/analytics";

/**
 * エントリーCTAボタン（Client Component / GA4計測 + 人気指数ログ付き）
 */
export default function MarathonDetailEntryButton({ entryUrl, eventId, eventTitle }) {
  function handleClick() {
    // GA4トラッキング
    trackEvent(EVENTS.MARATHON_ENTRY_CLICK, {
      event_id: eventId,
      event_name: eventTitle,
      entry_url: entryUrl,
    });

    // Phase45: 人気指数用の行動ログをDB記録（fire-and-forget）
    try {
      const sessionId =
        typeof window !== "undefined"
          ? localStorage.getItem("taikainaviSessionId") || ""
          : "";
      fetch("/api/events/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          action_type: "entry_click",
          session_id: sessionId,
          source_page: "detail",
          metadata: { entry_url: entryUrl },
        }),
      }).catch(() => {}); // 失敗しても遷移を妨げない
    } catch {
      // ignore
    }
  }

  return (
    <a
      href={entryUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="inline-flex items-center gap-2 px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold text-base rounded-xl transition-colors shadow-md hover:shadow-lg"
    >
      エントリーする（外部サイト）
      <span className="text-sm">↗</span>
    </a>
  );
}
