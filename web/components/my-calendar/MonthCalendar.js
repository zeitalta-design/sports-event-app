"use client";
import { useState } from "react";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const LABEL_COLORS = {
  red: "bg-red-100 text-red-700",
  orange: "bg-orange-100 text-orange-700",
  yellow: "bg-yellow-100 text-yellow-800",
  green: "bg-green-100 text-green-700",
  blue: "bg-blue-100 text-blue-700",
  gray: "bg-gray-100 text-gray-500",
};

/**
 * 今月のカレンダー — 意味ラベル付き
 */
export default function MonthCalendar({ year, month, days, labels, onMonthChange, nextEventDate, hideNav = false }) {
  const monthNames = [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月",
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* ヘッダー */}
      <div className={`flex items-center ${hideNav ? "justify-center" : "justify-between"} px-4 py-3 border-b border-gray-100 bg-gray-50`}>
        {!hideNav && (
          <button
            onClick={() => onMonthChange(-1)}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
            aria-label="前月"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}
        <h3 className="text-sm font-bold text-gray-800">
          {year}年{monthNames[month - 1]}
        </h3>
        {!hideNav && (
          <button
            onClick={() => onMonthChange(1)}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
            aria-label="翌月"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        )}
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`text-center text-[11px] font-bold py-1.5 ${
              i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 日付グリッド */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          if (!day) {
            return <div key={`pad-${idx}`} className="min-h-[52px] sm:min-h-[64px] border-b border-r border-gray-50" />;
          }

          const dayOfWeek = (idx) % 7;
          const dayLabels = labels[day.dateStr] || [];
          const hasLabels = dayLabels.length > 0;
          const isNextEvent = nextEventDate && day.dateStr === nextEventDate;

          return (
            <div
              key={day.dateStr}
              className={`min-h-[52px] sm:min-h-[64px] p-0.5 sm:p-1 border-b border-r border-gray-50 relative ${
                isNextEvent
                  ? "bg-gradient-to-br from-blue-100 to-indigo-100 ring-2 ring-inset ring-blue-400"
                  : day.isToday
                  ? "bg-blue-50 ring-1 ring-inset ring-blue-300"
                  : ""
              } ${day.isPast && !hasLabels ? "bg-gray-50/50" : ""}`}
            >
              {/* 日付数字 */}
              <div
                className={`text-xs leading-none mb-0.5 pl-0.5 ${
                  isNextEvent
                    ? "text-blue-800 font-black"
                    : day.isToday
                    ? "text-blue-700 font-bold"
                    : dayOfWeek === 0
                    ? "text-red-400 font-medium"
                    : dayOfWeek === 6
                    ? "text-blue-400 font-medium"
                    : day.isPast
                    ? "text-gray-300 font-medium"
                    : "text-gray-600 font-medium"
                }`}
              >
                {day.date}
              </div>

              {/* 意味ラベル */}
              <div className="flex flex-col gap-0.5">
                {dayLabels.slice(0, 2).map((label, li) => (
                  <span
                    key={li}
                    className={`block text-[9px] sm:text-[10px] leading-tight font-bold px-0.5 sm:px-1 py-0.5 rounded truncate ${
                      LABEL_COLORS[label.color] || LABEL_COLORS.gray
                    }`}
                  >
                    {label.text}
                  </span>
                ))}
                {dayLabels.length > 2 && (
                  <span className="text-[8px] text-gray-400 pl-0.5">+{dayLabels.length - 2}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
