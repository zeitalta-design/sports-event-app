"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import MyEventsSummaryCards from "@/components/my-events/MyEventsSummaryCards";
import MyEventCard from "@/components/my-events/MyEventCard";
import PriorityEventsSection from "@/components/my-events/PriorityEventsSection";
import EmptyMyEventsState from "@/components/my-events/EmptyMyEventsState";
import CrossNavLinks from "@/components/my-events/CrossNavLinks";
import RecentViewsSection from "@/components/RecentViewsSection";
import { getSavedIds } from "@/lib/saved-events-storage";
import { getCompareIds } from "@/lib/compare-utils";
import {
  buildSavedEventsAlerts,
  summarizeAlertCounts,
  buildEventAlertCandidates,
} from "@/lib/event-alert-candidates";
import {
  buildMyEventsSummary,
  mergeTrackedEvents,
} from "@/lib/my-events-summary";
import {
  getMyEventsStatuses,
  getStatusCounts,
  EVENT_STATUSES,
  STATUS_KEYS,
  STATUS_COLORS,
  ensureEventStatus,
} from "@/lib/my-events-manager";
import LoginPrompt from "@/components/LoginPrompt";

/**
 * Phase61+100: マイ大会ページ /my-events
 *
 * Phase100: ステータス別グループ表示 + ステータス変更UI
 */

const STATUS_TAB_ALL = "all";

