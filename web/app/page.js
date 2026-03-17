"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import HomeHeroSlider from "@/components/home/HomeHeroSlider";
import HomeSearchBar from "@/components/home/HomeSearchBar";
import PopularEventsSection from "@/components/home/PopularEventsSection";
import TopCategoryLinks from "@/components/TopCategoryLinks";
import TopDeadlineEvents from "@/components/TopDeadlineEvents";
import TopNewEvents from "@/components/TopNewEvents";
import TopPopularSearches from "@/components/TopPopularSearches";
import TopFeatureList from "@/components/TopFeatureList";
import TopFeatureNavigation from "@/components/TopFeatureNavigation";
import TopRecommendedSection from "@/components/top/TopRecommendedSection";
import RecentViewsSection from "@/components/RecentViewsSection";
import SignupCTA from "@/components/SignupCTA";
import DeadlineUrgencySection from "@/components/home/DeadlineUrgencySection";
import ReturnUserSection from "@/components/home/ReturnUserSection";
import MemberBenefitsCTA from "@/components/home/MemberBenefitsCTA";
import TopCalendarSection from "@/components/home/TopCalendarSection";
import FirstVisitGuide from "@/components/home/FirstVisitGuide";
import HowToUseSection from "@/components/home/HowToUseSection";

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
      {/* 1. ヒーロースライド */}
      <HomeHeroSlider />

      {/* 2. 検索バー（ヒーローに重ねて浮かせる） */}
      <HomeSearchBar totalEvents={data.total} />

      {/* Phase226: 初回訪問ガイド */}
      <FirstVisitGuide />

      {/* Phase107: 締切間近（保存大会） */}
      <DeadlineUrgencySection />

      {/* Phase94: あなたへのおすすめ */}
      <TopRecommendedSection />

      {/* Phase107: 再訪ユーザーセクション */}
      <ReturnUserSection />

      {/* Phase94: 最近見た大会 */}
      <div className="max-w-6xl mx-auto px-4">
        <RecentViewsSection maxItems={6} />
      </div>

      {/* 3. 今人気の大会 */}
      <PopularEventsSection events={data.popularEvents} />

      {/* Phase178: 今月の大会カレンダー */}
      <TopCalendarSection />

      {/* 4. カテゴリ */}
      <TopCategoryLinks />

      {/* 5. 締切間近 */}
      <TopDeadlineEvents events={data.deadlineEvents} />

      {/* 6. 新着・注目 */}
      <TopNewEvents events={data.newEvents} />

      {/* 7. 人気の検索条件 */}
      <TopPopularSearches />

      {/* 8. 比較軸ナビ */}
      <TopFeatureNavigation features={data.featureSummaries} />

      {/* 9. カテゴリ導線CTA */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/marathon" className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 sm:p-8 flex items-center gap-4 hover:shadow-md transition-shadow group">
            <span className="text-3xl">🏃</span>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold group-hover:text-blue-700 transition-colors" style={{ color: "#1a1a1a" }}>マラソン大会を探す</h2>
              <p className="text-xs font-medium mt-0.5" style={{ color: "#1a1a1a" }}>日程・エリア・距離で絞り込み</p>
            </div>
            <span className="text-blue-600 font-semibold text-sm shrink-0">→</span>
          </Link>
          <Link href="/trail" className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 sm:p-8 flex items-center gap-4 hover:shadow-md transition-shadow group">
            <span className="text-3xl">⛰️</span>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold group-hover:text-green-700 transition-colors" style={{ color: "#1a1a1a" }}>トレイルラン大会を探す</h2>
              <p className="text-xs font-medium mt-0.5" style={{ color: "#1a1a1a" }}>山岳レース・自然系ランイベント</p>
            </div>
            <span className="text-green-600 font-semibold text-sm shrink-0">→</span>
          </Link>
        </div>
      </section>

      {/* Phase107: 会員メリット訴求CTA（匿名のみ） */}
      <MemberBenefitsCTA />

      {/* Phase234: 使い方ステップガイド */}
      <HowToUseSection />

      {/* 10. 機能紹介 */}
      <TopFeatureList />
    </>
  );
}
