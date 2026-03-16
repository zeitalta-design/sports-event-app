"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import AlertActionCTA from "./AlertActionCTA";
import { markAlertRead, isAlertRead, toggleAlertPin, isAlertPinned } from "@/lib/alerts-read-state";

/**
 * Phase102: 通知候補カード（強化版）
 *
 * 1大会分の通知情報を表示するカード。
 * ピン留め / 既読 / アクションCTA 対応。
 */

const LEVEL_STYLES = {
  high: {
    border: "border-l-red-400",
    badge: "bg-red-50 text-red-700 border-red-200",
    badgeLabel: "要確認",
  },
  medium: {
    border: "border-l-amber-400",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    badgeLabel: "注意",
  },
  low: {
    border: "border-l-blue-300",
    badge: "bg-blue-50 text-blue-600 border-blue-200",
    badgeLabel: "確認推奨",
  },
  info: {
    border: "border-l-gray-300",
    badge: "bg-gray-50 text-gray-600 border-gray-200",
    badgeLabel: "情報",
  },
  none: {
    border: "border-l-gray-200",
    badge: "bg-gray-50 text-gray-500 border-gray-200",
    badgeLabel: "問題なし",
  },
};

const ALERT_ICON = {
  cancelled: "🚫",
  entry_closed: "🔒",
  deadline_imminent: "⏰",
  deadline_soon: "⏰",
  deadline_passed: "⏰",
  deadline_2weeks: "📅",
  event_imminent: "📍",
  event_soon: "📍",
  event_finished: "✅",
  capacity_limited: "👥",
  stale_data: "📋",
};

function formatShortDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const dow = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${dow})`;
}

export default function AlertEventCard({ item, onPinChange, onReadChange }) {
  if (!item) return null;

  const [read, setRead] = useState(() => isAlertRead(item.eventId));
  const [pinned, setPinned] = useState(() => isAlertPinned(item.eventId));

  const style = LEVEL_STYLES[item.level] || LEVEL_STYLES.none;
  const location = [item.prefecture, item.city].filter(Boolean).join(" ");
  const dateStr = formatShortDate(item.eventDate);

  // 既読にする（カード展開/クリック時）
  const handleMarkRead = useCallback(() => {
    if (!read) {
      markAlertRead(item.eventId);
      setRead(true);
      onReadChange?.();
    }
  }, [read, item.eventId, onReadChange]);

  // ピン切替
  const handleTogglePin = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      const nowPinned = toggleAlertPin(item.eventId);
      setPinned(nowPinned);
      onPinChange?.();
    },
    [item.eventId, onPinChange]
  );

  // 最初のアラートの種類（CTA用）
  const firstAlertType =
    item.alerts && item.alerts.length > 0 ? item.alerts[0].type : null;

  return (
    <div
      className={`card border-l-4 ${style.border} p-4 hover:shadow-md transition-shadow ${
        read ? "opacity-75" : ""
      }`}
      onClick={handleMarkRead}
    >
      <div className="flex items-start justify-between gap-3">
        {/* 左: 情報 */}
        <div className="flex-1 min-w-0">
          {/* タイトル + バッジ + 未読ドット */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {!read && (
              <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
            )}
            <Link
              href={item.path}
              className={`text-sm ${
                read ? "font-medium" : "font-bold"
              } text-gray-900 hover:text-blue-600 transition-colors line-clamp-1`}
              onClick={handleMarkRead}
            >
              {item.title}
            </Link>
            {item.level !== "none" && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded border ${style.badge}`}
              >
                {style.badgeLabel}
              </span>
            )}
          </div>

          {/* メタ情報 */}
          <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
            {dateStr && <span>{dateStr}</span>}
            {location && <span>{location}</span>}
            {item.entryStatus === "open" && (
              <span className="text-green-600 font-medium">受付中</span>
            )}
            {item.entryStatus === "closed" && (
              <span className="text-gray-400">受付終了</span>
            )}
          </div>

          {/* アラート一覧 */}
          {item.alerts && item.alerts.length > 0 && (
            <div className="space-y-1">
              {item.alerts.map((alert, i) => (
                <div
                  key={`${alert.type}-${i}`}
                  className="flex items-start gap-1.5 text-xs"
                >
                  <span className="flex-shrink-0 mt-0.5">
                    {ALERT_ICON[alert.type] || "ℹ️"}
                  </span>
                  <div>
                    <span className="font-medium text-gray-700">
                      {alert.label}
                    </span>
                    <span className="text-gray-500 ml-1">{alert.note}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* アラートなし */}
          {(!item.alerts || item.alerts.length === 0) && (
            <p className="text-xs text-gray-400">
              現在、特に確認が必要な項目はありません
            </p>
          )}

          {/* Phase102: アクションCTA */}
          {firstAlertType && (
            <div className="mt-2">
              <AlertActionCTA
                alertType={firstAlertType}
                entryUrl={item.entryUrl}
                sourceUrl={item.sourceUrl}
              />
            </div>
          )}
        </div>

        {/* 右: ピンボタン + 詳細リンク */}
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          {/* ピンボタン */}
          <button
            onClick={handleTogglePin}
            className={`p-1 rounded transition-colors ${
              pinned
                ? "text-amber-500 hover:text-amber-600"
                : "text-gray-300 hover:text-gray-500"
            }`}
            title={pinned ? "ピン解除" : "ピン留め"}
          >
            <svg
              className="w-4 h-4"
              fill={pinned ? "currentColor" : "none"}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          </button>

          {/* 詳細リンク */}
          <Link
            href={item.path}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors whitespace-nowrap"
            onClick={handleMarkRead}
          >
            詳細
          </Link>
        </div>
      </div>
    </div>
  );
}
