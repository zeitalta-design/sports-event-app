"use client";

/**
 * Phase70: Runnerプロフィール
 *
 * /profile — 好みの距離・エリア・レベルを設定
 * 設定内容を元におすすめ大会を生成。
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import { REGIONS } from "@/lib/constants";
import {
  getRunnerProfile,
  saveRunnerProfile,
  DISTANCE_OPTIONS,
  LEVEL_OPTIONS,
  GOAL_OPTIONS,
  buildRecommendationParams,
} from "@/lib/runner-profile";
import DashboardEventCard from "@/components/runner/DashboardEventCard";

export default function ProfilePage() {
  const [distances, setDistances] = useState([]);
  const [prefectures, setPrefectures] = useState([]);
  const [level, setLevel] = useState("");
  const [goals, setGoals] = useState([]);
  const [saved, setSaved] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  // 初期ロード
  useEffect(() => {
    const profile = getRunnerProfile();
    if (profile) {
      setDistances(profile.distances || []);
      setPrefectures(profile.prefectures || []);
      setLevel(profile.level || "");
      setGoals(profile.goals || []);
    }
  }, []);

  function toggleDistance(key) {
    setDistances((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
    );
    setSaved(false);
  }

  function toggleGoal(key) {
    setGoals((prev) =>
      prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key]
    );
    setSaved(false);
  }

  function togglePrefecture(pref) {
    setPrefectures((prev) => {
      if (prev.includes(pref)) return prev.filter((p) => p !== pref);
      if (prev.length >= 5) return prev; // 最大5件
      return [...prev, pref];
    });
    setSaved(false);
  }

  function handleSave() {
    const profile = { distances, prefectures, level, goals };
    saveRunnerProfile(profile);
    setSaved(true);
    loadRecommendations(profile);
  }

  const loadRecommendations = useCallback(async (profile) => {
    setLoadingRecs(true);
    try {
      const params = buildRecommendationParams(profile);
      params.set("sport_type", "marathon");
      const res = await fetch(`/api/events?${params}&limit=6`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setRecommendations(data.events || []);
    } catch {
      setRecommendations([]);
    } finally {
      setLoadingRecs(false);
    }
  }, []);

  // 初回にプロフィールがあれば推薦ロード
  useEffect(() => {
    const profile = getRunnerProfile();
    if (profile && (profile.distances?.length > 0 || profile.prefectures?.length > 0)) {
      loadRecommendations(profile);
    }
  }, [loadRecommendations]);

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "Runner Dashboard", href: "/runner" },
    { label: "プロフィール設定" },
  ];

  const allPrefectures = REGIONS.flatMap((r) => r.prefectures);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Breadcrumbs items={breadcrumbs} />

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">
          🏃 Runnerプロフィール
        </h1>
        <p className="text-sm text-gray-500">
          あなたの好みに合った大会をおすすめします
        </p>
      </div>

      {/* 距離 */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-gray-700 mb-3">
          走りたい距離（複数選択可）
        </h2>
        <div className="flex flex-wrap gap-2">
          {DISTANCE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => toggleDistance(opt.key)}
              className={`px-4 py-2 text-sm font-medium rounded-xl border-2 transition-all ${
                distances.includes(opt.key)
                  ? "bg-blue-50 text-blue-700 border-blue-400"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* レベル */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-gray-700 mb-3">
          ランニングレベル
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {LEVEL_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { setLevel(opt.key); setSaved(false); }}
              className={`p-3 text-left rounded-xl border-2 transition-all ${
                level === opt.key
                  ? "bg-blue-50 text-blue-700 border-blue-400"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
              }`}
            >
              <div className="text-sm font-bold">{opt.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
            </button>
          ))}
        </div>
      </section>

      {/* 目標 */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-gray-700 mb-3">
          大会参加の目的（複数選択可）
        </h2>
        <div className="flex flex-wrap gap-2">
          {GOAL_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => toggleGoal(opt.key)}
              className={`px-4 py-2 text-sm font-medium rounded-xl border-2 transition-all ${
                goals.includes(opt.key)
                  ? "bg-green-50 text-green-700 border-green-400"
                  : "bg-white text-gray-600 border-gray-200 hover:border-green-300"
              }`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* エリア */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-gray-700 mb-3">
          参加したいエリア（最大5つ）
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {allPrefectures.map((pref) => (
            <button
              key={pref}
              onClick={() => togglePrefecture(pref)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                prefectures.includes(pref)
                  ? "bg-purple-50 text-purple-700 border-purple-300"
                  : "bg-white text-gray-500 border-gray-200 hover:border-purple-300"
              }`}
            >
              {pref}
            </button>
          ))}
        </div>
        {prefectures.length > 0 && (
          <p className="text-xs text-gray-400 mt-2">
            選択中: {prefectures.join(", ")}（{prefectures.length}/5）
          </p>
        )}
      </section>

      {/* 保存ボタン */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={handleSave}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
        >
          保存する
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium">
            ✓ 保存しました
          </span>
        )}
      </div>

      {/* おすすめ大会 */}
      {recommendations.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <span>⭐</span>
            あなたにおすすめの大会
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recommendations.slice(0, 4).map((event) => (
              <DashboardEventCard key={event.id} event={event} />
            ))}
          </div>
          <div className="text-center mt-4">
            <Link
              href="/marathon"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              もっと大会を探す →
            </Link>
          </div>
        </section>
      )}

      {loadingRecs && (
        <div className="text-center py-8">
          <div className="inline-block w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-xs text-gray-400 mt-2">おすすめを検索中...</p>
        </div>
      )}

      {/* フッター */}
      <div className="mt-4 pt-4 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400">
          ※ プロフィール情報はこのブラウザに保存されます
        </p>
      </div>
    </div>
  );
}
