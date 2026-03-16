"use client";

/**
 * Phase63: 保存ボタンコンポーネント
 *
 * あとで見る機能のトグルボタン。
 * CompareButtonと同じパターン。
 */

import { useState, useEffect, useCallback } from "react";
import { isSaved, toggleSavedId, getSavedCount, getMaxSaved } from "@/lib/saved-events-storage";

export default function SaveButton({
  eventId,
  variant = "icon",
}) {
  const [saved, setSaved] = useState(false);
  const [showToast, setShowToast] = useState("");

  useEffect(() => {
    setSaved(isSaved(eventId));

    function onSavedChange() {
      setSaved(isSaved(eventId));
    }
    window.addEventListener("saved-change", onSavedChange);
    return () => window.removeEventListener("saved-change", onSavedChange);
  }, [eventId]);

  const handleToggle = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      const result = toggleSavedId(eventId);

      if (result.full) {
        setShowToast(`保存は最大${getMaxSaved()}件までです`);
        setTimeout(() => setShowToast(""), 2500);
        return;
      }

      if (result.added) {
        setSaved(true);
      } else if (result.removed) {
        setSaved(false);
      }
    },
    [eventId]
  );

  // compact variant
  if (variant === "compact") {
    return (
      <div className="relative">
        <button
          onClick={handleToggle}
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
            saved
              ? "bg-amber-100 text-amber-700 border border-amber-300"
              : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300"
          }`}
          title={saved ? "保存解除" : "あとで見る"}
        >
          <svg className="w-3.5 h-3.5" fill={saved ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
          </svg>
          {saved ? "保存中" : "保存"}
        </button>
        {showToast && (
          <div className="absolute -bottom-7 left-0 whitespace-nowrap bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg z-50">
            {showToast}
          </div>
        )}
      </div>
    );
  }

  // icon variant (default)
  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className={`text-lg p-1 rounded hover:bg-gray-100 transition-colors ${
          saved ? "text-amber-500" : "text-gray-300 hover:text-amber-400"
        }`}
        title={saved ? "保存解除" : "あとで見る"}
      >
        <svg className="w-5 h-5" fill={saved ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
        </svg>
      </button>
      {showToast && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg z-50">
          {showToast}
        </div>
      )}
    </div>
  );
}
