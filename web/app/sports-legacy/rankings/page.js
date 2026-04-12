"use client";

/**
 * Phase69: Runnerランキング
 *
 * /rankings — カテゴリ別の大会ランキング
 *
 * カテゴリ:
 * - 人気大会
 * - 初心者向け
 * - フラットコース
 * - 記録狙い
 */

import { useState, useEffect, useCallback } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import RankingCard from "@/components/rankings/RankingCard";
import { trackEvent, EVENTS } from "@/lib/analytics";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import SeoInternalLinks from "@/components/SeoInternalLinks";

// Phase125+203: スポーツ別ランキングカテゴリ
const RANKING_TYPES_BY_SPORT = {
  all: [
    { key: "popular", label: "人気大会", icon: "🔥", description: "閲覧数・お気に入り数が多い注目大会", color: "bg-red-50 text-red-700 border-red-200" },
    { key: "review_top", label: "口コミ高評価", icon: "⭐", description: "参加者の口コミ評価が高い大会", color: "bg-amber-50 text-amber-700 border-amber-200" },
    { key: "beginner", label: "初心者向け", icon: "🌱", description: "初めてのランニング大会にぴったり", color: "bg-green-50 text-green-700 border-green-200" },
    { key: "photo_rich", label: "写真が多い", icon: "📸", description: "写真が充実して雰囲気がわかる大会", color: "bg-purple-50 text-purple-700 border-purple-200" },
    { key: "beginner_popular", label: "初心者人気", icon: "👍", description: "初心者からの評価が特に高い大会", color: "bg-teal-50 text-teal-700 border-teal-200" },
    { key: "flat", label: "フラットコース", icon: "🛣️", description: "高低差が少ない走りやすいコース", color: "bg-blue-50 text-blue-700 border-blue-200" },
    { key: "record", label: "記録狙い", icon: "🏅", description: "自己ベスト更新を狙えるフルマラソン", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  ],
  marathon: [
    { key: "popular", label: "人気大会", icon: "🔥", description: "閲覧数・お気に入り数が多い注目大会", color: "bg-red-50 text-red-700 border-red-200" },
    { key: "review_top", label: "口コミ高評価", icon: "⭐", description: "参加者の口コミ評価が高い大会", color: "bg-amber-50 text-amber-700 border-amber-200" },
    { key: "beginner", label: "初心者向け", icon: "🌱", description: "初めてのマラソン大会にぴったり", color: "bg-green-50 text-green-700 border-green-200" },
    { key: "photo_rich", label: "写真が多い", icon: "📸", description: "写真が充実して雰囲気がわかる大会", color: "bg-purple-50 text-purple-700 border-purple-200" },
    { key: "beginner_popular", label: "初心者人気", icon: "👍", description: "初心者からの評価が特に高い大会", color: "bg-teal-50 text-teal-700 border-teal-200" },
    { key: "flat", label: "フラットコース", icon: "🛣️", description: "高低差が少ない走りやすいコース", color: "bg-blue-50 text-blue-700 border-blue-200" },
    { key: "record", label: "記録狙い", icon: "🏅", description: "自己ベスト更新を狙えるフルマラソン", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  ],
  trail: [
    { key: "popular", label: "人気大会", icon: "🔥", description: "注目のトレイルラン大会", color: "bg-red-50 text-red-700 border-red-200" },
    { key: "review_top", label: "口コミ高評価", icon: "⭐", description: "口コミ評価が高いトレイル大会", color: "bg-amber-50 text-amber-700 border-amber-200" },
    { key: "beginner", label: "初心者向け", icon: "🌱", description: "初めてのトレイルランにぴったり", color: "bg-green-50 text-green-700 border-green-200" },
    { key: "scenic", label: "絶景コース", icon: "🏔️", description: "景色が素晴らしいトレイルコース", color: "bg-teal-50 text-teal-700 border-teal-200" },
  ],
};

const SPORT_FILTER_OPTIONS = [
  { key: "", label: "すべて", icon: "🏆" },
  { key: "marathon", label: "マラソン", icon: "🏃" },
  { key: "trail", label: "トレイル", icon: "⛰️" },
];

export default function RankingsPage() {
  const [sportFilter, setSportFilter] = useState("");
  const [activeType, setActiveType] = useState("popular");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Phase125: スポーツ変更時にカテゴリをリセット（存在しないカテゴリの場合）
  const sportKey = sportFilter || "all";
  const rankingTypes = RANKING_TYPES_BY_SPORT[sportKey] || RANKING_TYPES_BY_SPORT.all;

  useEffect(() => {
    if (!rankingTypes.find((t) => t.key === activeType)) {
      setActiveType("popular");
    }
    // Phase126: スポーツフィルタ変更トラッキング
    if (sportFilter) {
      trackEvent(EVENTS.RANKING_SPORT_FILTER, { sport_type: sportFilter });
    }
  }, [sportFilter]);

  const loadRanking = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ type: activeType, limit: "10" });
      if (sportFilter) params.set("sport_type", sportFilter);
      const res = await fetch(`/api/rankings?${params}`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error("Ranking load error:", err);
      setEvents([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [activeType, sportFilter]);

  useEffect(() => {
    loadRanking();
  }, [loadRanking]);

  const activeInfo = rankingTypes.find((t) => t.key === activeType);

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "ランキング" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={breadcrumbs} />

      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">
          🏆 大会ランキング
        </h1>
        <p className="text-sm text-gray-500">
          目的別のおすすめ大会ランキング
        </p>
      </div>

      {/* Phase125: スポーツフィルタ */}
      <div className="flex items-center gap-2 mb-4">
        {SPORT_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSportFilter(opt.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-all ${
              sportFilter === opt.key
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
            }`}
          >
            <span>{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>

      {/* カテゴリ選択 */}
      <div className={`grid grid-cols-2 ${rankingTypes.length <= 3 ? "sm:grid-cols-3" : "sm:grid-cols-4"} gap-3 mb-6`}>
        {rankingTypes.map((type) => (
          <button
            key={type.key}
            onClick={() => setActiveType(type.key)}
            className={`p-3 text-left rounded-xl border-2 transition-all ${
              activeType === type.key
                ? `${type.color} border-current shadow-sm`
                : "bg-white border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="text-lg mb-1">{type.icon}</div>
            <div className="text-sm font-bold">{type.label}</div>
            <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{type.description}</div>
          </button>
        ))}
      </div>

      {/* アクティブカテゴリ説明 */}
      {activeInfo && (
        <div className="mb-4">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <span>{activeInfo.icon}</span>
            {activeInfo.label}ランキング
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{activeInfo.description}</p>
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      )}

      {/* ランキング一覧 */}
      {!loading && (
        <div className="space-y-2">
          {error ? (
            <div className="card">
              <ErrorState onRetry={loadRanking} />
            </div>
          ) : events.length === 0 ? (
            <div className="card">
              <EmptyState preset="rankings" />
            </div>
          ) : (
            events.map((event, i) => (
              <RankingCard key={event.id} event={event} rank={i + 1} />
            ))
          )}
        </div>
      )}

      {/* Phase233: SEO内部リンク */}
      <SeoInternalLinks groups={["marathon", "region", "features"]} exclude="/rankings" />
    </div>
  );
}
