"use client";

/**
 * Phase67+184: カレンダーグリッド
 *
 * 月表示の大会カレンダー。
 * 各日に大会件数のドット + クリックで詳細表示。
 * Phase184: 選択日の大会に保存・比較ショートカット追加。
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import { getEventDetailPath } from "@/lib/sport-config";
import { getStatusLabel } from "@/lib/entry-status";
import { getSavedIds, toggleSavedId } from "@/lib/saved-events-storage";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

const SPORT_COLORS = {
  marathon: "bg-blue-500",
  trail: "bg-green-500",
  triathlon: "bg-red-500",
  cycling: "bg-orange-500",
  walking: "bg-cyan-500",
  swimming: "bg-indigo-500",
};

const STATUS_BADGE = {
  open: "text-green-700 bg-green-50 border-green-200",
  upcoming: "text-blue-700 bg-blue-50 border-blue-200",
  closed: "text-gray-500 bg-gray-50 border-gray-200",
  ended: "text-gray-500 bg-gray-50 border-gray-200",
  cancelled: "text-red-600 bg-red-50 border-red-200",
  unknown: "text-gray-500 bg-gray-50 border-gray-200",
};

export default function CalendarGrid({ year, month, eventsByDate }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [savedIds, setSavedIds] = useState(() => getSavedIds());

  // カレンダーグリッドの日付を生成
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const prevMonthDays = startWeekday;
  const totalCells = Math.ceil((daysInMonth + prevMonthDays) / 7) * 7;

  const today = new Date();
  const isToday = (day) =>
    today.getFullYear() === year &&
    today.getMonth() + 1 === month &&
    today.getDate() === day;

  const dateKey = (day) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const selectedEvents = selectedDate ? (eventsByDate[dateKey(selectedDate)] || []) : [];

  const handleSaveToggle = useCallback((e, eventId) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSavedId(eventId);
    setSavedIds(getSavedIds());
  }, []);

  return (
    <div>
      {/* カレンダーグリッド */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {WEEKDAY_LABELS.map((label, i) => (
            <div
              key={label}
              className={`py-2 text-center text-xs font-semibold ${
                i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-600"
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* 日付セル */}
        <div className="grid grid-cols-7">
          {Array.from({ length: totalCells }, (_, i) => {
            const day = i - prevMonthDays + 1;
            const isValid = day >= 1 && day <= daysInMonth;
            const key = isValid ? dateKey(day) : null;
            const events = key ? (eventsByDate[key] || []) : [];
            const hasEvents = events.length > 0;
            const isSelected = selectedDate === day;

            return (
              <button
                key={i}
                onClick={() => isValid && setSelectedDate(isSelected ? null : day)}
                disabled={!isValid}
                className={`relative min-h-[56px] sm:min-h-[72px] p-1 border-b border-r border-gray-100 text-left transition-colors ${
                  !isValid
                    ? "bg-gray-50"
                    : isSelected
                    ? "bg-blue-50 ring-2 ring-blue-300 ring-inset"
                    : hasEvents
                    ? "hover:bg-blue-50 cursor-pointer"
                    : "hover:bg-gray-50"
                }`}
                data-track="calendar_date_click"
              >
                {isValid && (
                  <>
                    <span
                      className={`text-xs sm:text-sm font-medium ${
                        isToday(day)
                          ? "inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full"
                          : i % 7 === 0
                          ? "text-red-500"
                          : i % 7 === 6
                          ? "text-blue-500"
                          : "text-gray-700"
                      }`}
                    >
                      {day}
                    </span>

                    {/* 大会ドット */}
                    {hasEvents && (
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {events.slice(0, 4).map((ev, j) => (
                          <span
                            key={j}
                            className={`w-1.5 h-1.5 rounded-full ${SPORT_COLORS[ev.sport_type] || "bg-gray-400"}`}
                            title={ev.title}
                          />
                        ))}
                        {events.length > 4 && (
                          <span className="text-[9px] text-gray-400">+{events.length - 4}</span>
                        )}
                      </div>
                    )}

                    {/* 件数バッジ（モバイル） */}
                    {hasEvents && (
                      <span className="absolute bottom-0.5 right-0.5 text-[9px] font-bold text-blue-500 sm:hidden">
                        {events.length}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 選択日の大会一覧 */}
      {selectedDate && (
        <div className="mt-4" data-track="calendar_date_events">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-700">
              {month}月{selectedDate}日の大会（{selectedEvents.length}件）
            </h3>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              閉じる
            </button>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">この日に大会はありません</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((ev) => {
                const isSaved = savedIds.includes(ev.id);
                const statusStyle = STATUS_BADGE[ev.entry_status] || STATUS_BADGE.unknown;
                return (
                  <div
                    key={ev.id}
                    className="bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all overflow-hidden"
                  >
                    <Link
                      href={getEventDetailPath(ev)}
                      className="block p-3"
                      data-track="calendar_event_click"
                      data-event-id={ev.id}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold text-gray-900 line-clamp-1 group-hover:text-blue-600">
                            {ev.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                            <span className={`w-1.5 h-1.5 rounded-full ${SPORT_COLORS[ev.sport_type] || "bg-gray-400"}`} />
                            <span>{ev.prefecture}{ev.city ? ` ${ev.city}` : ""}</span>
                            {ev.distance_list && (
                              <span className="text-blue-600 font-medium">
                                {ev.distance_list.split(",").slice(0, 2).join("/")}km
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${statusStyle}`}>
                          {getStatusLabel(ev.entry_status)}
                        </span>
                      </div>
                    </Link>
                    {/* Phase184: アクションバー */}
                    <div className="flex items-center gap-1 px-3 pb-2">
                      <button
                        onClick={(e) => handleSaveToggle(e, ev.id)}
                        className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors ${
                          isSaved
                            ? "text-yellow-700 bg-yellow-50 hover:bg-yellow-100"
                            : "text-gray-400 hover:text-yellow-600 hover:bg-yellow-50"
                        }`}
                        data-track="calendar_save_toggle"
                        data-event-id={ev.id}
                      >
                        {isSaved ? "★ 保存済み" : "☆ あとで見る"}
                      </button>
                      <Link
                        href={getEventDetailPath(ev)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
                        data-track="calendar_event_detail"
                        data-event-id={ev.id}
                      >
                        詳細を見る →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
