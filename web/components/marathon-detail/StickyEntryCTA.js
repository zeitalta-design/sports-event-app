"use client";

import { useState, useEffect } from "react";
import { trackEvent, EVENTS } from "@/lib/analytics";

/**
 * Phase98: モバイル固定エントリーバー
 *
 * スクロールするとページ下部に固定表示されるCTAバー。
 * スポーツエントリーの「参加申込をする」バー相当。
 */
export default function StickyEntryCTA({
  entryUrl,
  sourceUrl,
  eventId,
  eventTitle,
  officialEntryStatus,
  entryStatus,
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      // ヒーローセクションを過ぎたら表示
      setVisible(window.scrollY > 500);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const hasEntry =
    entryUrl &&
    (entryStatus === "open" ||
      ["open", "closing_soon", "capacity_warning"].includes(
        officialEntryStatus
      ));

  if (!hasEntry && !sourceUrl) return null;

  function handleEntryClick() {
    trackEvent(EVENTS.MARATHON_ENTRY_CLICK, {
      event_id: eventId,
      event_name: eventTitle,
      entry_url: entryUrl,
      source: "sticky_bar",
    });
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
          action_type: "cta_click",
          session_id: sessionId,
          source_page: "detail_sticky",
          metadata: { entry_url: entryUrl },
        }),
      }).catch(() => {});
    } catch {
      // ignore
    }
  }

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg transition-transform duration-300 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
        {/* 大会名（省略表示） */}
        <div className="flex-1 min-w-0 hidden sm:block">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {eventTitle}
          </p>
        </div>

        {/* ボタン群 */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {sourceUrl && !hasEntry && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-lg transition-colors shadow-md"
            >
              {sourceUrl.includes("sportsentry.ne.jp") ? "スポーツエントリー"
                : sourceUrl.includes("moshicom.com") && !sourceUrl.includes("runnet.jp") ? "MOSHICOM"
                : sourceUrl.includes("runnet.jp") ? "RUNNET"
                : "公式サイト"}で詳細を見る ↗
            </a>
          )}
          {hasEntry && (
            <>
              <a
                href={entryUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleEntryClick}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold text-base rounded-lg transition-colors shadow-md"
              >
                エントリーする ↗
              </a>
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  公式サイト
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