export default function MyEventsPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [mergedEvents, setMergedEvents] = useState([]);
  const [alertMap, setAlertMap] = useState(new Map());
  const [hasAnyIds, setHasAnyIds] = useState(false);
  const [activeTab, setActiveTab] = useState(STATUS_TAB_ALL);
  const [statusCounts, setStatusCounts] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const savedIds = getSavedIds();
      const compareIds = getCompareIds();
      const myStatuses = getMyEventsStatuses();
      const managedIds = Object.keys(myStatuses).map(Number);

      // 全IDを統合（保存 + 比較 + ステータス管理）
      const allIds = [...new Set([...savedIds, ...compareIds, ...managedIds])];

      setHasAnyIds(allIds.length > 0);

      if (allIds.length === 0) {
        setSummary(null);
        setMergedEvents([]);
        setStatusCounts({});
        setLoading(false);
        return;
      }

      // 保存されている大会にステータスを自動付与
      for (const id of savedIds) {
        ensureEventStatus(id);
      }

      // APIで全大会情報を取得
      const res = await fetch(`/api/events/by-ids?ids=${allIds.join(",")}`);
      if (!res.ok) throw new Error("取得に失敗しました");
      const data = await res.json();
      const allEvents = data.events || [];

      // saved / compare に分離
      const savedIdSet = new Set(savedIds);
      const compareIdSet = new Set(compareIds);
      const savedEvents = allEvents.filter((e) => savedIdSet.has(e.id));
      const compareEvents = allEvents.filter((e) => compareIdSet.has(e.id));

      // アラート生成
      const alerts = buildSavedEventsAlerts(allEvents);

      // アラートマップ
      const aMap = new Map();
      for (const ev of allEvents) {
        const candidate = buildEventAlertCandidates(ev);
        if (candidate.alerts.length > 0) {
          aMap.set(ev.id, candidate.alerts[0]);
        }
      }
      setAlertMap(aMap);

      // サマリー生成
      const summaryData = buildMyEventsSummary({
        savedEvents,
        compareEvents,
        alertItems: alerts,
      });
      setSummary(summaryData);

      // 最新のステータスカウント
      setStatusCounts(getStatusCounts());

      // 統合イベント（ステータス情報を付加）
      const updatedStatuses = getMyEventsStatuses();
      const merged = mergeTrackedEvents(savedEvents, compareEvents, savedIdSet, compareIdSet);
      const mergedWithStatus = merged.map((ev) => ({
        ...ev,
        myStatus: updatedStatuses[ev.id]?.status || null,
      }));

      // ステータスのorder順 → 締切順でソート
      mergedWithStatus.sort((a, b) => {
        const orderA = a.myStatus ? (EVENT_STATUSES[a.myStatus]?.order ?? 99) : 99;
        const orderB = b.myStatus ? (EVENT_STATUSES[b.myStatus]?.order ?? 99) : 99;
        if (orderA !== orderB) return orderA - orderB;
        // 締切が近い方を先に
        const deadA = a.entry_end_date ? new Date(a.entry_end_date).getTime() : Infinity;
        const deadB = b.entry_end_date ? new Date(b.entry_end_date).getTime() : Infinity;
        return deadA - deadB;
      });

      setMergedEvents(mergedWithStatus);
    } catch (err) {
      console.error("My events load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    function onStorageChange() {
      loadData();
    }
    window.addEventListener("saved-change", onStorageChange);
    window.addEventListener("compare-change", onStorageChange);
    window.addEventListener("my-events-status-change", onStorageChange);
    return () => {
      window.removeEventListener("saved-change", onStorageChange);
      window.removeEventListener("compare-change", onStorageChange);
      window.removeEventListener("my-events-status-change", onStorageChange);
    };
  }, [loadData]);

  const handleRemove = useCallback((id) => {
    setMergedEvents((prev) => prev.filter((ev) => ev.id !== id));
  }, []);

  // フィルタリング
  const filteredEvents = activeTab === STATUS_TAB_ALL
    ? mergedEvents
    : mergedEvents.filter((ev) => ev.myStatus === activeTab);

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "マイ大会" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={breadcrumbs} />

      {/* ヘッダー */}
      <div className="mb-2">
        <h1 className="text-xl font-bold text-gray-900 mb-1">
          マイ大会
        </h1>
        <p className="text-sm text-gray-500">
          大会の検討からエントリー、当日準備まで一元管理
        </p>
      </div>

      {/* 相互導線 */}
      <div className="mb-6 pt-2">
        <CrossNavLinks currentPage="my-events" />
      </div>

      {/* ローディング */}
      {loading && (
        <div className="text-center py-16">
          <div className="inline-block w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      )}

      {/* 空状態 */}
      {!loading && !hasAnyIds && <EmptyMyEventsState />}

      {/* コンテンツ */}
      {!loading && hasAnyIds && (
        <>
          {/* サマリーカード */}
          {summary && (
            <div className="mb-6">
              <MyEventsSummaryCards counts={summary.counts} statusCounts={statusCounts} />
            </div>
          )}

          {/* 優先確認セクション */}
          {summary && summary.priorityEvents.length > 0 && (
            <PriorityEventsSection events={summary.priorityEvents} />
          )}

          {/* Phase100: ステータスタブ */}
          <div className="mb-5">
            <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setActiveTab(STATUS_TAB_ALL)}
                className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  activeTab === STATUS_TAB_ALL
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                すべて
                <span className="ml-1 opacity-70">{mergedEvents.length}</span>
              </button>
              {STATUS_KEYS.map((key) => {
                const def = EVENT_STATUSES[key];
                const colors = STATUS_COLORS[key];
                const count = statusCounts[key] || 0;
                if (count === 0 && activeTab !== key) return null;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      activeTab === key
                        ? `${colors.bg} ${colors.text} ${colors.border}`
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {def.icon} {def.label}
                    <span className="ml-1 opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 最近見た大会 */}
          {activeTab === STATUS_TAB_ALL && (
            <RecentViewsSection maxItems={4} title="最近チェックした大会" />
          )}

          {/* 大会リスト */}
          {filteredEvents.length > 0 ? (
            <section className="mb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredEvents.map((ev) => (
                  <MyEventCard
                    key={ev.id}
                    event={ev}
                    onRemove={handleRemove}
                    topAlert={alertMap.get(ev.id) || null}
                    showStatusControl
                  />
                ))}
              </div>
            </section>
          ) : (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400">
                {activeTab === STATUS_TAB_ALL
                  ? "大会がありません"
                  : `「${EVENT_STATUSES[activeTab]?.label}」の大会はありません`}
              </p>
            </div>
          )}

          {/* 比較ページ導線 */}
          {summary && summary.compareReady && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <p className="text-sm text-blue-700">
                {summary.counts.compare}件の大会を比較中です
              </p>
              <Link
                href="/compare"
                className="text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline"
              >
                比較表を見る →
              </Link>
            </div>
          )}

          {/* Phase99: ログイン誘導 */}
          <div className="mt-6"><LoginPrompt /></div>

          {/* フッター */}
          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              ※ データはこのブラウザに保存されています
            </p>
          </div>
        </>
      )}
    </div>
  );
}
