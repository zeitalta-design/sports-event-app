"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getEventDetailPath } from "@/lib/sport-config";
import { getStatusLabel } from "@/lib/entry-status";

/**
 * Phase178: トップ用ミニカレンダーセクション
 *
 * 今月の注目大会を日付軸で表示。
 * 人気ランキングの下に配置。
 */

const SPORT_ICONS = {
  marathon: "🏃",
  trail: "⛰️",
  triathlon: "🏊",
  cycling: "🚴",
  walking: "🚶",
};

const SPORT_DOT = {
  marathon: "bg-blue-500",
  trail: "bg-green-500",
};

const STATUS_COLORS = {
  open: "text-green-600 bg-green-50",
  upcoming: "text-blue-600 bg-blue-50",
  closed: "text-gray-400 bg-gray-50",
  ended: "text-gray-400 bg-gray-50",
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export default function TopCalendarSection() {
  const [events, setEvents] = useState([]);
  const [calendarDots, setCalendarDots] = useState({});
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  useEffect(() => {
    fetch(`/api/calendar?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((data) => {
        // 全日付のドット情報
        setCalendarDots(data.events || {});

        // 今日以降の大会を日付順に最大8件
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const allEvents = [];
        for (const [date, evList] of Object.entries(data.events || {})) {
          if (new Date(date) >= today) {
            allEvents.push(...evList);
          }
        }
        allEvents.sort((a, b) => (a.event_date || "").localeCompare(b.event_date || ""));
        setEvents(allEvents.slice(0, 8));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year, month]);

  if (loading) return null;
  if (events.length === 0) return null;

  // ミニカレンダー用のデータ生成
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const totalCells = Math.ceil((daysInMonth + startWeekday) / 7) * 7;
  const todayDate = now.getDate();

  const dateKey = (day) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return (
    <section className="max-w-6xl mx-auto px-4 py-8" data-track="top_calendar_section">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="text-xl">📅</span>
            {month}月の大会
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">日付から大会を探す</p>
        </div>
        <Link
          href="/calendar"
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          data-track="top_calendar_more"
        >
          カレンダーを見る →
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ミニカレンダー */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-blue-600 text-white text-center py-2">
              <p className="text-sm font-bold">{year}年{month}月</p>
            </div>
            <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
              {WEEKDAYS.map((d, i) => (
                <div
                  key={d}
                  className={`py-1 text-center text-[10px] font-semibold ${
                    i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-500"
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: totalCells }, (_, i) => {
                const day = i - startWeekday + 1;
                const isValid = day >= 1 && day <= daysInMonth;
                const hasEvents = isValid && calendarDots[dateKey(day)]?.length > 0;
                const isToday = isValid && day === todayDate;
                const isPast = isValid && day < todayDate;

                return (
                  <div
                    key={i}
                    className={`h-8 flex items-center justify-center relative ${
                      !isValid ? "" : isPast ? "opacity-40" : ""
                    }`}
                  >
                    {isValid && (
                      <>
                        <span
                          className={`text-[11px] w-6 h-6 flex items-center justify-center rounded-full ${
                            isToday
                              ? "bg-blue-600 text-white font-bold"
                              : i % 7 === 0
                              ? "text-red-400"
                              : i % 7 === 6
                              ? "text-blue-400"
                              : "text-gray-600"
                          }`}
                        >
                          {day}
                        </span>
                        {hasEvents && !isToday && (
                          <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-500" />
                        )}
                        {hasEvents && isToday && (
                          <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-white" />
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 大会リスト */}
        <div className="lg:col-span-2">
          <div className="space-y-2">
            {events.map((ev) => {
              const d = new Date(ev.event_date);
              const dow = WEEKDAYS[d.getDay()];
              const dayNum = d.getDate();
              const statusClass = STATUS_COLORS[ev.entry_status] || STATUS_COLORS.ended;
              const href = getEventDetailPath(ev);

              return (
                <Link
                  key={ev.id}
                  href={href}
                  className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-lg hover:border-blue-200 hover:shadow-sm transition-all group"
                  data-track="top_calendar_event"
                  data-event-id={ev.id}
                >
                  {/* 日付 */}
                  <div className="flex-shrink-0 text-center w-12">
                    <p className="text-lg font-bold text-gray-900 leading-none">{dayNum}</p>
                    <p className={`text-[10px] font-medium ${
                      d.getDay() === 0 ? "text-red-400" : d.getDay() === 6 ? "text-blue-400" : "text-gray-400"
                    }`}>
                      {dow}
                    </p>
                  </div>

                  {/* 大会情報 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {ev.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                      <span className={`w-1.5 h-1.5 rounded-full ${SPORT_DOT[ev.sport_type] || "bg-gray-400"}`} />
                      <span>{ev.prefecture}</span>
                      {ev.distance_list && (
                        <span className="text-blue-600 font-medium">
                          {ev.distance_list.split(",").slice(0, 2).join("/")}km
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 募集状況 */}
                  <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded ${statusClass}`}>
                    {getStatusLabel(ev.entry_status)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Phase179: カレンダーCTA */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/calendar"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          data-track="top_calendar_cta_main"
        >
          📅 大会カレンダーを見る
        </Link>
        <Link
          href={`/marathon/month/${month}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          data-track="top_calendar_cta_month"
        >
          {month}月の大会一覧
        </Link>
      </div>
    </section>
  );
}
