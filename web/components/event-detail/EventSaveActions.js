"use client";

/**
 * Phase59: あとで見るボタン
 *
 * localStorageベースで「あとで見る」を管理する。
 * ログイン不要。
 */

import { useState, useCallback } from "react";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import { trackEvent, EVENTS } from "@/lib/analytics";

export default function EventSaveActions({
  eventId,
  eventTitle = "",
  sourcePage = "detail",
}) {
  const { saved, toggle } = useSavedEvents(eventId);
  const [showToast, setShowToast] = useState("");

  const handleToggle = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      const result = toggle();

      if (result.full) {
        setShowToast("保存は最大20件までです");
        setTimeout(() => setShowToast(""), 2500);
        return;
      }

      if (result.added) {
        trackEvent(EVENTS.SAVE_ADD || "save_add", {
          marathon_id: eventId,
          marathon_name: eventTitle,
          source_page: sourcePage,
        });
      } else if (result.removed) {
        trackEvent(EVENTS.SAVE_REMOVE || "save_remove", {
          marathon_id: eventId,
          marathon_name: eventTitle,
          source_page: sourcePage,
        });
      }
    },
    [eventId, eventTitle, sourcePage, toggle]
  );

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
          saved
            ? "bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100"
            : "bg-white text-gray-600 border border-gray-300 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-400"
        }`}
      >
        {/* ブックマークアイコン */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={saved ? 0 : 1.5}
          className="w-4 h-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
          />
        </svg>
        {saved ? "保存済み" : "あとで見る"}
      </button>
      {showToast && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg z-50">
          {showToast}
        </div>
      )}
    </div>
  );
}
