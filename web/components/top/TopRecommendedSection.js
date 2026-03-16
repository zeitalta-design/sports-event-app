"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getRunnerProfile, hasRunnerProfile, buildRecommendationParams } from "@/lib/runner-profile";
import { getEventDetailPath } from "@/lib/sport-config";
import OfficialStatusBadge from "@/components/OfficialStatusBadge";
import SuitabilityBadge from "@/components/SuitabilityBadge";

/**
 * Phase94: トップページ用おすすめセクション
 *
 * プロフィール設定済み → /api/recommendations から5件表示
 * プロフィール未設定 → 設定誘導CTA
 */
export default function TopRecommendedSection() {
  const [profile, setProfile] = useState(null);
  const [has, setHas] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const p = getRunnerProfile();
    setProfile(p);
    setHas(hasRunnerProfile());

    if (p) {
      fetchRecommendations(p);
    } else {
      setLoading(false);
    }

    const handler = () => {
      const newP = getRunnerProfile();
      setProfile(newP);
      setHas(hasRunnerProfile());
      if (newP) fetchRecommendations(newP);
    };
    window.addEventListener("runner-profile-change", handler);
    return () => window.removeEventListener("runner-profile-change", handler);
  }, []);

  async function fetchRecommendations(p) {
    try {
      const params = new URLSearchParams();
      if (p.distances?.length > 0) params.set("distances", p.distances.join(","));
      if (p.prefectures?.length > 0) params.set("prefectures", p.prefectures.join(","));
      if (p.level) params.set("level", p.level);
      params.set("limit", "5");

      const res = await fetch(`/api/recommendations?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEvents(data.recommendations || []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return null;

  // プロフィール未設定時: 設定誘導
  if (!has) {
    return (
      <section className="max-w-6xl mx-auto px-4 py-6">
        <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-sm font-bold text-blue-800 mb-1">
              ✨ あなたにぴったりの大会を見つけよう
            </h2>
            <p className="text-xs text-blue-600">
              希望の距離・エリア・レベルを登録すると、おすすめ大会が表示されます
            </p>
          </div>
          <Link
            href="/my-events"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shrink-0"
          >
            プロフィールを設定
          </Link>
        </div>
      </section>
    );
  }

  if (loading) return null;
  if (events.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span className="text-xl">✨</span>
          あなたへのおすすめ
        </h2>
        <Link href="/next-race" className="text-sm text-blue-600 hover:text-blue-800">
          もっと見る →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {events.map((event) => (
          <Link
            key={event.id}
            href={getEventDetailPath(event) || `/marathon/${event.id}`}
            className="block card p-4 hover:shadow-md hover:border-blue-200 transition-all group"
          >
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2 leading-snug min-h-[2.5rem]">
              {event.title}
            </h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 mb-2">
              {event.event_date && (
                <span className="font-medium text-gray-700">
                  {new Date(event.event_date).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                </span>
              )}
              {event.prefecture && <span>{event.prefecture}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <OfficialStatusBadge event={event} variant="badge" />
              <SuitabilityBadge event={event} variant="badge" profile={profile} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
