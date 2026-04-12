"use client";

/**
 * Phase180: /calendar UX強化
 * Phase181: 年間導線の土台
 * Phase182: カレンダーSEO導線強化
 *
 * 月表示の大会カレンダー。
 * ステータス・距離フィルタ、月ジャンプ、シーズン導線、SEOクロスリンク。
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import CalendarStats from "@/components/calendar/CalendarStats";
import SeoInternalLinks from "@/components/SeoInternalLinks";
import { trackEvent, EVENTS } from "@/lib/analytics";

const MONTH_LABELS = [
  "", "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

const SPORT_FILTER_OPTIONS = [
  { key: "", label: "すべて", icon: "📅" },
  { key: "marathon", label: "マラソン", icon: "🏃" },
  { key: "trail", label: "トレイル", icon: "⛰️" },
];

const STATUS_FILTER_OPTIONS = [
  { key: "", label: "すべて" },
  { key: "open", label: "募集中" },
  { key: "upcoming", label: "募集前" },
  { key: "closed", label: "締切済" },
];

const DISTANCE_FILTER_OPTIONS = [
  { key: "", label: "すべて" },
  { key: "5", label: "5km" },
  { key: "10", label: "10km" },
  { key: "half", label: "ハーフ" },
  { key: "full", label: "フル" },
  { key: "ultra", label: "ウルトラ" },
];

/** 距離フィルタのマッチ判定 */
function matchesDistance(distList, filterKey) {
  if (!filterKey || !distList) return true;
  const distances = distList.split(",").map((d) => parseFloat(d.trim()));
  switch (filterKey) {
    case "5":
      return distances.some((d) => d >= 3 && d <= 7);
    case "10":
      return distances.some((d) => d >= 8 && d <= 15);
    case "half":
      return distances.some((d) => d >= 20 && d <= 22);
    case "full":
      return distances.some((d) => d >= 40 && d <= 44);
    case "ultra":
      return distances.some((d) => d > 44);
    default:
      return true;
  }
}

/** シーズン定義 */
const SEASONS = [
  { label: "春（3〜5月）", months: [3, 4, 5], emoji: "🌸" },
  { label: "夏（6〜8月）", months: [6, 7, 8], emoji: "🌻" },
  { label: "秋（9〜11月）", months: [9, 10, 11], emoji: "🍁" },
  { label: "冬（12〜2月）", months: [12, 1, 2], emoji: "❄️" },
];

