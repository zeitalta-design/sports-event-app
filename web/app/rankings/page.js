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

const RANKING_TYPES = [
  {
    key: "popular",
    label: "人気大会",
    icon: "🔥",
    description: "閲覧数・お気に入り数が多い注目大会",
    color: "bg-red-50 text-red-700 border-red-200",
  },
  {
    key: "beginner",
    label: "初心者向け",
    icon: "🌱",
    description: "初めてのランニング大会にぴったり",
    color: "bg-green-50 text-green-700 border-green-200",
  },
  {
    key: "flat",
    label: "フラットコース",
    icon: "🛣️",
    description: "高低差が少ない走りやすいコース",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    key: "record",
    label: "記録狙い",
    icon: "🏅",
    description: "自己ベスト更新を狙えるフルマラソン",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
];

export default function RankingsPage() {
  const [activeType, setActiveType] = useState("popular");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRanking = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rankings?type=${activeType}&limit=10`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error("Ranking load error:", err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [activeType]);

  useEffect(() => {
    loadRanking();
  }, [loadRanking]);

  const activeInfo = RANKING_TYPES.find((t) => t.key === activeType);

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

      {/* カテゴリ選択 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {RANKING_TYPES.map((type) => (
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
          {events.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-400">
                該当する大会がまだありません
              </p>
            </div>
          ) : (
            events.map((event, i) => (
              <RankingCard key={event.id} event={event} rank={i + 1} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
