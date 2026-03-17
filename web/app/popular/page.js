"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import EventCard from "@/components/EventCard";
import PopularityBadge from "@/components/PopularityBadge";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import SeoInternalLinks from "@/components/SeoInternalLinks";

/**
 * Phase46: /popular — 人気大会ランキングページ
 *
 * 行動ログベースの人気指数でランキング表示。
 * より多くの大会を表示する拡張版。
 */

export default function PopularEventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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
    setError(false);
    try {
      const res = await fetch(`/api/popular-events?limit=20&days=${period}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error("Failed to fetch popular events:", err);
      setError(true);
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
        <div className="w-1 h-7 bg-blue-600 rounded-full" />
        <h1 className="text-2xl font-bold" style={{ color: "#1a1a1a" }}>
          🔥 人気の大会ランキング
        </h1>
      </div>
      <p className="text-sm mb-6" style={{ color: "#1a1a1a" }}>
        ユーザーの閲覧・お気に入り・エントリークリック数から算出した人気指数でランキング
      </p>

      {/* 期間切替 */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs font-medium" style={{ color: "#1a1a1a" }}>集計期間:</span>
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
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white border-gray-200 hover:bg-gray-50"
            }`}
            style={period !== opt.key ? { color: "#1a1a1a" } : undefined}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 一覧 */}
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
      ) : error ? (
        <div className="card">
          <ErrorState onRetry={fetchPopularEvents} />
        </div>
      ) : events.length === 0 ? (
        <div className="card">
          <EmptyState preset="rankings" />
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event, index) => (
            <div key={event.id} className="relative">
              {/* ランク表示 */}
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

      {/* フッターリンク */}
      <div className="mt-10 pt-8 border-t border-gray-100 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/marathon"
          className="inline-block px-6 py-3 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          🏃 マラソン大会一覧 →
        </Link>
        <Link
          href="/trail"
          className="inline-block px-6 py-3 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
        >
          ⛰️ トレイルラン大会一覧 →
        </Link>
        <Link
          href="/trail/ranking"
          className="inline-block px-6 py-3 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
        >
          ⛰️ トレイル人気ランキング →
        </Link>
      </div>

      {/* Phase233: SEO内部リンク */}
      <SeoInternalLinks groups={["marathon", "season", "features"]} exclude="/popular" />
    </div>
  );
}
