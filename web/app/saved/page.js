"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import MyEventCard from "@/components/my-events/MyEventCard";
import CrossNavLinks from "@/components/my-events/CrossNavLinks";
import { getSavedIds } from "@/lib/saved-events-storage";
import { getCompareIds } from "@/lib/compare-utils";
import { buildEventAlertCandidates } from "@/lib/event-alert-candidates";
import { calculateSuitability } from "@/lib/event-suitability";
import { getRunnerProfile } from "@/lib/runner-profile";
import LoginPrompt from "@/components/LoginPrompt";

/**
 * Phase93: 保存大会グルーピング
 *
 * 5グループに自動分類:
 *   本命 — open + 適性≥70
 *   検討中 — open + 適性<70
 *   様子見 — closing_soon, capacity_warning
 *   募集終了 — closed, full, suspended
 *   要確認 — unknown, awaiting_update, その他
 */

const GROUPS = [
  { key: "honmei", label: "本命", icon: "🎯", description: "希望にマッチする受付中の大会" },
  { key: "kentou", label: "検討中", icon: "🤔", description: "受付中の大会" },
  { key: "yousumi", label: "様子見", icon: "⏳", description: "締切間近・残りわずか" },
  { key: "ended", label: "募集終了", icon: "⛔", description: "受付終了済み" },
  { key: "check", label: "要確認", icon: "❓", description: "状態を確認してください" },
];

function classifyEvent(event, profile) {
  const officialStatus = event.official_entry_status;
  const entryStatus = event.entry_status;
  const status = officialStatus || entryStatus;

  // 募集終了系
  if (["closed", "full", "suspended", "ended", "cancelled"].includes(status)) {
    return "ended";
  }

  // 様子見（closing_soon, capacity_warning）
  if (["closing_soon", "capacity_warning"].includes(status)) {
    return "yousumi";
  }

  // 受付中（open）
  if (status === "open" || entryStatus === "open") {
    if (profile) {
      const suit = calculateSuitability(event, profile);
      if (suit.score >= 70) return "honmei";
    }
    return "kentou";
  }

  // unknown, awaiting_update, その他
  return "check";
}

export default function SavedPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [alertMap, setAlertMap] = useState(new Map());
  const [savedIdSet, setSavedIdSet] = useState(new Set());
  const [compareIdSet, setCompareIdSet] = useState(new Set());
  const [activeTab, setActiveTab] = useState("all");
  const [profile, setProfile] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const savedIds = getSavedIds();
      const compareIds = getCompareIds();
      setSavedIdSet(new Set(savedIds));
      setCompareIdSet(new Set(compareIds));
      setProfile(getRunnerProfile());

      if (savedIds.length === 0) {
        setEvents([]);
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/events/by-ids?ids=${savedIds.join(",")}`);
      if (!res.ok) throw new Error("取得に失敗しました");
      const data = await res.json();
      const fetched = data.events || [];

      // アラート候補を各大会に対して生成
      const aMap = new Map();
      for (const ev of fetched) {
        const candidate = buildEventAlertCandidates(ev);
        if (candidate.alerts.length > 0) {
          aMap.set(ev.id, candidate.alerts[0]);
        }
      }
      setAlertMap(aMap);

      // isSaved/isCompared フラグ付与
      const enriched = fetched.map((ev) => ({
        ...ev,
        isSaved: true,
        isCompared: new Set(compareIds).has(ev.id),
      }));

      setEvents(enriched);
    } catch (err) {
      console.error("Saved page load error:", err);
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
    window.addEventListener("runner-profile-change", onStorageChange);
    return () => {
      window.removeEventListener("saved-change", onStorageChange);
      window.removeEventListener("compare-change", onStorageChange);
      window.removeEventListener("runner-profile-change", onStorageChange);
    };
  }, [loadData]);

  // グループ分類
  const grouped = useMemo(() => {
    const result = {};
    for (const g of GROUPS) {
      result[g.key] = [];
    }
    for (const ev of events) {
      const groupKey = classifyEvent(ev, profile);
      if (result[groupKey]) {
        result[groupKey].push(ev);
      } else {
        result.check.push(ev);
      }
    }
    return result;
  }, [events, profile]);

  const handleRemove = useCallback((id) => {
    setEvents((prev) => prev.filter((ev) => ev.id !== id));
  }, []);

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "あとで見る" },
  ];

  // 表示する大会リスト
  const displayEvents = activeTab === "all"
    ? events
    : (grouped[activeTab] || []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={breadcrumbs} />

      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            あとで見る大会
          </h1>
          <p className="text-sm text-gray-500">
            {!loading && events.length > 0
              ? `${events.length}件の大会を保存中`
              : "気になる大会を保存して後から見返せます"}
          </p>
        </div>
      </div>

      {/* 相互導線 */}
      <div className="mb-4 pt-2">
        <CrossNavLinks currentPage="saved" />
      </div>

      {/* Phase93: グループタブ */}
      {!loading && events.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
          <TabButton
            active={activeTab === "all"}
            onClick={() => setActiveTab("all")}
            label="すべて"
            count={events.length}
            icon="📋"
          />
          {GROUPS.map((g) => {
            const count = grouped[g.key]?.length || 0;
            if (count === 0 && g.key !== "honmei") return null;
            return (
              <TabButton
                key={g.key}
                active={activeTab === g.key}
                onClick={() => setActiveTab(g.key)}
                label={g.label}
                count={count}
                icon={g.icon}
              />
            );
          })}
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div className="text-center py-16">
          <div className="inline-block w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      )}

      {/* 空状態 */}
      {!loading && events.length === 0 && (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
              />
            </svg>
          </div>
          <h3 className="text-base font-bold text-gray-700 mb-2">
            保存済みの大会がありません
          </h3>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed max-w-sm mx-auto">
            大会詳細ページで「あとで見る」を押すと、ここに追加されます。
          </p>
          <Link
            href="/marathon"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            大会を探す
          </Link>
        </div>
      )}

      {/* タブ内が空 */}
      {!loading && events.length > 0 && displayEvents.length === 0 && activeTab !== "all" && (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">
            このグループに該当する大会はありません
          </p>
        </div>
      )}

      {/* 大会一覧 */}
      {!loading && displayEvents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayEvents.map((ev) => (
            <MyEventCard
              key={ev.id}
              event={ev}
              onRemove={handleRemove}
              showSaveAction={true}
              topAlert={alertMap.get(ev.id) || null}
            />
          ))}
        </div>
      )}

      {/* Phase99: ログイン誘導 */}
      {!loading && <div className="mt-6"><LoginPrompt /></div>}

      {/* フッター */}
      {!loading && events.length > 0 && (
        <div className="mt-8 pt-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            ※ 保存データはこのブラウザに保存されています
          </p>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label, count, icon }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
        active
          ? "bg-blue-50 text-blue-700 border-blue-300"
          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
      }`}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
        active ? "bg-blue-200 text-blue-800" : "bg-gray-100 text-gray-500"
      }`}>
        {count}
      </span>
    </button>
  );
}
