"use client";

import { useEffect } from "react";
import { trackEvent, EVENTS } from "@/lib/analytics";

/**
 * Phase117/126: SEOページのページビュートラッキング
 * クライアントコンポーネント — マウント時にGA4イベント送信
 *
 * @param {string} pageType - ページタイプ（region, season, theme, prefecture, distance, month）
 * @param {string} slug - ページのslug（kanto, spring, beginner 等）
 * @param {number} eventCount - 表示大会数
 * @param {string} sportType - スポーツ種別（marathon, trail 等）
 */
export default function SeoTracker({ pageType, slug, eventCount = 0, sportType = "marathon" }) {
  useEffect(() => {
    trackEvent(EVENTS.SEO_PAGE_VIEW, {
      page_type: pageType,
      slug: slug,
      event_count: eventCount,
      sport_type: sportType,
    });
  }, [pageType, slug, eventCount, sportType]);

  return null;
}