export default function CalendarPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [sportFilter, setSportFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [distanceFilter, setDistanceFilter] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMonthJump, setShowMonthJump] = useState(false);

  const isCurrentMonth = year === currentYear && month === currentMonth;

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: String(year), month: String(month) });
      if (sportFilter) params.set("sport_type", sportFilter);
      const res = await fetch(`/api/calendar?${params}`);
      if (!res.ok) throw new Error("API error");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Calendar load error:", err);
      setData({ year, month, events: {}, stats: {} });
    } finally {
      setLoading(false);
    }
  }, [year, month, sportFilter]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  useEffect(() => {
    if (sportFilter) {
      trackEvent(EVENTS.CALENDAR_SPORT_FILTER, { sport_type: sportFilter });
    }
  }, [sportFilter]);

  // クライアントサイドフィルタ適用
  const filteredEventsByDate = useMemo(() => {
    if (!data?.events) return {};
    if (!statusFilter && !distanceFilter) return data.events;
    const filtered = {};
    for (const [date, evts] of Object.entries(data.events)) {
      const matched = evts.filter((ev) => {
        if (statusFilter && ev.entry_status !== statusFilter) return false;
        if (distanceFilter && !matchesDistance(ev.distance_list, distanceFilter)) return false;
        return true;
      });
      if (matched.length > 0) filtered[date] = matched;
    }
    return filtered;
  }, [data, statusFilter, distanceFilter]);

  function goToPrevMonth() {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  }
  function goToNextMonth() {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  }
  function goToToday() {
    setYear(currentYear);
    setMonth(currentMonth);
  }
  function jumpToMonth(m) {
    setMonth(m);
    setShowMonthJump(false);
  }

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "大会カレンダー" },
  ];

  // フィルタの件数カウント
  const activeFilterCount = [sportFilter, statusFilter, distanceFilter].filter(Boolean).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={breadcrumbs} />

      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">
          大会カレンダー
        </h1>
        <p className="text-sm text-gray-500">
          日付・競技・距離・募集状況から大会をかんたんに探せます
        </p>
      </div>

      {/* 月ナビゲーション */}
      <div className="flex items-center justify-between mb-4 bg-white rounded-xl border border-gray-200 p-3">
        <button
          onClick={goToPrevMonth}
          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          aria-label="前月"
          data-track="calendar_prev_month"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMonthJump(!showMonthJump)}
            className="text-lg font-bold text-gray-800 hover:text-blue-600 transition-colors"
            data-track="calendar_month_jump_toggle"
          >
            {year}年 {MONTH_LABELS[month]}
            <svg className={`inline-block w-4 h-4 ml-1 transition-transform ${showMonthJump ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {!isCurrentMonth && (
            <button
              onClick={goToToday}
              className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors"
              data-track="calendar_go_today"
            >
              今月に戻る
            </button>
          )}
        </div>

        <button
          onClick={goToNextMonth}
          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          aria-label="翌月"
          data-track="calendar_next_month"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Phase181: 月ジャンプグリッド */}
      {showMonthJump && (
        <div className="mb-4 bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setYear(year - 1)}
              className="text-sm text-gray-500 hover:text-blue-600"
            >
              ← {year - 1}年
            </button>
            <span className="text-sm font-bold text-gray-700">{year}年</span>
            <button
              onClick={() => setYear(year + 1)}
              className="text-sm text-gray-500 hover:text-blue-600"
            >
              {year + 1}年 →
            </button>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const isCurrent = year === currentYear && m === currentMonth;
              const isSelected = m === month;
              return (
                <button
                  key={m}
                  onClick={() => jumpToMonth(m)}
                  className={`py-2 text-sm rounded-lg transition-all ${
                    isSelected
                      ? "bg-blue-600 text-white font-bold"
                      : isCurrent
                      ? "bg-blue-50 text-blue-700 font-medium border border-blue-200"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                  data-track="calendar_month_jump"
                >
                  {m}月
                </button>
              );
            })}
          </div>

          {/* シーズンショートカット */}
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
            {SEASONS.map((season) => {
              const isCurrentSeason = season.months.includes(currentMonth);
              return (
                <button
                  key={season.label}
                  onClick={() => {
                    const targetMonth = season.months.includes(currentMonth)
                      ? currentMonth
                      : season.months[0];
                    const targetYear = season.months[0] === 12 && month <= 2 ? year : currentYear;
                    setYear(targetYear);
                    jumpToMonth(targetMonth);
                  }}
                  className={`inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full border transition-colors ${
                    isCurrentSeason
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "text-gray-500 border-gray-200 hover:border-blue-300"
                  }`}
                  data-track="calendar_season_jump"
                >
                  <span>{season.emoji}</span>
                  <span>{season.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* フィルタ群 */}
      <div className="mb-4 space-y-3">
        {/* スポーツフィルタ */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500 w-16 shrink-0">競技</span>
          {SPORT_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSportFilter(opt.key)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-full border transition-all ${
                sportFilter === opt.key
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
              }`}
              data-track="calendar_sport_filter"
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>

        {/* ステータスフィルタ */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500 w-16 shrink-0">状況</span>
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setStatusFilter(opt.key)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                statusFilter === opt.key
                  ? "bg-green-600 text-white border-green-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-green-300"
              }`}
              data-track="calendar_status_filter"
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 距離フィルタ */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500 w-16 shrink-0">距離</span>
          {DISTANCE_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setDistanceFilter(opt.key)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                distanceFilter === opt.key
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
              }`}
              data-track="calendar_distance_filter"
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* フィルタリセット */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {activeFilterCount}件のフィルタ適用中
            </span>
            <button
              onClick={() => { setSportFilter(""); setStatusFilter(""); setDistanceFilter(""); }}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
              data-track="calendar_filter_reset"
            >
              すべてクリア
            </button>
          </div>
        )}
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

      {/* Phase232: 少ない月のヒント */}
      {!loading && data?.stats?.total < 5 && data?.adjacentMonths && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-100 rounded-xl">
          <p className="text-sm text-amber-800 mb-2">
            {MONTH_LABELS[month]}は掲載大会が少なめです。前後の月もチェックしてみましょう。
          </p>
          <div className="flex gap-3">
            {data.adjacentMonths.prev.count > 0 && (
              <button
                onClick={goToPrevMonth}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-amber-200 rounded-lg hover:bg-amber-100 text-amber-700 transition-colors"
              >
                {MONTH_LABELS[data.adjacentMonths.prev.month]}（{data.adjacentMonths.prev.count}件）
              </button>
            )}
            {data.adjacentMonths.next.count > 0 && (
              <button
                onClick={goToNextMonth}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-amber-200 rounded-lg hover:bg-amber-100 text-amber-700 transition-colors"
              >
                {MONTH_LABELS[data.adjacentMonths.next.month]}（{data.adjacentMonths.next.count}件）
              </button>
            )}
          </div>
        </div>
      )}

      {/* カレンダー */}
      {!loading && data && (
        <CalendarGrid
          year={year}
          month={month}
          eventsByDate={filteredEventsByDate}
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

      {/* Phase183: My Calendar導線 */}
      <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100" data-track="calendar_my_events_cta">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-700">気になる大会はありますか？</p>
            <p className="text-xs text-gray-500 mt-0.5">保存した大会を「マイ大会」で管理できます</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/my-events"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              data-track="calendar_to_my_events"
            >
              マイ大会を見る
            </Link>
            <Link
              href="/saved"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              data-track="calendar_to_saved"
            >
              あとで見るリスト
            </Link>
          </div>
        </div>
      </div>

      {/* Phase182: SEOクロスリンク */}
      <div className="mt-10 space-y-6">
        {/* 月別リンク */}
        <div>
          <h2 className="text-sm font-bold text-gray-700 mb-2">月別の大会を探す</h2>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <Link
                key={m}
                href={`/marathon/month/${m}`}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  m === currentMonth
                    ? "bg-blue-50 text-blue-700 border-blue-200 font-medium"
                    : "text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                }`}
                data-track="calendar_seo_month"
              >
                {m}月
              </Link>
            ))}
          </div>
        </div>

        {/* 競技別リンク */}
        <div>
          <h2 className="text-sm font-bold text-gray-700 mb-2">競技で探す</h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/marathon"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
              data-track="calendar_seo_sport"
            >
              🏃 マラソン大会一覧
            </Link>
            <Link
              href="/trail"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-gray-200 text-gray-600 hover:border-green-300 hover:text-green-600 transition-colors"
              data-track="calendar_seo_sport"
            >
              ⛰️ トレイルラン大会一覧
            </Link>
          </div>
        </div>

        {/* 距離別リンク */}
        <div>
          <h2 className="text-sm font-bold text-gray-700 mb-2">距離で探す</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { href: "/marathon/distance/5km", label: "5kmの大会" },
              { href: "/marathon/distance/10km", label: "10kmの大会" },
              { href: "/marathon/distance/half", label: "ハーフマラソン" },
              { href: "/marathon/distance/full", label: "フルマラソン" },
              { href: "/marathon/distance/ultra", label: "ウルトラマラソン" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 text-xs rounded-full border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
                data-track="calendar_seo_distance"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* エリア別リンク */}
        <div>
          <h2 className="text-sm font-bold text-gray-700 mb-2">エリアで探す</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { href: "/marathon/region/hokkaido-tohoku", label: "北海道・東北" },
              { href: "/marathon/region/kanto", label: "関東" },
              { href: "/marathon/region/chubu", label: "中部・北陸" },
              { href: "/marathon/region/kansai", label: "関西" },
              { href: "/marathon/region/chugoku-shikoku", label: "中国・四国" },
              { href: "/marathon/region/kyushu", label: "九州・沖縄" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 text-xs rounded-full border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
                data-track="calendar_seo_region"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* 人気・締切導線 */}
        <div>
          <h2 className="text-sm font-bold text-gray-700 mb-2">注目の大会</h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/marathon/popular"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-full border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-600 transition-colors"
              data-track="calendar_seo_popular"
            >
              🔥 人気ランキング
            </Link>
            <Link
              href="/marathon/deadline"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-full border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600 transition-colors"
              data-track="calendar_seo_deadline"
            >
              ⏰ 締切間近の大会
            </Link>
          </div>
        </div>
      </div>

      {/* Phase233: SEO内部リンク */}
      <SeoInternalLinks groups={["marathon", "region", "season"]} exclude="/calendar" />
    </div>
  );
}
