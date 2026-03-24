"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  getMyEventsStatuses,
  setEventStatus,
  removeEventStatus,
} from "@/lib/my-events-manager";
import {
  getAllResults,
  buildCalendarMonth,
  getNextEvent,
  splitEvents,
  getPrepProgress,
  getAllReflections,
} from "@/lib/my-calendar-manager";
import NextEventCard from "@/components/my-calendar/NextEventCard";
import MonthCalendar from "@/components/my-calendar/MonthCalendar";
import FutureEventsList from "@/components/my-calendar/FutureEventsList";
import PastResultsList from "@/components/my-calendar/PastResultsList";
import NotificationSettings from "@/components/my-calendar/NotificationSettings";
import GrowthSummary from "@/components/my-calendar/GrowthSummary";

export default function MyCalendarPage() {
  const [events, setEvents] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth() + 1);

  // データ読み込み
  const loadData = useCallback(async () => {
    const currentStatuses = getMyEventsStatuses();
    const currentResults = getAllResults();
    setStatuses(currentStatuses);
    setResults(currentResults);

    const ids = Object.keys(currentStatuses).map(Number);
    // 参加記録のあるIDも追加
    const resultIds = Object.keys(currentResults).map(Number);
    const allIds = [...new Set([...ids, ...resultIds])];

    if (allIds.length === 0) {
      setEvents([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/my-calendar?ids=${allIds.join(",")}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      setEvents([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();

    // ステータス変更イベントを監視
    const handler = () => loadData();
    window.addEventListener("my-events-status-change", handler);
    window.addEventListener("my-calendar-change", handler);
    return () => {
      window.removeEventListener("my-events-status-change", handler);
      window.removeEventListener("my-calendar-change", handler);
    };
  }, [loadData]);

  // ステータス変更
  function handleStatusChange(eventId, newStatus) {
    setEventStatus(eventId, newStatus);
    setStatuses(getMyEventsStatuses());
  }

  // 削除
  function handleRemove(eventId) {
    removeEventStatus(eventId);
    setStatuses(getMyEventsStatuses());
  }

  // 記録変更
  function handleResultsChange() {
    setResults(getAllResults());
  }

  // 月変更
  function handleMonthChange(delta) {
    let newMonth = calMonth + delta;
    let newYear = calYear;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    setCalYear(newYear);
    setCalMonth(newMonth);
  }

  // 準備進捗データ
  const preps = {};
  for (const ev of events) {
    preps[ev.id] = getPrepProgress(ev.id);
  }

  // カレンダーデータ計算（3ヶ月分）
  const calendarMonths = [];
  for (let i = 0; i < 3; i++) {
    let m = calMonth + i;
    let y = calYear;
    if (m > 12) { m -= 12; y++; }
    calendarMonths.push({
      year: y,
      month: m,
      data: buildCalendarMonth(y, m, events, statuses, results, preps),
    });
  }
  const nextEvent = getNextEvent(events, statuses);
  const nextEventStatus = nextEvent ? statuses[nextEvent.id]?.status || "considering" : null;
  const { future, past } = splitEvents(events);

  // 予定確定（entered/planned）と検討中を分離
  const confirmedFuture = future.filter((ev) => {
    const s = statuses[ev.id]?.status;
    return s && s !== "considering";
  });
  const consideringFuture = future.filter((ev) => {
    const s = statuses[ev.id]?.status;
    return !s || s === "considering";
  });

  // 統計
  const futureCount = future.length;
  const pastCount = past.length;
  const pbCount = Object.values(results).filter((r) => r.isPB).length;
  const reflections = getAllReflections();
  const finishCount = Object.values(results).filter((r) => r.finishTime).length;
  const avgPrepPercent = futureCount > 0
    ? Math.round(future.reduce((sum, ev) => sum + (preps[ev.id]?.percent || 0), 0) / futureCount)
    : 0;

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-40 bg-gray-200 rounded-2xl" />
          <div className="h-64 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  const isEmpty = events.length === 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      {/* ページヘッダー */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl sm:text-2xl font-black text-gray-900">
            マイカレンダー
          </h1>
        </div>
        <p className="text-sm text-gray-500">
          あなたの大会予定と参加記録を管理
        </p>

        {/* サマリーバー */}
        {!isEmpty && (
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs text-gray-600">
                予定 <span className="font-bold text-gray-900">{futureCount}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              <span className="text-xs text-gray-600">
                参加済み <span className="font-bold text-gray-900">{pastCount}</span>
              </span>
            </div>
            {pbCount > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-xs text-gray-600">
                  PB <span className="font-bold text-gray-900">{pbCount}</span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {/* 1. 次の大会カード */}
          <NextEventCard
            event={nextEvent}
            status={nextEventStatus}
            onStatusChange={handleStatusChange}
          />

          {/* 2. カレンダー（3ヶ月表示） */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
                カレンダー
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleMonthChange(-1)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
                  aria-label="前月へ"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <button
                  onClick={() => handleMonthChange(1)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
                  aria-label="翌月へ"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {calendarMonths.map((cm) => (
                <MonthCalendar
                  key={`${cm.year}-${cm.month}`}
                  year={cm.year}
                  month={cm.month}
                  days={cm.data.days}
                  labels={cm.data.labels}
                  onMonthChange={handleMonthChange}
                  nextEventDate={nextEvent?.event_date || null}
                  hideNav
                />
              ))}
            </div>
          </section>

          {/* 3. 予定している大会（確定分） */}
          {confirmedFuture.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" />
                </svg>
                予定している大会
                <span className="text-xs text-gray-400 font-normal ml-1">({confirmedFuture.length})</span>
              </h2>
              <FutureEventsList
                events={confirmedFuture}
                statuses={statuses}
                onStatusChange={handleStatusChange}
                onRemove={handleRemove}
              />
            </section>
          )}

          {/* 3.5. 検討中の大会 */}
          {consideringFuture.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-amber-700 mb-2 flex items-center gap-1.5">
                <span className="text-base">🤔</span>
                検討中の大会
                <span className="text-xs text-amber-500 font-normal ml-1">({consideringFuture.length})</span>
              </h2>
              <div className="bg-amber-50/50 rounded-xl border border-amber-200 p-3 mb-2">
                <p className="text-xs text-amber-700">
                  まだエントリーしていない大会です。参加を決めたらステータスを変更しましょう。
                </p>
              </div>
              <FutureEventsList
                events={consideringFuture}
                statuses={statuses}
                onStatusChange={handleStatusChange}
                onRemove={handleRemove}
              />
              <div className="mt-2 text-center">
                <Link
                  href="/search"
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
                >
                  他の大会も探す →
                </Link>
              </div>
            </section>
          )}

          {/* 4. 成長サマリー */}
          {(pastCount > 0 || futureCount > 0) && (
            <GrowthSummary
              futureCount={futureCount}
              pastCount={pastCount}
              finishCount={finishCount}
              pbCount={pbCount}
              avgPrepPercent={avgPrepPercent}
            />
          )}

          {/* 5. 通知設定 */}
          <NotificationSettings />

          {/* 6. 過去の参加記録 */}
          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0 1 16.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 0 1-2.27.853m4.75-5.852a6.003 6.003 0 0 1-2.48 5.228" />
                </svg>
                参加記録
                <span className="text-xs text-gray-400 font-normal ml-1">({past.length})</span>
              </h2>
              <PastResultsList
                events={past}
                results={results}
                onResultsChange={handleResultsChange}
              />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  // サンプルデータ
  const sampleEvent = {
    title: "東京マラソン 2026",
    date: "2026年4月12日（日）",
    prefecture: "東京都",
    days: 23,
  };

  return (
    <div className="space-y-6">
      {/* サンプル Next Race Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 sm:p-6 border border-blue-100 relative overflow-hidden opacity-80">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100/30 rounded-full -translate-y-8 translate-x-8" />
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-10 flex items-center justify-center">
          <div className="text-center bg-white rounded-2xl shadow-lg px-6 py-5 max-w-xs mx-4">
            <div className="w-12 h-12 mx-auto mb-3 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-1.5">
              無料でマイカレンダーを作る
            </h2>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              大会のカウントダウン、締切通知、参加記録を
              <br />ひとつの画面で管理できます
            </p>
            <Link
              href="/search"
              className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
            >
              大会を探す
            </Link>
          </div>
        </div>

        <div className="relative">
          <p className="text-xs text-blue-500 font-bold tracking-wider uppercase mb-3">Next Race</p>
          <div className="mb-3">
            <span className="text-4xl sm:text-5xl font-black text-blue-700 tracking-tight">{sampleEvent.days}</span>
            <span className="text-lg text-blue-600 font-bold ml-1">日後</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-2">{sampleEvent.title}</h2>
          <div className="flex gap-4 text-sm text-gray-600 mb-4">
            <span>{sampleEvent.date}</span>
            <span>{sampleEvent.prefecture}</span>
          </div>
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-600 mb-2">今やること</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border bg-blue-50 border-blue-200 text-blue-800">
                <span>🎯</span><span className="font-medium">目標タイムを設定</span>
              </div>
              <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border bg-gray-50 border-gray-200 text-gray-700">
                <span>🏨</span><span className="font-medium">宿泊の予約を検討</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 機能紹介 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: "✅", title: "準備チェック", desc: "大会前にやることを管理" },
          { icon: "⏱", title: "カウントダウン", desc: "次の大会まであと何日？" },
          { icon: "🔔", title: "締切通知", desc: "エントリー忘れ防止" },
          { icon: "🏆", title: "参加記録", desc: "タイム・順位・振り返り" },
        ].map((f) => (
          <div key={f.title} className="text-center p-3 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-2xl block mb-1">{f.icon}</span>
            <p className="text-xs font-bold text-gray-800 mb-0.5">{f.title}</p>
            <p className="text-[10px] text-gray-500">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* チェックリストサンプル */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 opacity-70">
        <p className="text-xs font-bold text-gray-600 mb-2">準備チェックリスト（サンプル）</p>
        <div className="space-y-1.5">
          {["エントリー確認", "会場確認", "持ち物準備", "宿泊確認", "交通確認"].map((item, i) => (
            <div key={item} className="flex items-center gap-2 text-sm text-gray-600">
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                i < 2 ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300"
              }`}>
                {i < 2 && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
              </div>
              <span className={i < 2 ? "text-gray-400 line-through" : ""}>{item}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-2">忘れ物・締切忘れを防ぐ</p>
      </div>

      {/* CTA */}
      <div className="flex justify-center gap-3">
        <Link
          href="/search"
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
        >
          大会を探す
        </Link>
        <Link
          href="/my-events"
          className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          検討中の大会
        </Link>
      </div>
    </div>
  );
}
