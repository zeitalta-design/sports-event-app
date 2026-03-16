"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import AlertsSummaryCards from "@/components/alerts/AlertsSummaryCards";
import AlertEventCard from "@/components/alerts/AlertEventCard";
import AlertTypeFilter from "@/components/alerts/AlertTypeFilter";
import EmptyAlertsState from "@/components/alerts/EmptyAlertsState";
import CrossNavLinks from "@/components/my-events/CrossNavLinks";
import { getSavedIds } from "@/lib/saved-events-storage";
import { getCompareIds } from "@/lib/compare-utils";
import {
  buildSavedEventsAlerts,
  summarizeAlertCounts,
} from "@/lib/event-alert-candidates";
import {
  getReadCount,
  getPinnedIds,
  getPinnedCount,
  isAlertPinned,
} from "@/lib/alerts-read-state";
import { ALERT_TYPE_TO_FILTER } from "@/components/alerts/AlertTypeFilter";
import LoginPrompt from "@/components/LoginPrompt";

/**
 * Phase102: 通知センターページ（強化版）
 *
 * フィルター / ピン留め / 既読管理 / アクションCTA 対応。
 */

export default function AlertsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alertItems, setAlertItems] = useState([]);
  const [counts, setCounts] = useState(null);
  const [hasSavedIds, setHasSavedIds] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [readCount, setReadCount] = useState(0);
  const [pinnedCount, setPinnedCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const savedIds = getSavedIds();
      const compareIds = getCompareIds();
      const allIds = [...new Set([...savedIds, ...compareIds])];
      setHasSavedIds(allIds.length > 0);

      if (allIds.length === 0) {
        setAlertItems([]);
        setCounts({ high: 0, medium: 0, low: 0, none: 0, total: 0 });
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/events/by-ids?ids=${allIds.join(",")}`);
      if (!res.ok) throw new Error("取得に失敗しました");

      const data = await res.json();
      const events = data.events || [];

      if (events.length === 0) {
        setAlertItems([]);
        setCounts({ high: 0, medium: 0, low: 0, none: 0, total: 0 });
        setLoading(false);
        return;
      }

      const items = buildSavedEventsAlerts(events);
      const summary = summarizeAlertCounts(items);

      setAlertItems(items);
      setCounts(summary);

      // 既読・ピンカウント
      setReadCount(getReadCount());
      setPinnedCount(getPinnedCount());
    } catch (err) {
      console.error("Alerts load error:", err);
      setError(err.message || "通知の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // 既読/ピン変更時のコールバック
  const handleStateChange = useCallback(() => {
    setReadCount(getReadCount());
    setPinnedCount(getPinnedCount());
    setRefreshKey((k) => k + 1);
  }, []);

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "見直しリスト" },
  ];

  // アラートあり / なし分離
  const withAlerts = alertItems.filter(
    (item) => item.alerts && item.alerts.length > 0
  );
  const noAlerts = alertItems.filter(
    (item) => !item.alerts || item.alerts.length === 0
  );

  // フィルタリング
  const filteredAlerts =
    activeFilter === "all"
      ? withAlerts
      : withAlerts.filter((item) =>
          item.alerts.some(
            (a) => ALERT_TYPE_TO_FILTER[a.type] === activeFilter
          )
        );

  // ピン留め分離
  const pinnedItems = filteredAlerts.filter((item) =>
    isAlertPinned(item.eventId)
  );
  const unpinnedItems = filteredAlerts.filter(
    (item) => !isAlertPinned(item.eventId)
  );

  // 未読件数
  const unreadCount =
    withAlerts.length > 0 ? withAlerts.length - readCount : 0;
  const safeUnreadCount = Math.max(0, unreadCount);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Breadcrumbs items={breadcrumbs} />

      {/* ヘッダー */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-bold text-gray-900">見直しリスト</h1>
          {safeUnreadCount > 0 && (
            <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {safeUnreadCount}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">
          保存中・比較中の大会について、締切や受付状況の変化を確認できます
        </p>
      </div>

      {/* 相互導線 */}
      <div className="mb-6">
        <CrossNavLinks currentPage="alerts" />
      </div>

      {/* ローディング */}
      {loading && (
        <div className="text-center py-16">
          <div className="inline-block w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">確認中...</p>
        </div>
      )}

      {/* エラー */}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={loadAlerts}
            className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
          >
            再読み込み
          </button>
        </div>
      )}

      {/* 保存済み大会0件 */}
      {!loading && !error && !hasSavedIds && (
        <EmptyAlertsState type="no_saved" />
      )}

      {/* 保存済み大会ありだが通知候補0件 */}
      {!loading && !error && hasSavedIds && withAlerts.length === 0 && (
        <EmptyAlertsState type="no_alerts" />
      )}

      {/* 通知候補あり */}
      {!loading && !error && withAlerts.length > 0 && (
        <>
          {/* サマリーカード */}
          <div className="mb-6">
            <AlertsSummaryCards
              counts={counts}
              unreadCount={safeUnreadCount}
              pinnedCount={pinnedCount}
            />
          </div>

          {/* Phase102: フィルター */}
          <div className="mb-5">
            <AlertTypeFilter
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              alertItems={withAlerts}
            />
          </div>

          {/* ピン留めセクション */}
          {pinnedItems.length > 0 && (
            <section className="mb-6">
              <h2 className="text-sm font-bold text-amber-600 mb-3 flex items-center gap-1.5">
                <span>⭐</span> 固定した通知
                <span className="text-xs font-normal text-gray-400">
                  ({pinnedItems.length})
                </span>
              </h2>
              <div className="space-y-3">
                {pinnedItems.map((item) => (
                  <AlertEventCard
                    key={`pin-${item.eventId}-${refreshKey}`}
                    item={item}
                    onPinChange={handleStateChange}
                    onReadChange={handleStateChange}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 通知候補一覧 */}
          {unpinnedItems.length > 0 && (
            <section className="mb-8">
              <h2 className="text-sm font-bold text-gray-700 mb-3">
                確認をおすすめする大会
                <span className="text-xs font-normal text-gray-400 ml-1">
                  ({unpinnedItems.length})
                </span>
              </h2>
              <div className="space-y-3">
                {unpinnedItems.map((item) => (
                  <AlertEventCard
                    key={`alert-${item.eventId}-${refreshKey}`}
                    item={item}
                    onPinChange={handleStateChange}
                    onReadChange={handleStateChange}
                  />
                ))}
              </div>
            </section>
          )}

          {/* フィルターで0件の場合 */}
          {filteredAlerts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400">
                このカテゴリの通知はありません
              </p>
            </div>
          )}
        </>
      )}

      {/* アラートなしの保存大会 */}
      {!loading && !error && noAlerts.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-bold text-gray-500 mb-3">
            現在問題のない大会
          </h2>
          <div className="space-y-2">
            {noAlerts.map((item) => (
              <div
                key={item.eventId}
                className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg border border-gray-100"
              >
                <div className="min-w-0">
                  <Link
                    href={item.path}
                    className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors truncate block"
                  >
                    {item.title}
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                    {item.eventDate && (
                      <span>{formatShortDate(item.eventDate)}</span>
                    )}
                    {item.prefecture && <span>{item.prefecture}</span>}
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 flex-shrink-0">
                  問題なし
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Phase99: ログイン誘導 */}
      {!loading && <div className="mt-6"><LoginPrompt /></div>}

      {/* フッター補足 */}
      {!loading && !error && hasSavedIds && (
        <div className="text-center pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            ※ このページは保存済み大会・比較候補を対象に、締切や受付状況を確認するものです
          </p>
        </div>
      )}
    </div>
  );
}

function formatShortDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const dow = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${dow})`;
}
