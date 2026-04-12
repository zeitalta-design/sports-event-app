"use client";

/**
 * Phase62: Runner Dashboard
 *
 * /runner — ランナーの「大会選びの中心ページ」
 *
 * 表示内容:
 * - ヒーロー（検討状況サマリー）
 * - クイックアクション
 * - 締切間近の大会
 * - 保存中の大会プレビュー
 * - おすすめ大会
 * - 今週末の大会
 * - 新着大会
 */

import { useState, useEffect, useCallback } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import RunnerHero from "@/components/runner/RunnerHero";
import QuickActions from "@/components/runner/QuickActions";
import DashboardSection from "@/components/runner/DashboardSection";
import SavedEventsPreview from "@/components/runner/SavedEventsPreview";
import WeeklyTasksSection from "@/components/runner/WeeklyTasksSection";
import EnteredEventsSection from "@/components/runner/EnteredEventsSection";
import PendingActionsSection from "@/components/runner/PendingActionsSection";
import { getSavedIds } from "@/lib/saved-events-storage";
import { getCompareIds } from "@/lib/compare-utils";
import { buildSavedEventsAlerts, summarizeAlertCounts } from "@/lib/event-alert-candidates";
import SignupCTA from "@/components/SignupCTA";

export default function RunnerDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [dashData, setDashData] = useState(null);
  const [savedCount, setSavedCount] = useState(0);
  const [compareCount, setCompareCount] = useState(0);
  const [alertHighCount, setAlertHighCount] = useState(0);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      // ローカルストレージの状態を取得
      const savedIds = getSavedIds();
      const compareIds = getCompareIds();
      setSavedCount(savedIds.length);
      setCompareCount(compareIds.length);

      // アラート件数の計算
      const allIds = [...new Set([...savedIds, ...compareIds])];
      if (allIds.length > 0) {
        try {
          const alertRes = await fetch(`/api/events/by-ids?ids=${allIds.join(",")}`);
          if (alertRes.ok) {
            const alertData = await alertRes.json();
            const alerts = buildSavedEventsAlerts(alertData.events || []);
            const counts = summarizeAlertCounts(alerts);
            setAlertHighCount(counts.high);
          }
        } catch {
          // アラート取得失敗は無視
        }
      }

      // ダッシュボードデータ取得
      const res = await fetch("/api/runner/dashboard");
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setDashData(data);
    } catch (err) {
      console.error("Dashboard load error:", err);
      setDashData({ deadlineSoon: [], recommended: [], newEvents: [], weekend: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();

    function onSync() {
      // storage変更時はカウントだけ再計算
      setSavedCount(getSavedIds().length);
      setCompareCount(getCompareIds().length);
    }
    window.addEventListener("saved-change", onSync);
    window.addEventListener("compare-change", onSync);
    return () => {
      window.removeEventListener("saved-change", onSync);
      window.removeEventListener("compare-change", onSync);
    };
  }, [loadDashboard]);

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "Runner Dashboard" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Breadcrumbs items={breadcrumbs} />

      {/* ヒーロー */}
      <RunnerHero
        savedCount={savedCount}
        compareCount={compareCount}
        alertHighCount={alertHighCount}
      />

      {/* クイックアクション */}
      <QuickActions />

      {/* ローディング */}
      {loading && (
        <div className="text-center py-16">
          <div className="inline-block w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      )}

      {!loading && dashData && (
        <>
          {/* Phase103: 今週やること */}
          <WeeklyTasksSection />

          {/* Phase103: エントリー済み */}
          <EnteredEventsSection />

          {/* Phase103: 要対応 */}
          <PendingActionsSection />

          {/* 締切間近 */}
          <DashboardSection
            title="締切間近の大会"
            icon="⏰"
            events={dashData.deadlineSoon}
            moreHref="/marathon?sort=deadline"
            emptyText="今週締切の大会はありません"
          />

          {/* 保存中の大会 */}
          <SavedEventsPreview />

          {/* 今週末の大会 */}
          {dashData.weekend.length > 0 && (
            <DashboardSection
              title="今週末の大会"
              icon="🗓️"
              events={dashData.weekend}
              showDeadline={false}
              emptyText="今週末の大会はありません"
            />
          )}

          {/* おすすめ大会 */}
          <DashboardSection
            title="おすすめ大会"
            icon="⭐"
            events={dashData.recommended}
            moreHref="/popular"
            moreLabel="人気大会を見る"
            columns={2}
          />

          {/* 新着大会 */}
          <DashboardSection
            title="新着大会"
            icon="🆕"
            events={dashData.newEvents}
            moreHref="/marathon"
            moreLabel="すべての大会"
          />
        </>
      )}

      {/* Phase99: 会員訴求CTA */}
      <div className="mt-6"><SignupCTA variant="inline" /></div>

      {/* フッター導線 */}
      <div className="mt-8 pt-6 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center mb-3">
          ※ 保存・比較データはこのブラウザに保存されています
        </p>
      </div>
    </div>
  );
}
