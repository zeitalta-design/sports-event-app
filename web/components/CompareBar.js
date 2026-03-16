"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCompareIds, clearCompareIds } from "@/lib/compare-utils";
import { trackEvent, EVENTS } from "@/lib/analytics";

/**
 * 画面下部の固定バー: 比較中の件数表示 + 比較ページへの導線
 * 比較対象が1件以上あるときのみ表示
 */
export default function CompareBar() {
  const router = useRouter();
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(getCompareIds().length);

    function onCompareChange() {
      setCount(getCompareIds().length);
    }
    window.addEventListener("compare-change", onCompareChange);
    return () => window.removeEventListener("compare-change", onCompareChange);
  }, []);

  if (count === 0) return null;

  function handleView() {
    trackEvent(EVENTS.COMPARE_VIEW, {
      compare_count: count,
      source_page: "compare_bar",
    });
    router.push("/compare");
  }

  function handleClear() {
    clearCompareIds();
    setCount(0);
    trackEvent(EVENTS.COMPARE_CLEAR, {
      compare_count: count,
      source_page: "compare_bar",
    });
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
      <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full">
            {count}
          </span>
          <span className="text-sm font-medium text-gray-700">
            件を比較中
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-red-500 transition-colors"
          >
            クリア
          </button>
          <button
            onClick={handleView}
            className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            比較を見る
          </button>
        </div>
      </div>
    </div>
  );
}
