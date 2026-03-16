"use client";

import { useState, useEffect, useCallback } from "react";
import {
  isCompared,
  toggleCompareId,
  getCompareCount,
  getMaxCompare,
} from "@/lib/compare-utils";
import { trackEvent, EVENTS } from "@/lib/analytics";

/**
 * 比較に追加/削除ボタン
 *
 * @param {object} props
 * @param {number} props.eventId - 大会ID
 * @param {string} [props.eventTitle] - 大会名（計測用）
 * @param {"icon"|"full"|"compact"} [props.variant="icon"] - 表示バリエーション
 * @param {string} [props.sourcePage] - 計測用ソースページ名
 */
export default function CompareButton({
  eventId,
  eventTitle = "",
  variant = "icon",
  sourcePage = "",
}) {
  const [compared, setCompared] = useState(false);
  const [showToast, setShowToast] = useState("");

  useEffect(() => {
    setCompared(isCompared(eventId));

    function onCompareChange() {
      setCompared(isCompared(eventId));
    }
    window.addEventListener("compare-change", onCompareChange);
    return () => window.removeEventListener("compare-change", onCompareChange);
  }, [eventId]);

  const handleToggle = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      const result = toggleCompareId(eventId);

      if (result.full) {
        setShowToast(`比較は最大${getMaxCompare()}件までです`);
        setTimeout(() => setShowToast(""), 2500);
        return;
      }

      if (result.added) {
        setCompared(true);
        trackEvent(EVENTS.COMPARE_ADD, {
          marathon_id: eventId,
          marathon_name: eventTitle,
          compare_count: getCompareCount(),
          source_page: sourcePage,
        });
      } else if (result.removed) {
        setCompared(false);
        trackEvent(EVENTS.COMPARE_REMOVE, {
          marathon_id: eventId,
          marathon_name: eventTitle,
          compare_count: getCompareCount(),
          source_page: sourcePage,
        });
      }
    },
    [eventId, eventTitle, sourcePage]
  );

  // ── icon variant: アイコンのみ（FavoriteButtonと同じサイズ感） ──
  if (variant === "icon") {
    return (
      <div className="relative">
        <button
          onClick={handleToggle}
          className={`text-lg p-1 rounded hover:bg-gray-100 transition-colors ${
            compared
              ? "text-blue-600"
              : "text-gray-300 hover:text-blue-500"
          }`}
          title={compared ? "比較から外す" : "比較に追加"}
        >
          {compared ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path
                fillRule="evenodd"
                d="M1 2.75A.75.75 0 0 1 1.75 2h16.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 2.75Zm0 14.5a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1-.75-.75ZM1.75 9a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5ZM12 9.75a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1-.75-.75Z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 6h18M3 12h9m-9 6h18M15 12h6"
              />
            </svg>
          )}
        </button>
        {showToast && (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg z-50">
            {showToast}
          </div>
        )}
      </div>
    );
  }

  // ── compact variant: 小さいボタン（カード用） ──
  if (variant === "compact") {
    return (
      <div className="relative">
        <button
          onClick={handleToggle}
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
            compared
              ? "bg-blue-100 text-blue-700 border border-blue-300"
              : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300"
          }`}
          title={compared ? "比較から外す" : "比較に追加"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-3.5 h-3.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 6h18M3 12h9m-9 6h18M15 12h6"
            />
          </svg>
          {compared ? "比較中" : "比較"}
        </button>
        {showToast && (
          <div className="absolute -bottom-7 left-0 whitespace-nowrap bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg z-50">
            {showToast}
          </div>
        )}
      </div>
    );
  }

  // ── full variant: フルサイズボタン（詳細ページ用） ──
  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
          compared
            ? "bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200"
            : "bg-white text-gray-600 border border-gray-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-400"
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-4 h-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 6h18M3 12h9m-9 6h18M15 12h6"
          />
        </svg>
        {compared ? "比較中" : "比較に追加"}
      </button>
      {showToast && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg z-50">
          {showToast}
        </div>
      )}
    </div>
  );
}
