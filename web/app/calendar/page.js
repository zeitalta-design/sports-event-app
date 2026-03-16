"use client";

/**
 * Phase67: 大会カレンダー
 *
 * /calendar — 月表示の大会カレンダー
 * 大会の分布を視覚化し、日付クリックで詳細表示。
 */

import { useState, useEffect, useCallback } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import CalendarStats from "@/components/calendar/CalendarStats";

const MONTH_LABELS = [
  "", "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar?year=${year}&month=${month}`);
      if (!res.ok) throw new Error("API error");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Calendar load error:", err);
      setData({ year, month, events: {}, stats: {} });
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  function goToPrevMonth() {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  }

  function goToNextMonth() {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  }

  function goToToday() {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  }

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "大会カレンダー" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={breadcrumbs} />

      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">
          📅 大会カレンダー
        </h1>
        <p className="text-sm text-gray-500">
          月ごとの大会開催日を確認できます
        </p>
      </div>

      {/* 月ナビゲーション */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          aria-label="前月"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-800">
            {year}年 {MONTH_LABELS[month]}
          </h2>
          <button
            onClick={goToToday}
            className="px-2 py-0.5 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
          >
            今月
          </button>
        </div>

        <button
          onClick={goToNextMonth}
          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          aria-label="翌月"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 統計 */}
      {data?.stats && <CalendarStats stats={data.stats} />}

      {/* ローディング */}
      {loading && (
        <div className="text-center py-16">
          <div className="inline-block w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      )}

      {/* カレンダー */}
      {!loading && data && (
        <CalendarGrid
          year={year}
          month={month}
          eventsByDate={data.events || {}}
        />
      )}

      {/* 凡例 */}
      <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="font-medium">凡例:</span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> マラソン
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" /> トレイル
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-400" /> その他
        </span>
      </div>
    </div>
  );
}
