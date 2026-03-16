"use client";

/**
 * Phase59: 比較アクション
 *
 * 既存のCompareButtonを詳細ページ用にラップし、
 * 比較ページへのリンクをセットで提供する。
 */

import Link from "next/link";
import { useState, useEffect } from "react";
import CompareButton from "@/components/CompareButton";
import { getCompareCount } from "@/lib/compare-utils";

export default function EventCompareActions({
  eventId,
  eventTitle = "",
  sourcePage = "detail",
}) {
  const [compareCount, setCompareCount] = useState(0);

  useEffect(() => {
    setCompareCount(getCompareCount());

    function onCompareChange() {
      setCompareCount(getCompareCount());
    }
    window.addEventListener("compare-change", onCompareChange);
    return () => window.removeEventListener("compare-change", onCompareChange);
  }, []);

  return (
    <div className="flex items-center gap-3">
      <CompareButton
        eventId={eventId}
        eventTitle={eventTitle}
        variant="full"
        sourcePage={sourcePage}
      />
      {compareCount >= 2 && (
        <Link
          href="/compare"
          className="text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          比較表を見る（{compareCount}件）
        </Link>
      )}
    </div>
  );
}
