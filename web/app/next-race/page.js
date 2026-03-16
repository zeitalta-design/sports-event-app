"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import RecentViewsSection from "@/components/RecentViewsSection";
import SuitabilityBadge from "@/components/SuitabilityBadge";
import OfficialStatusBadge from "@/components/OfficialStatusBadge";
import { getRunnerProfile, hasRunnerProfile, DISTANCE_OPTIONS, LEVEL_OPTIONS } from "@/lib/runner-profile";
import { getEventDetailPath } from "@/lib/sport-config";
import SignupCTA from "@/components/SignupCTA";

/**
 * Phase89: 次の大会を探す
 *
 * パーソナライズされた大会探し導線。
 * プロフィール有無で表示が変わる。
 */

export default function NextRacePage() {
  const [profile, setProfile] = useState(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [topData, setTopData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const p = getRunnerProfile();
    setProfile(p);
    setHasProfile(hasRunnerProfile());
    loadData(p);

    const handler = () => {
      const newProfile = getRunnerProfile();
      setProfile(newProfile);
      setHasProfile(hasRunnerProfile());
      loadData(newProfile);
    };
    window.addEventListener("runner-profile-change", handler);
    return () => window.removeEventListener("runner-profile-change", handler);
  }, []);

  async function loadData(currentProfile) {
    setLoading(true);
    try {
      const promises = [];

      // レコメンド取得
      if (currentProfile) {
        const params = new URLSearchParams();
        if (currentProfile.distances?.length > 0) {
          params.set("distances", currentProfile.distances.join(","));
        }
        if (currentProfile.prefectures?.length > 0) {
          params.set("prefectures", currentProfile.prefectures.join(","));
        }
        if (currentProfile.level) {
          params.set("level", currentProfile.level);
        }
        if (currentProfile.goals?.length > 0) {
          params.set("goals", currentProfile.goals.join(","));
        }
        params.set("limit", "8");
        promises.push(
          fetch(`/api/recommendations?${params}`)
            .then((r) => r.json())
            .catch(() => ({ recommendations: [] }))
        );
      } else {
        promises.push(Promise.resolve({ recommendations: [] }));
      }

      // トップデータ取得
      promises.push(
        fetch("/api/top")
          .then((r) => r.json())
          .catch(() => null)
      );

      const [recData, topResult] = await Promise.all(promises);
      setRecommendations(recData.recommendations || []);
      setTopData(topResult);
    } catch (err) {
      console.error("NextRace load error:", err);
    } finally {
      setLoading(false);
    }
  }

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "次の大会を探す" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Breadcrumbs items={breadcrumbs} />

      {/* ヘッダー */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          次の大会を探す
        </h1>
        <p className="text-sm text-gray-500">
          あなたの好みに合った大会をおすすめします
        </p>
      </div>

      {/* プロフィール要約 / 設定誘導 */}
      <ProfileSummary profile={profile} hasProfile={hasProfile} />

      {loading && (
        <div className="text-center py-16">
          <div className="inline-block w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">おすすめを探しています...</p>
        </div>
      )}

      {!loading && (
        <>
          {/* おすすめ大会 */}
          {recommendations.length > 0 && (
            <section className="mb-10">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                <span className="text-xl">✨</span>
                あなたへのおすすめ
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {recommendations.map((event) => (
                  <RecommendationCard key={event.id} event={event} profile={profile} />
                ))}
              </div>
            </section>
          )}

          {/* 最近見た大会 */}
          <RecentViewsSection maxItems={8} showClearButton />

          {/* 締切間近の大会 */}
          {topData?.deadlineEvents?.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-xl">🔥</span>
                  締切間近の大会
                </h2>
                <Link href="/marathon?sort=deadline" className="text-sm text-blue-600 hover:text-blue-800">
                  もっと見る →
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {topData.deadlineEvents.slice(0, 6).map((event) => (
                  <EventMiniCard key={event.id} event={event} profile={profile} />
                ))}
              </div>
            </section>
          )}

          {/* 人気大会 */}
          {topData?.popularEvents?.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-xl">🏆</span>
                  人気の大会
                </h2>
                <Link href="/popular" className="text-sm text-blue-600 hover:text-blue-800">
                  もっと見る →
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {topData.popularEvents.slice(0, 6).map((event) => (
                  <EventMiniCard key={event.id} event={event} profile={profile} />
                ))}
              </div>
            </section>
          )}

          {/* Phase99: 会員訴求CTA */}
          <div className="mt-6 mb-8"><SignupCTA variant="banner" /></div>

          {/* 大会を探す CTA */}
          <div className="text-center py-8 border-t border-gray-100 mt-4">
            <p className="text-sm text-gray-500 mb-4">条件を絞って大会を探す</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/marathon"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                マラソン大会を探す
              </Link>
              <Link
                href="/trail"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                トレイル大会を探す
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── サブコンポーネント ──

function ProfileSummary({ profile, hasProfile }) {
  if (!hasProfile) {
    return (
      <div className="mb-8 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
        <h3 className="text-sm font-bold text-blue-800 mb-1">
          プロフィールを設定して、おすすめを受け取ろう
        </h3>
        <p className="text-xs text-blue-600 mb-3">
          希望の距離・エリア・レベルを登録すると、あなたに合った大会をおすすめします。
        </p>
        <Link
          href="/my-events"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          プロフィールを設定する
        </Link>
      </div>
    );
  }

  const distanceLabels = (profile?.distances || [])
    .map((d) => DISTANCE_OPTIONS.find((o) => o.key === d)?.label || d)
    .join(", ");
  const levelLabel = LEVEL_OPTIONS.find((o) => o.key === profile?.level)?.label || "";

  return (
    <div className="mb-8 p-4 bg-gray-50 border border-gray-200 rounded-xl flex flex-wrap items-center gap-3 text-sm">
      <span className="text-gray-500">あなたの希望:</span>
      {distanceLabels && (
        <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded font-medium text-xs">
          {distanceLabels}
        </span>
      )}
      {profile?.prefectures?.length > 0 && (
        <span className="px-2.5 py-0.5 bg-green-50 text-green-700 rounded font-medium text-xs">
          {profile.prefectures.slice(0, 3).join("・")}
        </span>
      )}
      {levelLabel && (
        <span className="px-2.5 py-0.5 bg-purple-50 text-purple-700 rounded font-medium text-xs">
          {levelLabel}
        </span>
      )}
      <Link href="/my-events" className="text-xs text-blue-600 hover:text-blue-800 ml-auto">
        設定を変更
      </Link>
    </div>
  );
}

function RecommendationCard({ event, profile }) {
  const href = event.path || getEventDetailPath(event) || `/marathon/${event.id}`;

  return (
    <Link
      href={href}
      className="block card p-4 hover:shadow-md hover:border-blue-200 transition-all group"
    >
      <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2 leading-snug min-h-[2.5rem]">
        {event.title}
      </h3>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 mb-2">
        {event.event_date && (
          <span className="font-medium text-gray-700">
            {formatDate(event.event_date)}
          </span>
        )}
        {event.prefecture && <span>{event.prefecture}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {event.distance_labels?.map((label) => (
          <span key={label} className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded">
            {label}
          </span>
        ))}
        <OfficialStatusBadge event={event} variant="badge" />
      </div>

      {profile && (
        <SuitabilityBadge event={event} variant="badge" profile={profile} />
      )}

      {event.recommendation_score > 0 && (
        <div className="mt-2 text-xs text-gray-400">
          マッチ度: {Math.round(event.recommendation_score)}点
        </div>
      )}
    </Link>
  );
}

function EventMiniCard({ event, profile }) {
  const href = event.path || getEventDetailPath(event) || `/marathon/${event.id}`;

  return (
    <Link
      href={href}
      className="block card p-4 hover:shadow-md hover:border-blue-200 transition-all group"
    >
      <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2 leading-snug">
        {event.title}
      </h3>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 mb-2">
        {event.event_date && (
          <span className="font-medium text-gray-700">{formatDate(event.event_date)}</span>
        )}
        {event.prefecture && <span>{event.prefecture}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <OfficialStatusBadge event={event} variant="badge" />
        {profile && <SuitabilityBadge event={event} variant="badge" profile={profile} />}
      </div>
    </Link>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})`;
  } catch {
    return dateStr;
  }
}
