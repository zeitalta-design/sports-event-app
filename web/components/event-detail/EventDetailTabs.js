"use client";

/**
 * Phase66: 詳細ページタブ化
 *
 * 13セクションを4つのタブに分類:
 * - 概要: 検討ポイント、要点、特徴、基本情報、緊急度、概要、比較メモ
 * - コース: コース情報、種目・参加費、制限時間
 * - 大会情報: 特徴、サービス、タイムスケジュール、会場・アクセス、FAQ、主催者
 * - 参加方法: 規約・注意事項、口コミ、回遊導線
 *
 * Context ベース: Server Component から関数を渡さずに済む設計。
 * TabPanel が Context から activeTab を読み取る。
 */

import { useState, useEffect, createContext, useContext } from "react";

const TABS = [
  { id: "overview", label: "概要", icon: "📋" },
  { id: "course", label: "コース", icon: "🗺️" },
  { id: "info", label: "大会情報", icon: "ℹ️" },
  { id: "entry", label: "参加方法", icon: "✅" },
];

const TabContext = createContext("overview");

export default function EventDetailTabs({ children }) {
  const [activeTab, setActiveTab] = useState("overview");

  // URLハッシュからタブを復元
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (TABS.find((t) => t.id === hash)) {
      setActiveTab(hash);
    }
  }, []);

  function handleTabChange(tabId) {
    setActiveTab(tabId);
    window.history.replaceState(null, "", `#${tabId}`);
    // タブ切替後にトップにスクロール（タブ部分へ）
    document.getElementById("detail-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <TabContext.Provider value={activeTab}>
      <div id="detail-tabs">
        {/* タブナビ */}
        <div className="sticky top-16 z-30 bg-white border-b border-gray-200 -mx-4 px-4 mb-6">
          <nav className="flex gap-0 overflow-x-auto" aria-label="詳細タブ">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                aria-selected={activeTab === tab.id}
                role="tab"
              >
                <span className="hidden sm:inline">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* タブコンテンツ — children は通常の JSX ノード */}
        {children}
      </div>
    </TabContext.Provider>
  );
}

/**
 * タブパネル — Context から activeTab を読み取り、一致するときのみ表示
 */
export function TabPanel({ tabId, children }) {
  const activeTab = useContext(TabContext);
  if (tabId !== activeTab) return null;
  return (
    <div role="tabpanel" className="space-y-6">
      {children}
    </div>
  );
}
