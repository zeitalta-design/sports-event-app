"use client";

import { trackEvent, EVENTS } from "@/lib/analytics";

/**
 * 外部リンクカード（GA4計測 + 人気指数ログ付き）
 * 詳細ページのRUNNET/moshicom/公式サイトリンクで使用
 */
export default function ExternalLinkCard({ sourceUrl, officialUrl, eventId, eventTitle }) {
  const isMoshicom = officialUrl?.includes("moshicom");
  const sourceLabel = isMoshicom
    ? "データ出典: RUNNET / moshicom"
    : "データ出典: RUNNET";

  // Phase45: 人気指数用の行動ログをDB記録（fire-and-forget）
  function logEntryClick(url) {
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
          metadata: { url },
        }),
      }).catch(() => {});
    } catch {
      // ignore
    }
  }

  function handleSourceClick() {
    trackEvent(EVENTS.EXTERNAL_RUNNET, {
      event_id: eventId,
      event_title: eventTitle,
      url: sourceUrl,
    });
    logEntryClick(sourceUrl);
  }

  function handleOfficialClick() {
    const eventName = isMoshicom ? EVENTS.EXTERNAL_MOSHICOM : EVENTS.EXTERNAL_OFFICIAL;
    trackEvent(eventName, {
      event_id: eventId,
      event_title: eventTitle,
      url: officialUrl,
    });
    logEntryClick(officialUrl);
  }

  return (
    <div className="card p-5 space-y-3">
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleSourceClick}
          className="block w-full text-center px-4 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors text-sm"
        >
          RUNNETで見る（外部サイト） ↗
        </a>
      )}
      {officialUrl && (
        <a
          href={officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleOfficialClick}
          className="block w-full text-center btn-secondary"
        >
          {isMoshicom
            ? "moshicomで見る（外部サイト） ↗"
            : "公式サイトを見る（外部サイト） ↗"}
        </a>
      )}
      <p className="text-xs text-gray-400 text-center">{sourceLabel}</p>
    </div>
  );
}
