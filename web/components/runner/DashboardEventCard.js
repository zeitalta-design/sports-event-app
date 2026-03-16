"use client";

/**
 * Phase62: ダッシュボード用コンパクトイベントカード
 *
 * 通常のEventCardよりコンパクト。
 * 保存・比較アクションをワンタップで。
 */

import Link from "next/link";
import { useState, useEffect } from "react";
import { getEventDetailPath } from "@/lib/sport-config";
import { formatEventDate, formatEventLocation, formatDeadline, formatDistanceBadges } from "@/lib/event-list-formatters";
import { toggleSavedId, isSaved } from "@/lib/saved-events-storage";
import { toggleCompareId, isCompared } from "@/lib/compare-utils";
import { getOfficialStatusDef } from "@/lib/official-status-defs";

export default function DashboardEventCard({ event, showDeadline = true }) {
  const [saved, setSaved] = useState(false);
  const [compared, setCompared] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setSaved(isSaved(event.id));
    setCompared(isCompared(event.id));

    function onSync() {
      setSaved(isSaved(event.id));
      setCompared(isCompared(event.id));
    }
    window.addEventListener("saved-change", onSync);
    window.addEventListener("compare-change", onSync);
    return () => {
      window.removeEventListener("saved-change", onSync);
      window.removeEventListener("compare-change", onSync);
    };
  }, [event.id]);

  const detailPath = getEventDetailPath(event);
  const date = formatEventDate(event.event_date);
  const location = formatEventLocation(event);
  const deadline = showDeadline ? formatDeadline(event.entry_end_date) : null;
  const distances = formatDistanceBadges(event.distance_list);
  const statusDef = getOfficialStatusDef(event.official_entry_status || event.entry_status);
  const statusLabel = event.official_entry_status_label || statusDef.label;

  function handleSave(e) {
    e.preventDefault();
    e.stopPropagation();
    const result = toggleSavedId(event.id);
    if (result.full) {
      setToast("保存は最大20件までです");
      setTimeout(() => setToast(null), 2000);
    }
  }

  function handleCompare(e) {
    e.preventDefault();
    e.stopPropagation();
    const result = toggleCompareId(event.id);
    if (result.full) {
      setToast("比較は最大3件までです");
      setTimeout(() => setToast(null), 2000);
    }
  }

  return (
    <div className="relative bg-white border border-gray-200 rounded-xl hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
      {/* 締切警告バー */}
      {deadline?.urgent && (
        <div className="bg-red-50 border-b border-red-100 px-3 py-1 flex items-center gap-1.5">
          <span className="text-xs font-semibold text-red-600">⏰ {deadline.text}</span>
        </div>
      )}

      <div className="p-4">
        {/* 上段: ステータス + 距離 */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${statusDef.badgeClass}`}>
            {statusLabel}
          </span>
          {distances.slice(0, 2).map((d, i) => (
            <span key={i} className="px-2 py-0.5 text-xs font-medium rounded bg-blue-50 text-blue-700">
              {d}
            </span>
          ))}
        </div>

        {/* タイトル */}
        <Link href={detailPath} className="block mb-2 group">
          <h3 className="font-bold text-sm leading-snug line-clamp-2 text-gray-900 group-hover:text-blue-700 transition-colors">
            {event.title}
          </h3>
        </Link>

        {/* 日時・場所 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mb-3">
          <span className="inline-flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {date}
          </span>
          <span className="inline-flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {location}
          </span>
          {deadline && !deadline.urgent && (
            <span className="text-gray-400">
              締切: {deadline.text}
            </span>
          )}
        </div>

        {/* アクション */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <Link
            href={detailPath}
            className="flex-1 text-center py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            詳細
          </Link>
          <button
            onClick={handleSave}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              saved
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : "text-gray-500 hover:bg-gray-50 border border-gray-200"
            }`}
            title={saved ? "保存解除" : "あとで見る"}
          >
            {saved ? "✓ 保存中" : "保存"}
          </button>
          <button
            onClick={handleCompare}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              compared
                ? "bg-blue-50 text-blue-700 border border-blue-200"
                : "text-gray-500 hover:bg-gray-50 border border-gray-200"
            }`}
            title={compared ? "比較解除" : "比較に追加"}
          >
            {compared ? "✓ 比較中" : "比較"}
          </button>
        </div>
      </div>

      {/* トースト */}
      {toast && (
        <div className="absolute bottom-2 left-2 right-2 bg-gray-800 text-white text-xs px-3 py-2 rounded-lg text-center">
          {toast}
        </div>
      )}
    </div>
  );
}
