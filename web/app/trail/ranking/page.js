"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import EventCard from "@/components/EventCard";
import PopularityBadge from "@/components/PopularityBadge";

/**
 * Phase54: /trail/ranking — トレイル専用人気ランキングページ
 *
 * trail カテゴリ内の人気大会を popularity_score ベースでランキング表示。
 * /popular（全スポーツ横断）とは役割を分け、trail 内回遊を強化する。
 */

const SEASON_MONTHS = [
  { label: "春（3〜5月）", months: [3, 4, 5], emoji: "🌸" },
  { label: "夏（6〜8月）", months: [6, 7, 8], emoji: "☀️" },
  { label: "秋（9〜11月）", months: [9, 10, 11], emoji: "🍁" },
  { label: "冬（12〜2月）", months: [12, 1, 2], emoji: "❄️" },
];

export default function TrailRankingPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [period, setPeriod] = useState("30");

  useEffect(() => {
    fetchPopularEvents();
  }, [period]);

  useEffect(() => {
    fetchFavoriteIds();
  }, []);

  async function fetchPopularEvents() {
    setLoading(true);
    try {
      const res = await fetch(`/api/popular-events?limit=20&days=${period}&sport_type=trail`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error("Failed to fetch trail popular events:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchFavoriteIds() {
    try {
      const res = await fetch("/api/favorites");
      const data = await res.json();
      setFavoriteIds(new Set(data.ids || []));
    } catch {}
  }

  const handleFavoriteToggle = useCallback(async (eventId) => {
    const isFav = favoriteIds.has(eventId);
    try {
      if (isFav) {
        await fetch(`/api/favorites/${eventId}`, { method: "DELETE" });
        setFavoriteIds((prev) => { const s = new Set(prev); s.delete(eventId); return s; });
      } else {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_id: eventId }),
        });
        setFavoriteIds((prev) => new Set(prev).add(eventId));
      }
    } catch (err) {
      console.error(err);
    }
  }, [favoriteIds]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-1 h-7 bg-green-600 rounded-full" />
        <h1 className="text-2xl font-bold" style={{ color: "#323433" }}>
          ⛰️ 人気のトレイルラン大会ランキング
        </h1>
      </div>
      <p className="text-sm mb-6" style={{ color: "#333333" }}>
        直近{period}日間で注目されている全国のトレイルラン大会を掲載しています
      </p>

      {/* 期間切替 */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs font-medium" style={{ color: "#333333" }}>集計期間:</span>
        {[
          { key: "7", label: "7日間" },
          { key: "30", label: "30日間" },
          { key: "90", label: "90日間" },
        ].map((opt) => (
          <button
            key={opt.key}
            onClick={() => setPeriod(opt.key)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              period === opt.key
                ? "bg-green-600 text-white border-green-600"
                : "bg-white border-gray-200 hover:bg-gray-50"
            }`}
            style={period !== opt.key ? { color: "#333333" } : undefined}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ランキング一覧 */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex flex-col sm:flex-row">
                <div className="w-full sm:w-48 md:w-56 h-40 sm:h-[200px] bg-gray-200 rounded-t-lg sm:rounded-t-none sm:rounded-l-lg" />
                <div className="flex-1 p-4">
                  <div className="h-3 bg-gray-200 rounded w-2/3 mb-3" />
                  <div className="h-5 bg-gray-200 rounded w-4/5 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-full mb-1" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-2xl mb-2">⛰️</p>
          <p className="text-sm font-medium mb-1" style={{ color: "#333333" }}>
            まだランキングデータがありません
          </p>
          <p className="text-xs text-gray-400 mb-4">
            トレイル大会を閲覧・お気に入りするとランキングに反映されます
          </p>
          <Link
            href="/trail"
            className="inline-block px-5 py-2.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            トレイルラン大会一覧へ →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event, index) => (
            <div key={event.id} className="relative">
              {/* ランクバッジ */}
              <div className="absolute -left-1 -top-1 z-10">
                <span
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-extrabold shadow-sm ring-2 ${
                    index === 0
                      ? "bg-amber-400 text-amber-900 ring-amber-300"
                      : index === 1
                        ? "bg-gray-300 text-gray-700 ring-gray-200"
                        : index === 2
                          ? "bg-orange-300 text-orange-800 ring-orange-200"
                          : "bg-gray-100 text-gray-600 ring-gray-100"
                  }`}
                >
                  {index + 1}
                </span>
              </div>
              <div className="pl-4">
                <EventCard
                  event={event}
                  isFavorite={favoriteIds.has(event.id)}
                  onFavoriteToggle={handleFavoriteToggle}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 季節別・月別の導線 */}
      <div className="mt-10 pt-8 border-t border-gray-100">
        <h2 className="text-sm font-bold text-gray-700 mb-4">開催月からトレイル大会を探す</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {SEASON_MONTHS.map((season) => (
            <div key={season.label} className="space-y-1.5">
              <p className="text-xs font-bold text-gray-500">{season.emoji} {season.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {season.months.map((m) => (
                  <Link
                    key={m}
                    href={`/trail/month/${m}`}
                    className="inline-block px-2.5 py-1 text-xs text-gray-600 bg-gray-50 border border-gray-200
                               rounded-lg hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-all"
                  >
                    {m}月
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* フッターナビ */}
      <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/trail"
          className="inline-block px-6 py-3 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
        >
          ⛰️ トレイルラン大会一覧 →
        </Link>
        <Link
          href="/popular"
          className="inline-block px-6 py-3 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          🔥 全スポーツ人気ランキング →
        </Link>
        <Link
          href="/marathon"
          className="inline-block px-6 py-3 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          🏃 マラソン大会一覧 →
        </Link>
      </div>
    </div>
  );
}
