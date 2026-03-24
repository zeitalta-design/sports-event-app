"use client";
import { useState, useCallback } from "react";
import { getMyEventsStatuses, setEventStatus } from "@/lib/my-events-manager";

/**
 * 「カレンダーに追加」ボタン — サイト全体で使用する共通コンポーネント
 *
 * variant:
 *   "default"  — テキスト付きボタン（詳細ページ用）
 *   "compact"  — アイコン+短テキスト（カード一覧用）
 *   "icon"     — アイコンのみ（ShowcaseCard用）
 */
export default function AddToCalendarButton({
  eventId,
  variant = "default",
}) {
  const [showToast, setShowToast] = useState("");

  const isAdded = useCallback(() => {
    const statuses = getMyEventsStatuses();
    return !!statuses[eventId];
  }, [eventId]);

  const [added, setAdded] = useState(() => isAdded());

  const handleClick = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (added) {
        setShowToast("追加済みです");
        setTimeout(() => setShowToast(""), 2000);
        return;
      }

      setEventStatus(eventId, "considering");
      setAdded(true);
      setShowToast("マイカレンダーに追加しました");
      setTimeout(() => setShowToast(""), 2500);
    },
    [eventId, added]
  );

  // カレンダーアイコン
  const CalIcon = ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      {!added && (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9" />
      )}
    </svg>
  );

  if (variant === "icon") {
    return (
      <div className="relative">
        <button
          onClick={handleClick}
          className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all ${
            added
              ? "bg-blue-50 text-blue-600 border-blue-200"
              : "bg-white text-gray-400 border-gray-200 hover:bg-blue-50 hover:text-blue-500 hover:border-blue-200"
          }`}
          aria-label={added ? "カレンダー追加済み" : "カレンダーに追加"}
        >
          <CalIcon className="w-4 h-4" />
        </button>
        {showToast && (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg z-50">
            {showToast}
          </div>
        )}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className="relative inline-flex">
        <button
          onClick={handleClick}
          className={`inline-flex items-center gap-1 text-sm transition-colors ${
            added
              ? "text-blue-600"
              : "text-gray-500 hover:text-blue-600"
          }`}
          aria-label={added ? "カレンダー追加済み" : "カレンダーに追加"}
        >
          <CalIcon className="w-4 h-4" />
          <span className="text-xs font-medium">{added ? "追加済" : "予定"}</span>
        </button>
        {showToast && (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg z-50">
            {showToast}
          </div>
        )}
      </div>
    );
  }

  // default variant
  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
          added
            ? "bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100"
            : "bg-white text-gray-600 border border-gray-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-400"
        }`}
      >
        <CalIcon />
        {added ? "カレンダー追加済み" : "カレンダーに追加"}
      </button>
      {showToast && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg z-50">
          {showToast}
        </div>
      )}
    </div>
  );
}
