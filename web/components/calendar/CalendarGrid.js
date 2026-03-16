"use client";

/**
 * Phase67: カレンダーグリッド
 *
 * 月表示の大会カレンダー。
 * 各日に大会件数のドット + クリックで詳細表示。
 */

import { useState } from "react";
import Link from "next/link";
import { getEventDetailPath } from "@/lib/sport-config";
import { getStatusLabel } from "@/lib/entry-status";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

const SPORT_COLORS = {
  marathon: "bg-blue-500",
  trail: "bg-green-500",
  triathlon: "bg-red-500",
  cycling: "bg-orange-500",
  walking: "bg-cyan-500",
  swimming: "bg-indigo-500",
};

const STATUS_STYLES = {
  open: "text-green-600",
  upcoming: "text-blue-600",
  closed: "text-gray-400",
  ended: "text-gray-400",
  cancelled: "text-red-500",
  unknown: "text-gray-400",
};

export default function CalendarGrid({ year, month, eventsByDate }) {
  const [selectedDate, setSelectedDate] = useState(null);

  // カレンダーグリッドの日付を生成
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  // 前月パディング
  const prevMonthDays = startWeekday;
  // 全セル数（6行×7列で固定）
  const totalCells = Math.ceil((daysInMonth + prevMonthDays) / 7) * 7;

  const today = new Date();
  const isToday = (day) =>
    today.getFullYear() === year &&
    today.getMonth() + 1 === month &&
    today.getDate() === day;

  const dateKey = (day) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const selectedEvents = selectedDate ? (eventsByDate[dateKey(selectedDate)] || []) : [];

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
        <div className="mt-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">
            {month}/{selectedDate}の大会（{selectedEvents.length}件）
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-gray-400">この日に大会はありません</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((ev) => (
                <Link
                  key={ev.id}
                  href={getEventDetailPath(ev)}
                  className="block p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">
                        {ev.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span>{ev.prefecture}{ev.city ? ` ${ev.city}` : ""}</span>
                        {ev.distance_list && (
                          <span className="text-blue-600">{ev.distance_list.split(",").slice(0, 2).join(", ")}km</span>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${STATUS_STYLES[ev.entry_status] || ""}`}>
                      {getStatusLabel(ev.entry_status)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
