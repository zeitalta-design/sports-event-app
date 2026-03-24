"use client";
import { useState, useEffect } from "react";
import HomeHeroSlider from "@/components/home/HomeHeroSlider";
import PopularEventsSection from "@/components/home/PopularEventsSection";

import TopDeadlineEvents from "@/components/TopDeadlineEvents";
import TopNewEvents from "@/components/TopNewEvents";
import TopPopularSearches from "@/components/TopPopularSearches";
import TopRecommendedSection from "@/components/top/TopRecommendedSection";
import RecentViewsSection from "@/components/RecentViewsSection";
import DeadlineUrgencySection from "@/components/home/DeadlineUrgencySection";
import ReturnUserSection from "@/components/home/ReturnUserSection";
import CalendarValueSection from "@/components/home/CalendarValueSection";

export default function HomePage() {
  const [data, setData] = useState({
    total: 0,
    deadlineEvents: [],
    newEvents: [],
    popularEvents: [],
    featureSummaries: [],
  });

  useEffect(() => {
    fetch("/api/top")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  return (
    <>
      {/* 1. ヒーロー（検索統合型） */}
      <HomeHeroSlider totalEvents={data.total} />

      {/* 2. リピーター向け：締切迫り通知 + 最近の閲覧（条件付き表示） */}
      <DeadlineUrgencySection />
      <ReturnUserSection />

      {/* 3. 今人気の大会 — CVの要 */}
      <PopularEventsSection events={data.popularEvents} />

      {/* 4. 締切間近の大会 */}
      <TopDeadlineEvents events={data.deadlineEvents} />

      {/* 5. 注目の大会 */}
      <TopNewEvents events={data.newEvents} />

      {/* 6. あなたへのおすすめ + 最近見た大会 */}
      <TopRecommendedSection />
      <div className="max-w-6xl mx-auto px-4">
        <RecentViewsSection maxItems={6} />
      </div>

      {/* 7. カレンダー管理の価値訴求 */}
      <CalendarValueSection />

      {/* 8. 人気の検索条件 */}
      <TopPopularSearches />

    </>
  );
}
